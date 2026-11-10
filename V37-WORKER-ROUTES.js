/* SKF Kardex v37: INSERIRE dentro export default.fetch(req,env),
   DOPO il controllo OPTIONS e la definizione di path/send,
   ma PRIMA della guardia di autenticazione generale per le GET pubbliche.
   Necessita delle tabelle definite in V37-MIGRAZIONE.sql.
   Riutilizza authenticated(req,env), readBody(req), log(env,u,...), send(...).
   Non sostituisce il Worker: integrare le rotte nel Worker ATTUALE v33. */
const gp=/^\/api\/gruppi-kardex\/(\d+)(?:\/componenti(?:\/(\d+))?)?$/.exec(path);
if(path==='/api/gruppi-kardex' && req.method==='GET'){
 const groups=await env.DB.prepare('SELECT id,ripiano,posizione,nome,legacy_componente_id FROM gruppi_kardex ORDER BY CAST(ripiano AS INTEGER),ripiano,posizione,nome').all();
 return send({gruppi:groups.results});
}
if(gp && req.method==='GET' && path.endsWith('/componenti')){
 const rows=await env.DB.prepare('SELECT id,gruppo_id,tipo FROM componenti_gruppo WHERE gruppo_id=? ORDER BY tipo').bind(Number(gp[1])).all();
 return send({componenti:rows.results});
}
if(path==='/api/gruppi-kardex'||gp){
 const u=await authenticated(req,env);
 if(!u)return send({error:'Accesso richiesto'},401);
 const validName=x=>typeof x==='string'&&x.trim().length>0&&x.trim().length<=150;
 const body=['POST','PATCH'].includes(req.method)?await readBody(req):{};
 if(path==='/api/gruppi-kardex' && req.method==='POST'){
  if(!validName(body.nome)||!validName(body.ripiano)||!validName(body.posizione))return send({error:'Dati non validi'},400);
  const r=await env.DB.prepare('INSERT INTO gruppi_kardex(ripiano,posizione,nome) VALUES(?,?,?)').bind(body.ripiano.trim(),body.posizione.trim(),body.nome.trim()).run();
  await log(env,u,'creazione','gruppi_kardex',r.meta.last_row_id,body);return send({ok:true,id:r.meta.last_row_id},201);
 }
 if(!gp)return send({error:'Operazione non supportata'},405);
 const groupId=Number(gp[1]);
 const group=await env.DB.prepare('SELECT * FROM gruppi_kardex WHERE id=?').bind(groupId).first();
 if(!group)return send({error:'Gruppo non trovato'},404);
 if(path.includes('/componenti')){
  const itemId=gp[2]?Number(gp[2]):null;
  if(req.method==='POST'&&!itemId){
   if(!validName(body.tipo))return send({error:'Componente non valido'},400);
   const r=await env.DB.prepare('INSERT INTO componenti_gruppo(gruppo_id,tipo) VALUES(?,?)').bind(groupId,body.tipo.trim()).run();
   await log(env,u,'creazione','componenti_gruppo',r.meta.last_row_id,{gruppo_id:groupId,tipo:body.tipo});return send({ok:true,id:r.meta.last_row_id},201);
  }
  if(itemId && req.method==='PATCH'){
   if(!validName(body.tipo))return send({error:'Componente non valido'},400);
   const r=await env.DB.prepare('UPDATE componenti_gruppo SET tipo=?,aggiornato_il=CURRENT_TIMESTAMP WHERE id=? AND gruppo_id=?').bind(body.tipo.trim(),itemId,groupId).run();
   if(!r.meta.changes)return send({error:'Componente non trovato'},404);
   await log(env,u,'modifica','componenti_gruppo',itemId,{tipo:body.tipo});return send({ok:true});
  }
  if(itemId && req.method==='DELETE'){
   const r=await env.DB.prepare('DELETE FROM componenti_gruppo WHERE id=? AND gruppo_id=?').bind(itemId,groupId).run();
   if(!r.meta.changes)return send({error:'Componente non trovato'},404);
   await log(env,u,'eliminazione','componenti_gruppo',itemId,{gruppo_id:groupId});return send({ok:true});
  }
 }else{
  if(req.method==='PATCH'){
   if(!validName(body.nome))return send({error:'Nome non valido'},400);
   const r=await env.DB.prepare('UPDATE gruppi_kardex SET nome=?,aggiornato_il=CURRENT_TIMESTAMP WHERE id=?').bind(body.nome.trim(),groupId).run();
   await log(env,u,'modifica','gruppi_kardex',groupId,{nome:body.nome});return send({ok:true});
  }
  if(req.method==='DELETE'){
   const used=await env.DB.prepare('SELECT COUNT(*) n FROM componenti_gruppo WHERE gruppo_id=?').bind(groupId).first();
   if(used.n)return send({error:'Gruppo non vuoto: spostare o eliminare prima i componenti interni'},409);
   await env.DB.prepare('DELETE FROM gruppi_kardex WHERE id=?').bind(groupId).run();
   await log(env,u,'eliminazione','gruppi_kardex',groupId,{});return send({ok:true});
  }
 }
 return send({error:'Metodo non supportato'},405);
}
/* CAMBIARE inoltre la GET pubblica /api/componenti:
  SELECT c.id,c.ripiano,c.tipo,c.posizione,c.creato_il,c.aggiornato_il
  FROM componenti c
  WHERE NOT EXISTS(SELECT 1 FROM gruppi_kardex g WHERE g.legacy_componente_id=c.id)
  ORDER BY CAST(c.ripiano AS INTEGER),c.ripiano,c.tipo
  Così il catalogo e i QR continuano a mostrare SOLO l'indice generale.
  IMPORTANTE: non cambiare URL di catalogo.html, ripiano.html o QR stampati.
*/
