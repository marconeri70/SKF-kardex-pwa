/* SKF Kardex v32 - statistiche e modifica rapida, nessuna credenziale lato client. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
let authorized=false,editing=null,selected=null,busy=false;
const choices=()=>window.KARDEX_POSITIONS||['Sinistra','Centrale','Destra','Da definire'];
function stats(){
 const host=$('kardexStats');if(!host||typeof ROWS==='undefined')return;
 const total=ROWS.length,unknown=ROWS.filter(r=>String(r.POSIZIONE).trim().toLowerCase()==='da definire').length;
 const unique=new Set(ROWS.map(r=>String(r.RIPIANO).trim()).filter(Boolean)).size;
 host.replaceChildren();
 for(const [value,label] of [[total,'Componenti'],[total-unknown,'Posizioni note'],[unknown,'Da definire']]){
  const card=document.createElement('div');card.className='kstat';
  const strong=document.createElement('strong');strong.textContent=String(value);
  const span=document.createElement('span');span.textContent=label;
  card.append(strong,span);host.append(card);
 }
 host.setAttribute('aria-label',total+' componenti, '+(total-unknown)+' posizioni note, '+unknown+' da definire, '+unique+' ripiani');
}
function close(){editing=null;selected=null;const root=$('v32QuickEdit');if(root){root.hidden=true;root.replaceChildren();}}
function start(id){
 if(!authorized){alert('Per modificare la posizione, accedi come operatore.');$('cloudToggleLogin')?.click();$('cloudPanel')?.scrollIntoView({behavior:'smooth',block:'start'});return;}
 const r=ROWS.find(x=>String(x.id)===String(id));if(!r){alert('Componente non trovato nell’inventario condiviso.');return;}
 editing=r.id;selected=r.POSIZIONE;busy=false;draw(r);
}
function draw(r){
 const root=$('v32QuickEdit');if(!root)return;
 root.replaceChildren();root.hidden=false;root.className='v32-edit-panel';
 const heading=document.createElement('strong');heading.textContent='Modifica posizione · '+r.TIPO+' · Ripiano '+r.RIPIANO;
 const hint=document.createElement('p');hint.className='muted';hint.textContent='Seleziona la posizione verificata sul Kardex e premi Salva. Nessuna modifica avviene prima della conferma.';
 const grid=document.createElement('div');grid.className='v32-position-editor';
 const status=document.createElement('p');status.id='v32EditStatus';status.setAttribute('role','status');
 for(const pos of choices()){
  const btn=document.createElement('button');btn.type='button';btn.textContent=pos;
  btn.setAttribute('aria-pressed',String(selected===pos));
  btn.onclick=()=>{selected=pos;grid.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.textContent===pos)));};
  grid.append(btn);
 }
 const actions=document.createElement('div');actions.className='v32-edit-actions';
 const save=document.createElement('button');save.type='button';save.textContent='💾 Salva posizione';
 save.onclick=()=>{
  if(busy)return;
  if(selected===r.POSIZIONE){status.textContent='La posizione è già quella selezionata.';return;}
  busy=true;save.disabled=true;status.textContent='Salvataggio nel database condiviso…';
  window.dispatchEvent(new CustomEvent('kardex:quick-save',{detail:{id:r.id,posizione:selected}}));
 };
 const cancel=document.createElement('button');cancel.type='button';cancel.className='secondary';cancel.textContent='Annulla';cancel.onclick=close;
 actions.append(save,cancel);root.append(heading,hint,grid,actions,status);
 root.scrollIntoView({behavior:'smooth',block:'center'});
}
window.addEventListener('kardex:stats',stats);
window.addEventListener('kardex:auth',e=>{authorized=!!e.detail?.logged;if(!authorized)close();});
window.addEventListener('kardex:quick-edit',e=>start(e.detail?.id));
window.addEventListener('kardex:quick-result',e=>{
 const d=e.detail||{};busy=false;
 if(d.ok){close();const msg=$('cloudMessage');if(msg)msg.textContent='Posizione aggiornata nel database condiviso.';}
 else{
  const root=$('v32QuickEdit');const status=$('v32EditStatus');
  if(status)status.textContent='Errore: '+(d.error||'Salvataggio non riuscito');
  root?.querySelectorAll('button').forEach(b=>b.disabled=false);
 }
});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',stats);else stats();
})();
