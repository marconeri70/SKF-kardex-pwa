// SKF Kardex v21 - API Cloudflare D1. Nessuna credenziale nel repository.
(() => {
'use strict';
const API='https://skf-kardex-api.vocidicassino.workers.dev';
const $=id=>document.getElementById(id);
let token=sessionStorage.getItem('kardex_token')||'';
let user=null;
const status=message=>{$('cloudStatus').textContent=message;};
const message=text=>{$('cloudMessage').textContent=text||'';};
async function request(path,method='GET',data){
  const headers={'Accept':'application/json'};
  if(data!==undefined) headers['Content-Type']='application/json';
  if(token)headers.Authorization='Bearer '+token;
  const response=await fetch(API+path,{method,headers,body:data===undefined?undefined:JSON.stringify(data),cache:'no-store'});
  let result={};try{result=await response.json();}catch{}
  if(!response.ok)throw new Error(result.error||'Errore HTTP '+response.status);
  return result;
}
function renderUser(){
  const logged=!!user;
  $('cloudToggleLogin').classList.toggle('hidden',logged);
  if(logged){$('cloudLoginArea').classList.add('hidden');$('cloudToggleLogin').setAttribute('aria-expanded','false');}
  $('cloudAdmin').classList.toggle('hidden',!user||user.ruolo!=='admin');
  $('cloudImport').classList.toggle('hidden',!user||user.ruolo!=='admin');
  if(user)$('cloudLoginArea').classList.add('hidden');
  $('cloudUserArea').classList.toggle('hidden',!user);
  $('cloudEditor').classList.toggle('hidden',!user);
  $('cloudUser').textContent=user?user.nome+' · '+user.ruolo:'';
  document.querySelectorAll('.cloudActions').forEach(el=>{
    el.replaceChildren();
    if(!user||!el.dataset.id)return;
    const edit=document.createElement('button');edit.textContent='Modifica';edit.className='secondary';edit.style.marginLeft='8px';
    edit.onclick=()=>{const r=ROWS.find(x=>String(x.id)===el.dataset.id);if(!r)return;
      $('cloudId').value=r.id;$('cloudRipiano').value=r.RIPIANO;$('cloudTipo').value=r.TIPO;$('cloudPosizione').value=r.POSIZIONE;
      $('cloudEditor').open=true;$('cloudForm').scrollIntoView({behavior:'smooth',block:'center'});};
    const del=document.createElement('button');del.textContent='Elimina';del.className='secondary';del.style.marginLeft='4px';
    del.onclick=async()=>{const r=ROWS.find(x=>String(x.id)===el.dataset.id);if(!r||!confirm('Eliminare '+r.TIPO+' dal ripiano '+r.RIPIANO+'?'))return;
      try{await request('/api/componenti/'+encodeURIComponent(r.id),'DELETE');message('Componente eliminato');await refresh();}
      catch(e){message(e.message);}};
    el.append(edit,del);
  });
}
async function refresh(){
  const data=await request('/api/componenti');
  if(!Array.isArray(data.componenti))throw new Error('Risposta inventario non valida');
  ROWS=data.componenti.map(x=>({id:x.id,RIPIANO:String(x.ripiano??''),TIPO:String(x.tipo??''),POSIZIONE:String(x.posizione??'')}));
  window.KARDEX_CLOUD_ONLINE=true;
  render();if(typeof analyzeTray==='function'&&$('c_vassoio_target'))analyzeTray(+$('c_vassoio_target').value||0);
  renderUser();status('Online · '+ROWS.length+' componenti');
}
function resetForm(){$('cloudForm').reset();$('cloudId').value='';}
window.addEventListener('kardex:render',renderUser);
$('cloudToggleLogin').addEventListener('click',()=>{
  const open=$('cloudLoginArea').classList.toggle('hidden')===false;
  $('cloudToggleLogin').setAttribute('aria-expanded',String(open));
});

let importPending=[];
const importStatus=t=>{$('cloudImportMessage').textContent=t;};
const importKey=x=>String(x.ripiano??x.RIPIANO??'').trim().toLocaleUpperCase('it')+'|'+String(x.tipo??x.TIPO??'').trim().toLocaleUpperCase('it');
async function previewWarehouseImport(){
  importPending=[];$('cloudImportConfirm').disabled=true;$('cloudImportList').replaceChildren();
  if(!user||user.ruolo!=='admin')return importStatus('Accesso amministratore richiesto.');
  try{
    const [res,inventory]=await Promise.all([fetch('./data/warehouse-index-2026.json',{cache:'no-store'}),request('/api/componenti')]);
    if(!res.ok)throw new Error('File indice non disponibile');
    const doc=await res.json();
    if(!Array.isArray(doc.items)||doc.items.length!==27)throw new Error('Indice incompleto: importazione annullata');
    if(!Array.isArray(inventory.componenti))throw new Error('Inventario non disponibile');
    const existing=new Set(inventory.componenti.map(importKey));
    const seen=new Set();let duplicates=0;
    for(const item of doc.items){
      const key=importKey(item);
      const already=existing.has(key)||seen.has(key);
      if(already)duplicates++;else importPending.push(item);
      seen.add(key);
      const line=document.createElement('div');
      line.textContent=(already?'✓ Già presente · ':'+ Da inserire · ')+item.ripiano+' · '+item.tipo;
      $('cloudImportList').append(line);
    }
    importStatus(doc.items.length+' righe verificate · '+duplicates+' già presenti · '+importPending.length+' da aggiungere.');
    $('cloudImportConfirm').disabled=true;
    importStatus(doc.items.length+' righe verificate · '+duplicates+' già presenti · '+importPending.length+' mancanti. Importazione sospesa: il Worker rifiuta «Da definire».');
  }catch(e){importStatus('Verifica non riuscita: '+e.message);}
}
$('cloudImportPreview').addEventListener('click',previewWarehouseImport);
$('cloudImportConfirm').addEventListener('click',async()=>{
  if(!user||user.ruolo!=='admin'||!importPending.length)return;
  importStatus('Importazione sospesa: occorre aggiornare la validazione del Worker Cloudflare.');return;
  if(!confirm('Importare '+importPending.length+' componenti mancanti nel database condiviso?'))return;
  const btn=$('cloudImportConfirm');btn.disabled=true;
  let inserted=0;
  try{
    // Ricontrollo immediato: evita duplicati anche se il database è cambiato dopo l'anteprima.
    const data=await request('/api/componenti');
    if(!Array.isArray(data.componenti))throw new Error('Inventario non disponibile');
    const existing=new Set(data.componenti.map(importKey));
    const toAdd=importPending.filter(x=>!existing.has(importKey(x)));
    for(const item of toAdd){
      await request('/api/componenti','POST',{ripiano:item.ripiano,tipo:item.tipo,posizione:'Da definire'});
      existing.add(importKey(item));inserted++;
      importStatus('Importazione: '+inserted+' di '+toAdd.length+'...');
    }
    importStatus('Importazione completata: '+inserted+' componenti aggiunti. Nessun dato esistente sovrascritto.');
    importPending=[];await refresh();
  }catch(e){importStatus('Importazione interrotta dopo '+inserted+' inserimenti: '+e.message+'. Ripeti la verifica per riprendere senza duplicati.');try{await refresh();}catch{}}
});

const opMessage=t=>{$('operatorMessage').textContent=t||'';};
async function loadOperators(){
  if(!user||user.ruolo!=='admin')return;
  opMessage('');
  try{
    const data=await request('/api/operatori');
    const list=Array.isArray(data)?data:(data.operatori||[]);
    const root=$('operatorList');root.replaceChildren();
    if(!list.length){root.textContent='Nessun operatore nell’elenco';return;}
    for(const op of list){
      const row=document.createElement('div');row.className='row';row.style.cssText='padding:8px 0;border-bottom:1px solid var(--border)';
      const label=document.createElement('span');label.style.flex='1';label.textContent=(op.nome||op.email)+' · '+op.email+' · '+op.ruolo+' · '+(op.attivo?'Attivo':'Disattivato');
      row.append(label);
      if(String(op.id)!==String(user.id)){
        const btn=document.createElement('button');btn.className='secondary';btn.textContent=op.attivo?'Disattiva':'Riattiva';
        btn.onclick=async()=>{
          if(!confirm((op.attivo?'Disattivare':'Riattivare')+' '+op.email+'?'))return;
          try{await request('/api/operatori/'+encodeURIComponent(op.id),'PATCH',{attivo:op.attivo?0:1});await loadOperators();}
          catch(e){opMessage(e.message);}
        };row.append(btn);
      }
      root.append(row);
    }
  }catch(e){opMessage('Impossibile leggere gli operatori: '+e.message);}
}
$('operatorRefresh').addEventListener('click',loadOperators);
$('cloudAdminDetails').addEventListener('toggle',e=>{if(e.target.open)loadOperators();});
$('cloudOperatorForm').addEventListener('submit',async e=>{
  e.preventDefault();opMessage('');
  const body={nome:$('operatorName').value.trim(),email:$('operatorEmail').value.trim(),password:$('operatorPassword').value,ruolo:$('operatorRole').value};
  try{await request('/api/operatori','POST',body);$('cloudOperatorForm').reset();opMessage('Operatore creato');await loadOperators();}
  catch(err){opMessage(err.message);}
});
$('cloudLogin').addEventListener('click',async()=>{
  message('');
  try{
    const data=await request('/api/login','POST',{email:$('cloudEmail').value.trim(),password:$('cloudPassword').value});
    if(!data.token)throw new Error('Token di accesso non ricevuto');
    token=data.token;sessionStorage.setItem('kardex_token',token);$('cloudPassword').value='';
    const me=await request('/api/me');
    user=me.operatore||me.user||me;renderUser();message('Accesso effettuato');
  }catch(e){token='';sessionStorage.removeItem('kardex_token');user=null;renderUser();message(e.message);}
});
$('cloudLogout').addEventListener('click',async()=>{
  try{await request('/api/logout','POST');}catch{}
  token='';user=null;sessionStorage.removeItem('kardex_token');resetForm();renderUser();message('Accesso terminato');
});
$('cloudCancel').addEventListener('click',resetForm);
$('cloudForm').addEventListener('submit',async e=>{
  e.preventDefault();message('');
  const id=$('cloudId').value;
  const body={ripiano:$('cloudRipiano').value.trim(),tipo:$('cloudTipo').value.trim(),posizione:$('cloudPosizione').value};
  try{
    await request(id?'/api/componenti/'+encodeURIComponent(id):'/api/componenti',id?'PATCH':'POST',body);
    resetForm();message('Componente salvato nel database');await refresh();
  }catch(err){message(err.message);}
});
(async()=>{
  try{await refresh();}catch(e){status('Offline · dati locali');message('Cloudflare non raggiungibile: eventuali dati locali sono solo consultabili.');}
  if(token){try{const me=await request('/api/me');user=me.operatore||me.user||me;}catch{token='';sessionStorage.removeItem('kardex_token');}}
  renderUser();
})();
})();
