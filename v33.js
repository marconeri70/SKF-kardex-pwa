/* SKF v33: frontend posizioni condivise. Richiede API /api/posizioni lato Worker. */
(()=>{'use strict';
const API='https://skf-kardex-api.vocidicassino.workers.dev';
const $=id=>document.getElementById(id);
const norm=x=>String(x??'').trim().toLocaleLowerCase('it');
const defaults=['Sinistra','Centrale','Destra','Da definire'];
let positions=defaults.slice(),supported=false,admin=false;
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
async function load(){
 try{
  const data=await call('/api/posizioni');
  positions=normalizeList(data);window.KARDEX_POSITIONS=positions;supported=true;
  status('Posizioni condivise caricate.');rerender();
 }catch(e){
  supported=false;positions=defaults.slice();window.KARDEX_POSITIONS=positions;
  status('Gestione posizioni non ancora attiva sul Worker. Le posizioni attuali restano disponibili.');renderAdmin();
 }
}
function renderAdmin(){
 const list=$('positionAdminList'),form=$('positionAddForm');if(!list||!form)return;
 list.replaceChildren();form.querySelectorAll('input,button').forEach(el=>el.disabled=!supported||!admin);
 if(!supported)return;
 for(const name of positions){
  const row=document.createElement('div');row.className='v33-pos-row';
  const label=document.createElement('strong');label.textContent=name;row.append(label);
  const protectedName=norm(name)==='da definire';
  const rename=document.createElement('button');rename.type='button';rename.className='secondary';rename.textContent='Rinomina';rename.disabled=!admin||protectedName;
  rename.onclick=async()=>{
   const next=prompt('Nuovo nome per '+name,name);
   if(next===null)return;
   const value=next.trim();if(!value||value===name)return;
   if(value.length>60)return alert('Massimo 60 caratteri.');
   if(!confirm('Rinominare '+name+' in '+value+'? I componenti associati dovranno essere aggiornati dal server nella stessa operazione.'))return;
   await mutate('/api/posizioni/'+encodeURIComponent(name),'PATCH',{nome:value});
  };
  const remove=document.createElement('button');remove.type='button';remove.className='secondary';remove.textContent='Elimina';remove.disabled=!admin||protectedName;
  remove.onclick=async()=>{
   if(typeof ROWS!=='undefined'&&ROWS.some(r=>norm(r.POSIZIONE)===norm(name)))return alert('Questa posizione è utilizzata da componenti. Riassegnali prima di eliminarla.');
   if(!confirm('Eliminare la posizione '+name+'? Il server controllerà nuovamente che non sia utilizzata.'))return;
   await mutate('/api/posizioni/'+encodeURIComponent(name),'DELETE');
  };
  row.append(rename,remove);list.append(row);
 }
}
async function mutate(path,method,body){
 if(!supported||!admin)return;
 status('Salvataggio…');
 try{await call(path,method,body);await load();status('Posizioni aggiornate nel database condiviso.');}
 catch(e){status('Operazione non riuscita: '+e.message);}
}
$('positionAddForm')?.addEventListener('submit',e=>{
 e.preventDefault();const name=$('positionNewName').value.trim();
 if(!name||name.length>60)return;
 if(positions.some(x=>norm(x)===norm(name)))return status('Questa posizione esiste già.');
 mutate('/api/posizioni','POST',{nome:name}).then(()=>{$('positionNewName').value='';});
});
window.addEventListener('kardex:auth',e=>{admin=!!e.detail?.admin;renderAdmin();});
load();
})();
