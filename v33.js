/* SKF v33: frontend posizioni condivise. Richiede API /api/posizioni lato Worker. */
(()=>{'use strict';
const API='https://skf-kardex-api.vocidicassino.workers.dev';
const $=id=>document.getElementById(id);
const norm=x=>String(x??'').trim().toLocaleLowerCase('it');
const defaults=['Sinistra','Centrale','Destra','Da definire'];
let positions=defaults.slice(),supported=false,admin=false,usage=new Map(),working=false;
window.KARDEX_POSITIONS=positions;
function status(msg){const e=$('positionAdminStatus');if(e)e.textContent=msg;}
async function call(path,method='GET',body){
 const token=sessionStorage.getItem('kardex_token')||'';
 const headers={'Accept':'application/json'};
 if(body!==undefined)headers['Content-Type']='application/json';
 if(token)headers.Authorization='Bearer '+token;
 const res=await fetch(API+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),cache:'no-store'});
 let data={};try{data=await res.json();}catch{}
 if(!res.ok)throw Error(data.error||'HTTP '+res.status);
 return data;
}
function normalizeList(data){
 if(!Array.isArray(data.posizioni))throw Error('Formato posizioni non valido');
 const names=data.posizioni.map(p=>typeof p==='string'?p:p.nome).filter(x=>typeof x==='string'&&x.trim()).map(x=>x.trim());
 if(!names.some(x=>norm(x)==='da definire'))names.push('Da definire');
 return [...new Set(names)];
}
function updateSelect(){
 const sel=$('cloudPosizione');if(!sel)return;
 const current=sel.value;
 sel.replaceChildren();
 for(const name of positions){const opt=document.createElement('option');opt.value=name;opt.textContent=name;sel.append(opt);}
 if(positions.includes(current))sel.value=current;
}
function rerender(){updateSelect();if(typeof render==='function')render();renderAdmin();}
async function refreshUsage(){
 const data=await call('/api/componenti');
 if(!Array.isArray(data.componenti))throw Error('Inventario non disponibile');
 usage=new Map();for(const r of data.componenti){const key=norm(r.posizione);usage.set(key,(usage.get(key)||0)+1);}
 return data.componenti.length;
}
function count(name){return usage.get(norm(name))||0;}
async function load(){
 try{
  const data=await call('/api/posizioni');
  positions=normalizeList(data);window.KARDEX_POSITIONS=positions;supported=true;
  try{await refreshUsage();status('Posizioni e conteggi aggiornati dal database condiviso.');}catch{status('Posizioni caricate; conteggi non disponibili.');}
  rerender();
 }catch(e){
  supported=false;positions=defaults.slice();window.KARDEX_POSITIONS=positions;
  status('Gestione posizioni non ancora attiva sul Worker. Le posizioni attuali restano disponibili.');renderAdmin();
 }
}
function renderAdmin(){
 const list=$('positionAdminList'),form=$('positionAddForm');if(!list||!form)return;
 list.replaceChildren();form.querySelectorAll('input,button').forEach(el=>el.disabled=!supported||!admin||working);
 if(!supported)return;
 for(const name of positions){
  const row=document.createElement('div');row.className='v33-pos-row';
  const label=document.createElement('strong');label.textContent=name;
  const countLabel=document.createElement('span');countLabel.className='muted v33-count';const n=count(name);countLabel.textContent=n+' component'+(n===1?'e':'i');
  row.append(label,countLabel);
  const protectedName=norm(name)==='da definire';
  const rename=document.createElement('button');rename.type='button';rename.className='secondary';rename.textContent='Rinomina';rename.disabled=!admin||protectedName||working;
  rename.onclick=async()=>{
   if(working)return;
   const next=prompt('Nuovo nome per '+name,name);
   if(next===null)return;
   const value=next.trim();if(!value||value===name)return;
   if(value.length>60)return alert('Massimo 60 caratteri.');
   if(positions.some(p=>norm(p)===norm(value)&&norm(p)!==norm(name)))return alert('Il nome scelto è già utilizzato.');
   let total;
   try{await refreshUsage();total=count(name);}catch(e){status('Rinomina sospesa: impossibile verificare i componenti associati. '+e.message);return;}
   const text='Rinominare «'+name+'» in «'+value+'»?\\n\\nComponenti interessati: '+total+'.\\nIl server deve aggiornare nome e componenti insieme.\\nLa modifica sarà visibile anche nel catalogo QR.';
   if(!confirm(text.replaceAll('\\n','\n')))return;
   await mutate('/api/posizioni/'+encodeURIComponent(name),'PATCH',{nome:value});
  };
  const remove=document.createElement('button');remove.type='button';remove.className='secondary';remove.textContent='Elimina';remove.disabled=!admin||protectedName||working;
  remove.onclick=async()=>{
   if(working)return;
   try{await refreshUsage();}catch(e){status('Eliminazione sospesa: impossibile verificare l’inventario.');return;}
   if(count(name)>0)return alert('Eliminazione bloccata: '+count(name)+' componenti utilizzano «'+name+'». Riassegnali prima di eliminarla.');
   if(!confirm('Eliminare la posizione '+name+'? Il server controllerà nuovamente che non sia utilizzata.'))return;
   await mutate('/api/posizioni/'+encodeURIComponent(name),'DELETE');
  };
  if(!protectedName)row.append(rename,remove);list.append(row);
 }
}
async function mutate(path,method,body){
 if(!supported||!admin||working)return false;
 working=true;status('Salvataggio…');renderAdmin();
 try{await call(path,method,body);await load();
  if(typeof refresh==='function')await refresh();
  else window.location.reload();
  status('Posizioni e componenti aggiornati nel database condiviso.');return true;
 }catch(e){status('Operazione non riuscita: '+e.message);return false;}
 finally{working=false;renderAdmin();}
}
$('positionAddForm')?.addEventListener('submit',e=>{
 e.preventDefault();const name=$('positionNewName').value.trim();
 if(!name||name.length>60)return;
 if(positions.some(x=>norm(x)===norm(name)))return status('Questa posizione esiste già.');
 mutate('/api/posizioni','POST',{nome:name}).then(ok=>{if(ok)$('positionNewName').value='';});
});
window.addEventListener('kardex:auth',e=>{admin=!!e.detail?.admin;renderAdmin();});
load();
})();
