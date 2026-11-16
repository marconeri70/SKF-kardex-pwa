const enc = new TextEncoder();
const HEADERS = {'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'};
const ORIGIN = 'https://marconeri70.github.io';
const hex = b => Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,'0')).join('');
const randomHex = (n=32)=>hex(crypto.getRandomValues(new Uint8Array(n)));
const digest = async s=>hex(await crypto.subtle.digest('SHA-256',enc.encode(s)));
const equal = (a,b)=>{if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;let v=0;for(let i=0;i<a.length;i++)v|=a.charCodeAt(i)^b.charCodeAt(i);return v===0;};
async function hashPassword(password, salt) {
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const derived = await crypto.subtle.deriveBits({
    name: 'PBKDF2',
    salt: enc.encode(salt),
    iterations: 100000,
    hash: 'SHA-256'
  }, key, 256);
  return hex(derived);
}
const validEmail=s=>typeof s==='string'&&s.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
const validPassword=s=>typeof s==='string'&&s.length>=12&&s.length<=128;
const normalizeEmail=s=>s.trim().toLowerCase();
const standardPositions=['Sinistra','Centrale','Destra','Da definire'];
const validPositionName=s=>typeof s==='string'&&s.trim().length>=1&&s.trim().length<=60;
const cleanPositionName=s=>s.trim().replace(/\s+/g,' ');
async function getPositions(env){
  const r=await env.DB.prepare('SELECT nome FROM posizioni ORDER BY ordinamento,id').all();
  return r.results.map(x=>x.nome);
}
async function componentInput(x,env){
  const ripiano=String(x.ripiano??'').trim(),tipo=String(x.tipo??'').trim(),posizione=String(x.posizione??'').trim();
  if(!ripiano||ripiano.length>50||!tipo||tipo.length>150||!validPositionName(posizione))throw new InputError('Ripiano, tipo o posizione non validi');
  const p=await env.DB.prepare('SELECT nome FROM posizioni WHERE nome=? COLLATE NOCASE').bind(posizione).first();
  if(!p)throw new InputError('Posizione non configurata');
  return {ripiano,tipo,posizione:p.nome};
}
class InputError extends Error{}
async function readBody(req){const contentLength=Number(req.headers.get('content-length')||0);if(contentLength>20000)throw new InputError('Richiesta troppo grande');const raw=await req.text();if(raw.length>20000)throw new InputError('Richiesta troppo grande');try{return JSON.parse(raw||'{}');}catch{throw new InputError('JSON non valido');}}
function cors(req){const origin=req.headers.get('Origin');return origin===ORIGIN?{'access-control-allow-origin':ORIGIN,'vary':'Origin','access-control-allow-methods':'GET,POST,PATCH,DELETE,OPTIONS','access-control-allow-headers':'Content-Type,Authorization'}:{};}
async function authenticated(req,env){const match=/^Bearer ([a-f0-9]{64})$/.exec(req.headers.get('Authorization')||'');if(!match)return null;const tokenHash=await digest(match[1]);return env.DB.prepare("SELECT o.id,o.nome,o.email,CASE WHEN o.solo_prelievo=1 AND o.ruolo='operatore' THEN 'solo_prelievo' ELSE o.ruolo END AS ruolo FROM sessioni s JOIN operatori o ON o.id=s.operatore_id WHERE s.token_hash=? AND s.scadenza>datetime('now') AND o.attivo=1").bind(tokenHash).first();}
async function log(env,u,action,table,id,details={}){await env.DB.prepare('INSERT INTO registro_modifiche(operatore_id,azione,tabella,record_id,dettagli) VALUES (?,?,?,?,?)').bind(u?.id??null,action,table,id??null,JSON.stringify(details)).run();}
// Throttling uses the D1 table defined in migration.sql. Counts are persisted across Worker instances.
async function rateCheck(env,kind,identity,limit,windowSeconds){const key=await digest(kind+':'+identity);const now=Math.floor(Date.now()/1000);await env.DB.prepare('INSERT INTO auth_limits(key,attempts,window_start) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN window_start<=? THEN 1 ELSE attempts+1 END, window_start=CASE WHEN window_start<=? THEN ? ELSE window_start END').bind(key,now,now-windowSeconds,now-windowSeconds,now).run();const r=await env.DB.prepare('SELECT attempts FROM auth_limits WHERE key=?').bind(key).first();return r.attempts<=limit;}
const setupHtml=`<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SKF Kardex · Primo amministratore</title><style>body{margin:0;background:#f2f6fa;color:#16304b;font:16px system-ui}main{max-width:480px;margin:8vh auto;padding:28px;background:white;border-radius:18px;box-shadow:0 8px 30px #0d34541a}h1{color:#005195;font-size:26px}label{display:block;margin:15px 0 5px;font-weight:600}input{box-sizing:border-box;width:100%;padding:12px;border:1px solid #a8b6c3;border-radius:9px;font:inherit}button{margin-top:20px;width:100%;padding:14px;border:0;border-radius:9px;background:#005195;color:white;font:inherit;font-weight:700;cursor:pointer}#msg{white-space:pre-wrap;margin-top:15px}small{color:#54697b}</style></head><body><main><h1>SKF Kardex v21</h1><p>Creazione del primo amministratore</p><small>La chiave segreta e la password sono inviate solo a questo Worker tramite HTTPS. Non vengono memorizzate in questa pagina.</small><form id="f"><label>Nome</label><input id="nome" required maxlength="100" autocomplete="name"><label>Email</label><input id="email" type="email" required autocomplete="email"><label>Password (minimo 12 caratteri)</label><input id="password" type="password" required minlength="12" autocomplete="new-password"><label>ADMIN_SETUP_KEY</label><input id="key" type="password" required autocomplete="off"><button id="btn">Crea amministratore</button></form><div id="msg" role="status"></div></main><script>document.getElementById('f').addEventListener('submit',async e=>{e.preventDefault();const btn=document.getElementById('btn'),msg=document.getElementById('msg');btn.disabled=true;msg.textContent='Invio in corso…';try{const res=await fetch('/api/setup',{method:'POST',headers:{'content-type':'application/json','X-Setup-Key':document.getElementById('key').value},body:JSON.stringify({nome:document.getElementById('nome').value,email:document.getElementById('email').value,password:document.getElementById('password').value})});const data=await res.json();msg.textContent=res.ok?'Amministratore creato. Ora puoi chiudere questa pagina.':(data.error||'Errore');if(res.ok){document.getElementById('f').reset();document.getElementById('f').hidden=true;}}catch{msg.textContent='Impossibile contattare il Worker';}finally{btn.disabled=false;}});</script></body></html>`;
export default {async fetch(req,env){const ch=cors(req);const send=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{...HEADERS,...ch}});if(req.method==='OPTIONS')return new Response(null,{status:204,headers:ch});try{if(!env.DB)return send({error:'Binding DB mancante'},503);const url=new URL(req.url);const path=url.pathname.replace(/\/$/,'')||'/';
if(path==='/health'&&req.method==='GET')return send({ok:true,service:'skf-kardex-api'});
if(path==='/setup-admin'&&req.method==='GET')return new Response(setupHtml,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','content-security-policy':"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",'x-content-type-options':'nosniff','referrer-policy':'no-referrer'}});
if(path==='/api/posizioni'&&req.method==='GET'){
  const names=await getPositions(env);
  return send({posizioni:names.map(nome=>({nome}))});
}
// Gruppi Kardex: lettura pubblica per app e catalogo, scrittura autenticata.
if(path==='/api/gruppi'&&req.method==='GET'){
 const r=await env.DB.prepare(`SELECT g.id,g.ripiano,g.posizione,g.nome,g.legacy_componente_id,g.tipologia_id,
 (SELECT COUNT(*) FROM componenti_gruppo cg WHERE cg.gruppo_id=g.id) AS numero_componenti
 FROM gruppi_kardex g ORDER BY CAST(g.ripiano AS INTEGER),g.ripiano,g.posizione,g.nome`).all();
 return send({gruppi:r.results});
}
if(path==='/api/movimenti-guidati'){
 const actor=await authenticated(req,env);
 if(!actor)return send({error:'Accesso richiesto'},401);
 if(req.method==='GET'){
  const result=await env.DB.prepare(`SELECT m.*,o.nome AS operatore FROM movimenti_guidati m
    LEFT JOIN operatori o ON o.id=m.operatore_id
    WHERE m.operatore_id=? OR ?='admin'
    ORDER BY (m.stato='aperto') DESC,m.creato_il DESC LIMIT 100`).bind(actor.id,actor.ruolo).all();
  return send({movimenti:result.results});
 }
 if(req.method!=='POST')return send({error:'Metodo non supportato'},405);
 const x=await readBody(req)??{};
 if(typeof x.id!=='string'||!/^[a-f0-9-]{36}$/.test(x.id))return send({error:'Identificativo non valido'},400);
 if(x.comando==='avvia'){
  if(actor.ruolo==='solo_prelievo'&&x.azione==='carica')return send({error:'Account abilitato al solo prelievo'},403);
  if(!['preleva','carica'].includes(x.azione)||!Number.isSafeInteger(x.quantita)||x.quantita<1||x.quantita>2147483647||
     typeof x.pezzo!=='string'||!/^SKF-P-[1-9]\d*$/.test(x.pezzo))return send({error:'Codice componente o quantità non validi'},400);
  await env.DB.prepare(`INSERT INTO movimenti_guidati
    (id,operatore_id,gruppo_id,componente_id,componente,ripiano,posizione,zona,azione,quantita)
    SELECT ?,?,g.id,c.id,c.tipo,g.ripiano,g.posizione,g.nome,?,?
    FROM componenti_gruppo c JOIN gruppi_kardex g ON g.id=c.gruppo_id
    WHERE c.id=?
    ON CONFLICT(id) DO NOTHING`).bind(x.id,actor.id,x.azione,x.quantita,Number(x.pezzo.slice(6))).run();
  const movement=await env.DB.prepare('SELECT * FROM movimenti_guidati WHERE id=? AND operatore_id=?').bind(x.id,actor.id).first();
  return movement?send({movimento:movement}):send({error:'Componente non trovato'},404);
 }
 if(!['conferma','annulla'].includes(x.comando))return send({error:'Comando non valido'},400);
 const movement=await env.DB.prepare('SELECT * FROM movimenti_guidati WHERE id=? AND operatore_id=?').bind(x.id,actor.id).first();
 if(!movement)return send({error:'Movimento non trovato'},404);
  if(actor.ruolo==='solo_prelievo'&&x.comando==='conferma'&&movement.azione==='carica')return send({error:'Account abilitato al solo prelievo'},403);
 if(x.comando==='conferma'&&x.zona!=='SKF-Z-'+movement.gruppo_id)return send({error:'Zona errata. Destinazione prevista: '+movement.ripiano+' · '+movement.posizione+' · '+movement.zona},409);
 const stato=x.comando==='conferma'?'confermato':'annullato';
 try{
  const saved=await env.DB.prepare(`UPDATE movimenti_guidati SET stato=?,chiuso_il=CURRENT_TIMESTAMP
    WHERE id=? AND operatore_id=? AND stato='aperto' RETURNING stato`).bind(stato,x.id,actor.id).first();
  const current=saved??await env.DB.prepare('SELECT stato FROM movimenti_guidati WHERE id=? AND operatore_id=?').bind(x.id,actor.id).first();
  return current?.stato===stato?send({stato}):send({error:'Movimento già chiuso'},409);
 }catch(error){
  if(String(error).includes('KARDEX_MOVIMENTO_NON_APPLICABILE'))return send({error:'Controlla la giacenza e la collocazione attuale del componente'},409);
  throw error;
 }
}
const movement = /^\/api\/gruppi\/(\d+)\/componenti\/(\d+)\/giacenza$/.exec(path);
if (movement && req.method === 'POST') {
  if(!await authenticated(req,env))return send({error:'Accesso richiesto'},401);
  return send({error:'Usa il movimento guidato per prelievi e carichi'},403);
}
const gm=/^\/api\/gruppi\/(\d+)(?:\/componenti(?:\/(\d+))?)?$/.exec(path);
if(gm&&req.method==='GET'&&gm[2]===undefined&&path.endsWith('/componenti')){
 const r=await env.DB.prepare('SELECT id,gruppo_id,tipo,giacenza FROM componenti_gruppo WHERE gruppo_id=? ORDER BY id').bind(Number(gm[1])).all();
 return send({componenti:r.results});
}
if(path==='/api/gruppi'||gm){
 const actor=await authenticated(req,env);
 if(!actor)return send({error:'Accesso richiesto'},401);
 if(actor.ruolo==='solo_prelievo')return send({error:'Account abilitato al solo prelievo'},403);
 const valid=x=>typeof x==='string'&&x.trim().length>=1&&x.trim().length<=150;
 const body=['POST','PATCH'].includes(req.method)?await readBody(req):{};
 if(path==='/api/gruppi'&&req.method==='POST'){
  if(!valid(body.nome)||!body.ripiano||!validPositionName(body.posizione))return send({error:'Dati gruppo non validi'},400);
  const pos=await env.DB.prepare('SELECT nome FROM posizioni WHERE nome=? COLLATE NOCASE').bind(String(body.posizione).trim()).first();
  if(!pos)return send({error:'Posizione non configurata'},400);
  const tipologia = body.tipologia_id ?? null;
  if(tipologia!==null&&(!Number.isSafeInteger(tipologia)||tipologia<1))return send({error:'Tipologia non valida'},400);
  const r=await env.DB.prepare('INSERT INTO gruppi_kardex(ripiano,posizione,nome,tipologia_id) VALUES(?,?,?,?)')
    .bind(String(body.ripiano).trim(),pos.nome,body.nome.trim(),tipologia).run();
  await log(env,actor,'creazione','gruppi_kardex',r.meta.last_row_id,{nome:body.nome});return send({ok:true,id:r.meta.last_row_id},201);
 }
 if(!gm)return send({error:'Metodo non supportato'},405);
 const gid=Number(gm[1]);
 const group=await env.DB.prepare('SELECT id,nome FROM gruppi_kardex WHERE id=?').bind(gid).first();
 if(!group)return send({error:'Gruppo non trovato'},404);
 if(path.includes('/componenti')){
  const iid=gm[2]?Number(gm[2]):null;
  if(req.method==='POST'&&!iid){
   if(!valid(body.tipo))return send({error:'Componente non valido'},400);
   const r=await env.DB.prepare('INSERT INTO componenti_gruppo(gruppo_id,tipo) VALUES(?,?)').bind(gid,body.tipo.trim()).run();
   await log(env,actor,'creazione','componenti_gruppo',r.meta.last_row_id,{gruppo_id:gid,tipo:body.tipo.trim()});return send({ok:true,id:r.meta.last_row_id},201);
  }
  if(iid&&req.method==='PATCH'){
   if(!valid(body.tipo))return send({error:'Componente non valido'},400);
   const r=await env.DB.prepare('UPDATE componenti_gruppo SET tipo=?,aggiornato_il=CURRENT_TIMESTAMP WHERE id=? AND gruppo_id=?').bind(body.tipo.trim(),iid,gid).run();
   if(!r.meta.changes)return send({error:'Componente non trovato'},404);
   await log(env,actor,'modifica','componenti_gruppo',iid,{gruppo_id:gid,tipo:body.tipo.trim()});return send({ok:true});
  }
  if(iid&&req.method==='DELETE'){
   const r=await env.DB.prepare('DELETE FROM componenti_gruppo WHERE id=? AND gruppo_id=?').bind(iid,gid).run();
   if(!r.meta.changes)return send({error:'Componente non trovato'},404);
   await log(env,actor,'eliminazione','componenti_gruppo',iid,{gruppo_id:gid});return send({ok:true});
  }
 }else{
  if(req.method==='PATCH'){
   if(Object.hasOwn(body,'tipologia_id')){
    if(actor.ruolo!=='admin')return send({error:'Solo amministratore'},403);
    const id=body.tipologia_id;
    if(id!==null&&(!Number.isSafeInteger(id)||id<1))return send({error:'Tipologia non valida'},400);
    const result=await env.DB.prepare('UPDATE gruppi_kardex SET tipologia_id=?,aggiornato_il=CURRENT_TIMESTAMP WHERE id=?').bind(id,gid).run();
    if(!result.meta.changes)return send({error:'Gruppo non trovato'},404);
    await log(env,actor,'assegna_tipologia','gruppi_kardex',gid,{tipologia_id:id});
    return send({ok:true});
   }
   if(!valid(body.nome))return send({error:'Nome non valido'},400);
   const r=await env.DB.prepare('UPDATE gruppi_kardex SET nome=?,aggiornato_il=CURRENT_TIMESTAMP WHERE id=?').bind(body.nome.trim(),gid).run();
   if(!r.meta.changes)return send({error:'Gruppo non trovato'},404);
   await log(env,actor,'modifica','gruppi_kardex',gid,{nome:body.nome.trim()});return send({ok:true});
  }
  if(req.method==='DELETE'){
   const r=await env.DB.prepare('DELETE FROM gruppi_kardex WHERE id=? AND NOT EXISTS(SELECT 1 FROM componenti_gruppo WHERE gruppo_id=?)').bind(gid,gid).run();
   if(!r.meta.changes)return send({error:'Gruppo non vuoto: elimina prima i componenti interni'},409);
   await log(env,actor,'eliminazione','gruppi_kardex',gid);return send({ok:true});
  }
 }
 return send({error:'Metodo non supportato'},405);
}
if(path==='/api/componenti'&&req.method==='GET'){const r=await env.DB.prepare('SELECT c.id,c.ripiano,c.tipo,c.posizione,c.creato_il,c.aggiornato_il FROM componenti c WHERE (?=1 OR NOT EXISTS (SELECT 1 FROM gruppi_kardex g WHERE g.legacy_componente_id=c.id)) ORDER BY CAST(c.ripiano AS INTEGER),c.ripiano,c.tipo').bind(url.searchParams.get('tutte')==='1'?1:0).all();return send({componenti:r.results});}
if(path==='/api/setup'&&req.method==='POST'){
const ip=req.headers.get('CF-Connecting-IP')||'unknown';if(!await rateCheck(env,'setup',ip,8,3600))return send({error:'Troppi tentativi: riprova più tardi'},429);
const key=req.headers.get('X-Setup-Key')||'';if(!env.ADMIN_SETUP_KEY||!equal(key,env.ADMIN_SETUP_KEY))return send({error:'Non autorizzato'},403);
const x=await readBody(req);if(!validEmail(x.email)||!validPassword(x.password)||typeof x.nome!=='string'||!x.nome.trim()||x.nome.length>100)return send({error:'Nome, email o password non validi (minimo 12 caratteri)'},400);
const salt=randomHex(16),hashed=await hashPassword(x.password,salt);
const r=await env.DB.prepare("INSERT INTO operatori(nome,email,ruolo,attivo,password_hash,password_salt) SELECT ?,?,'admin',1,?,? WHERE NOT EXISTS (SELECT 1 FROM operatori WHERE ruolo='admin')").bind(x.nome.trim(),normalizeEmail(x.email),hashed,salt).run();
if(r.meta.changes!==1)return send({error:'Amministratore già presente: configurazione chiusa'},409);return send({ok:true,message:'Amministratore creato'},201);
}
if(path==='/api/login'&&req.method==='POST'){
const x=await readBody(req);if(!validEmail(x.email)||typeof x.password!=='string'||x.password.length>128)return send({error:'Credenziali non valide'},401);
const email=normalizeEmail(x.email),ip=req.headers.get('CF-Connecting-IP')||'unknown';
if(!await rateCheck(env,'login-ip',ip,30,900)||!await rateCheck(env,'login-email',email,10,900))return send({error:'Troppi tentativi: riprova tra 15 minuti'},429);
const o=await env.DB.prepare('SELECT * FROM operatori WHERE email=? AND attivo=1').bind(email).first();if(!o||!o.password_hash||!o.password_salt)return send({error:'Credenziali non valide'},401);
const hashed=await hashPassword(x.password,o.password_salt);if(!equal(hashed,o.password_hash))return send({error:'Credenziali non valide'},401);
const token=randomHex(),tokenHash=await digest(token);await env.DB.prepare("INSERT INTO sessioni(operatore_id,token_hash,scadenza) VALUES (?,?,datetime('now','+12 hours'))").bind(o.id,tokenHash).run();return send({token,expires_in:43200,operatore:{id:o.id,nome:o.nome,email:o.email,ruolo:o.solo_prelievo===1&&o.ruolo==='operatore'?'solo_prelievo':o.ruolo}});
}
const u=await authenticated(req,env);if(!u)return send({error:'Accesso richiesto'},401);
if(path==='/api/me'&&req.method==='GET')return send({operatore:u});
if(path==='/api/logout'&&req.method==='POST'){const token=req.headers.get('Authorization').slice(7);await env.DB.prepare('DELETE FROM sessioni WHERE token_hash=?').bind(await digest(token)).run();return send({ok:true});}
 if(u.ruolo==='solo_prelievo')return send({error:'Account abilitato al solo prelievo'},403);
if(path==='/api/posizioni'&&req.method==='POST'){
  if(u.ruolo!=='admin')return send({error:'Solo amministratore'},403);
  const x=await readBody(req);
  if(!validPositionName(x.nome))return send({error:'Nome posizione non valido (1-60 caratteri)'},400);
  const nome=cleanPositionName(x.nome);
  const exists=await env.DB.prepare('SELECT id FROM posizioni WHERE nome=? COLLATE NOCASE').bind(nome).first();
  if(exists)return send({error:'Posizione già esistente'},409);
  const r=await env.DB.prepare('INSERT INTO posizioni(nome,ordinamento) VALUES (?,100)').bind(nome).run();
  await log(env,u,'creazione','posizioni',r.meta.last_row_id,{nome});
  return send({ok:true},201);
}
const pm=/^\/api\/posizioni\/(.+)$/.exec(path);
if(pm&&(req.method==='PATCH'||req.method==='DELETE')){
  if(u.ruolo!=='admin')return send({error:'Solo amministratore'},403);
  let old;
  try{old=decodeURIComponent(pm[1]);}catch{return send({error:'Nome posizione non valido'},400);}
  const p=await env.DB.prepare('SELECT id,nome FROM posizioni WHERE nome=? COLLATE NOCASE').bind(old).first();
  if(!p)return send({error:'Posizione non trovata'},404);
  if(p.nome.toLowerCase()==='da definire')return send({error:'La posizione Da definire è protetta'},409);
  if(req.method==='DELETE'){
    // DELETE condizionato: evita di eliminare posizioni usate anche se un altro operatore modifica nel frattempo.
    const result=await env.DB.prepare('DELETE FROM posizioni WHERE id=? AND NOT EXISTS (SELECT 1 FROM componenti WHERE posizione=? COLLATE NOCASE) AND NOT EXISTS (SELECT 1 FROM gruppi_kardex WHERE posizione=? COLLATE NOCASE)').bind(p.id,p.nome,p.nome).run();
    if(!result.meta.changes)return send({error:'Posizione utilizzata: riassegna prima i componenti'},409);
    await log(env,u,'eliminazione','posizioni',p.id,{nome:p.nome});
    return send({ok:true});
  }
  const x=await readBody(req);
  if(!validPositionName(x.nome))return send({error:'Nome posizione non valido (1-60 caratteri)'},400);
  const nome=cleanPositionName(x.nome);
  const conflict=await env.DB.prepare('SELECT id FROM posizioni WHERE nome=? COLLATE NOCASE AND id<>?').bind(nome,p.id).first();
  if(conflict)return send({error:'Nome già utilizzato'},409);
  // D1 batch esegue le due istruzioni in una transazione atomica.
  await env.DB.batch([
    env.DB.prepare('UPDATE posizioni SET nome=? WHERE id=?').bind(nome,p.id),
    env.DB.prepare('UPDATE componenti SET posizione=?,aggiornato_il=CURRENT_TIMESTAMP WHERE posizione=? COLLATE NOCASE').bind(nome,p.nome),
    env.DB.prepare('UPDATE gruppi_kardex SET posizione=?,aggiornato_il=CURRENT_TIMESTAMP WHERE posizione=? COLLATE NOCASE AND tipologia_id IS NULL').bind(nome,p.nome)
  ]);
  await log(env,u,'rinomina','posizioni',p.id,{da:p.nome,a:nome});
  return send({ok:true});
}
if(path==='/api/componenti'&&req.method==='POST'){const c=await componentInput(await readBody(req),env);const r=await env.DB.prepare('INSERT INTO componenti(ripiano,tipo,posizione) VALUES (?,?,?)').bind(c.ripiano,c.tipo,c.posizione).run();await log(env,u,'creazione','componenti',r.meta.last_row_id,c);return send({ok:true,id:r.meta.last_row_id},201);}
const cm=/^\/api\/componenti\/(\d+)$/.exec(path);
if(cm&&req.method==='PATCH'){const c=await componentInput(await readBody(req),env),id=Number(cm[1]);const r=await env.DB.prepare('UPDATE componenti SET ripiano=?,tipo=?,posizione=?,aggiornato_il=CURRENT_TIMESTAMP WHERE id=?').bind(c.ripiano,c.tipo,c.posizione,id).run();if(!r.meta.changes)return send({error:'Componente non trovato'},404);await log(env,u,'modifica','componenti',id,c);return send({ok:true});}
if(cm&&req.method==='DELETE'){const id=Number(cm[1]);const r=await env.DB.prepare('DELETE FROM componenti WHERE id=?').bind(id).run();if(!r.meta.changes)return send({error:'Componente non trovato'},404);await log(env,u,'eliminazione','componenti',id);return send({ok:true});}
if(path==='/api/operatori'&&req.method==='GET'&&u.ruolo==='admin'){const r=await env.DB.prepare("SELECT id,nome,email,CASE WHEN solo_prelievo=1 AND ruolo='operatore' THEN 'solo_prelievo' ELSE ruolo END AS ruolo,attivo,creato_il FROM operatori ORDER BY id").all();return send({operatori:r.results,solo_prelievo:true});}
if(path==='/api/operatori'&&req.method==='POST'&&u.ruolo==='admin'){const x=await readBody(req);if(!validEmail(x.email)||!validPassword(x.password)||typeof x.nome!=='string'||!x.nome.trim()||x.nome.length>100)return send({error:'Dati operatore non validi'},400);const salt=randomHex(16),h=await hashPassword(x.password,salt);const r=await env.DB.prepare("INSERT INTO operatori(nome,email,ruolo,attivo,password_hash,password_salt,solo_prelievo) VALUES (?,?, 'operatore',1,?,?,?)").bind(x.nome.trim(),normalizeEmail(x.email),h,salt,x.ruolo==='solo_prelievo'?1:0).run();await log(env,u,'creazione','operatori',r.meta.last_row_id,{email:normalizeEmail(x.email)});return send({ok:true,id:r.meta.last_row_id},201);}
const om=/^\/api\/operatori\/(\d+)\/stato$/.exec(path);if(om&&req.method==='PATCH'&&u.ruolo==='admin'){const id=Number(om[1]),x=await readBody(req);if(id===u.id)return send({error:'Non puoi disattivare il tuo account'},400);if(typeof x.attivo!=='boolean')return send({error:'attivo deve essere boolean'},400);const r=await env.DB.prepare("UPDATE operatori SET attivo=? WHERE id=? AND ruolo='operatore'").bind(x.attivo?1:0,id).run();if(!r.meta.changes)return send({error:'Operatore non trovato'},404);if(!x.attivo)await env.DB.prepare('DELETE FROM sessioni WHERE operatore_id=?').bind(id).run();await log(env,u,'stato','operatori',id,{attivo:x.attivo});return send({ok:true});}
return send({error:'Percorso non trovato o non autorizzato'},404);
} catch (e) {
  const detail = [e?.message, e?.cause?.message].join(' ');
  if(detail.includes('KARDEX_TIPOLOGIA_POSIZIONE'))return send({error:'La tipologia deve appartenere allo stesso ripiano e alla stessa posizione'},409);
  if(detail.includes('FOREIGN KEY')&&req.method==='DELETE'&&new URL(req.url).pathname.startsWith('/api/componenti/'))return send({error:'La tipologia contiene zone: riassegnale prima di eliminarla'},409);
  if(detail.includes('UNIQUE constraint failed: gruppi_kardex'))return send({error:'Esiste già una zona con questo nome nella posizione'},409);
  if (e instanceof InputError) {
    return send({ error: e.message }, 400);
  }
  console.error("KARDEX_DIAGNOSTICA", {
    percorso: new URL(req.url).pathname,
    tipo: e?.name || "Errore sconosciuto",
    messaggio: e?.message || "Nessun dettaglio",
    causa: e?.cause?.message || null
  });
  return send({
    error: "Errore durante la richiesta"
  }, 500);
}}};
