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
  $('cloudLoginArea').classList.toggle('hidden',!!user);
  $('cloudUserArea').classList.toggle('hidden',!user);
  $('cloudEditor').classList.toggle('hidden',!user);
  $('cloudUser').textContent=user?user.nome+' · '+user.ruolo:'';
  document.querySelectorAll('.cloudActions').forEach(el=>{
    el.replaceChildren();
    if(!user||!el.dataset.id)return;
    const edit=document.createElement('button');edit.textContent='Modifica';edit.className='secondary';edit.style.marginLeft='8px';
    edit.onclick=()=>{const r=ROWS.find(x=>String(x.id)===el.dataset.id);if(!r)return;
      $('cloudId').value=r.id;$('cloudRipiano').value=r.RIPIANO;$('cloudTipo').value=r.TIPO;$('cloudPosizione').value=r.POSIZIONE;
      $('cloudForm').scrollIntoView({behavior:'smooth',block:'center'});};
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
