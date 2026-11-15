(() => {
 const panel=document.getElementById('movimentiGuidati');
 const form=panel.querySelector('form');
 const status=panel.querySelector('[role=status]');
 const list=panel.querySelector('#movimentiRecenti');
 const pending=panel.querySelector('#movimentiAperti');
 const start=panel.querySelector('#movimentoAvvio');
 const step=panel.querySelector('#passaggioGuidato');
 let request, busy=false, selected;
 const scanButtons=panel.querySelectorAll('[data-scan]');
 const canScan=!!window.BarcodeDetector&&!!navigator.mediaDevices?.getUserMedia;
 scanButtons.forEach(button=>{button.hidden=!canScan;});
 let stream, scanVersion=0;
 const video=panel.querySelector('video');
 function stopScan(){
  scanVersion++;
  stream?.getTracks().forEach(track=>track.stop());
  stream=null;video.srcObject=null;video.hidden=true;
 }
 async function scan(field){
  stopScan();
  if(!window.BarcodeDetector){
   status.textContent='Usa un lettore QR oppure inserisci il codice nel campo.';
   field.focus();return;
  }
  const version=scanVersion;
  try {
   const detector=new BarcodeDetector({formats:['qr_code']});
   const camera=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}}});
   if(version!==scanVersion){camera.getTracks().forEach(track=>track.stop());return;}
   stream=camera;video.srcObject=stream;video.hidden=false;await video.play();
   while(version===scanVersion){
    const codes=await detector.detect(video);
    if(version!==scanVersion)return;
    if(codes.length){field.value=codes[0].rawValue;stopScan();field.focus();return;}
    await new Promise(resolve=>setTimeout(resolve,150));
   }
  }catch(error){if(version===scanVersion){stopScan();status.textContent=error.message;}}
 }
 scanButtons.forEach(button=>button.onclick=()=>scan(document.getElementById(button.dataset.scan)));
 panel.addEventListener('toggle',()=>{if(panel.open&&request)run(refresh);else stopScan();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stopScan();});
 document.getElementById('returnToInventory').addEventListener('click',stopScan);
 window.addEventListener('kardex:auth',event=>{
  const pickOnly=event.detail.ruolo==='solo_prelievo';
  const loadOption=form.azione.querySelector('[value="carica"]');
  loadOption.disabled=loadOption.hidden=pickOnly;
  if(pickOnly)form.azione.value='preleva';
  panel.hidden=!event.detail.logged;
  if(panel.hidden){stopScan();list.replaceChildren();pending.replaceChildren();select(null);form.reset();}
  else if(panel.open&&request&&!busy)run(refresh);
 });
 window.KARDEX_GUIDATO_CONNECT=callback=>{request=callback;};
 async function run(action){
  if(busy)return;
  busy=true;status.textContent='';
  try{await action();}catch(error){status.textContent=error.message;}
  finally{busy=false;}
 }
 async function refresh(){
  const {movimenti}=await request();
  list.replaceChildren();pending.replaceChildren();
  for(const movement of movimenti){
   const row=document.createElement('li');
   row.append(movement.azione+' '+movement.quantita+' × '+movement.componente+' · '+movement.ripiano+' / '+movement.posizione+' / '+movement.zona+' · '+movement.stato+' · '+movement.creato_il+(movement.operatore?' · '+movement.operatore:''));
   if(movement.stato==='aperto'){
    const button=document.createElement('button');
    button.type='button';button.className='secondary';button.textContent='Riprendi';
    button.onclick=()=>{if(!busy){select(movement);form.zona.focus();}};
    row.append(' ',button);
   }
   (movement.stato==='aperto'?pending:list).append(row);
  }
  panel.querySelector('#guidedPendingTitle').textContent=pending.children.length?'Movimenti da completare ('+pending.children.length+')':'Movimenti da completare';
  if(!pending.children.length){const empty=document.createElement('li');empty.textContent='Nessun movimento da completare';pending.append(empty);}
 }
 function select(movement){
  selected=movement;
  start.hidden=!!movement;
  step.textContent=movement?'2 di 2 · Verifica la zona':'1 di 2 · Identifica il componente';
  const target=panel.querySelector('#movimentoDestinazione');
  target.textContent=movement?(movement.azione==='preleva'?'Preleva ':'Carica ')+movement.quantita+' × '+movement.componente+' · Ripiano '+movement.ripiano+' → '+movement.posizione+' → '+movement.zona:'';
  panel.querySelector('#movimentoConferma').hidden=!movement;
  form.zona.value='';
 }
 const labels=panel.querySelector('#etichetteMovimenti');
 const zoneSelect=labels.querySelector('select');
 const api='https://skf-kardex-api.vocidicassino.workers.dev/api/gruppi';
 async function readLabels(url,key){
  const response=await fetch(url,{cache:'no-store'});
  if(!response.ok)throw Error('Impossibile caricare le etichette');
  const rows=(await response.json())[key];
  if(!Array.isArray(rows))throw Error('Elenco etichette non disponibile');
  return rows;
 }
 labels.addEventListener('toggle',()=>{
  if(!labels.open)return;
  run(async()=>{
   const zones=await readLabels(api,'gruppi');
   zoneSelect.replaceChildren(...zones.map(zone=>new Option(
    'Ripiano '+zone.ripiano+' · '+zone.posizione+' · '+zone.nome,zone.id)));
  });
 });
 labels.querySelector('#stampaEtichette').onclick=()=>{
  const option=zoneSelect.selectedOptions[0];
  if(!option||busy)return;
  const sheet=window.open('','_blank');
  if(!sheet){status.textContent='Consenti l’apertura della pagina di stampa.';return;}
  sheet.opener=null;
  const doc=sheet.document;
  doc.title='Etichette SKF Kardex';
  doc.body.textContent='Caricamento etichette…';
  run(async()=>{
   try{
    const items=await readLabels(api+'/'+encodeURIComponent(option.value)+'/componenti','componenti');
    const style=doc.createElement('style');
    style.textContent='body{font:16px system-ui} main{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px} article{display:flex;gap:8px;align-items:center;border:1px solid;padding:8px;break-inside:avoid;overflow-wrap:anywhere} .print-all{margin-bottom:10px} .label-print{display:flex;gap:8px;align-items:center;width:100%;padding:0;border:0;background:none;color:inherit;font:inherit;text-align:left;cursor:pointer} .label-print:focus-visible{outline:2px solid #005a93;outline-offset:4px} @media print{.print-all,.print-help{display:none} body[data-single] h1,body[data-single] article:not([data-selected]){display:none} body[data-single] main{display:block} body[data-single] article{display:inline-flex;max-width:220px}}';
    doc.head.append(style);
    const title=doc.createElement('h1');title.textContent=option.textContent;
    const print=doc.createElement('button');print.textContent='Stampa tutte le etichette';print.className='print-all';print.disabled=true;
    let selected=null;
    const clearSelection=()=>{
      selected?.removeAttribute('data-selected');
      selected=null;
      doc.body.removeAttribute('data-single');
    };
    sheet.addEventListener('afterprint',clearSelection);
    print.onclick=()=>{clearSelection();sheet.print();};
    const grid=doc.createElement('main');
    const images=[];
    for(const [name,code] of [['QR della zona','SKF-Z-'+option.value],...items.map(item=>[item.tipo,'SKF-P-'+item.id])]){
     const card=doc.createElement('article');
     const qr=doc.createElement('img');qr.width=84;qr.height=84;qr.alt=code;
     images.push(new Promise((resolve,reject)=>{qr.onload=resolve;qr.onerror=reject;}));
     qr.src='https://api.qrserver.com/v1/create-qr-code/?size=240x240&qzone=4&data='+encodeURIComponent(code);
     const caption=doc.createElement('div');caption.textContent=name+' · '+code;
     const label=doc.createElement('button');
     label.type='button';
     label.className='label-print';
     label.setAttribute('aria-label','Stampa etichetta '+caption.textContent);
     label.onclick=()=>{
       clearSelection();
       selected=card;
       card.setAttribute('data-selected','');
       doc.body.setAttribute('data-single','');
       sheet.print();
     };
     label.append(qr,caption);card.append(label);grid.append(card);
    }
    doc.body.replaceChildren(title,print,grid);
    await Promise.all(images);
    const help=doc.createElement('p');
    help.className='print-help';
    help.textContent='Seleziona un QR o il suo nome per stampare una sola etichetta.';
    grid.before(help);
    print.disabled=false;
   }catch(error){
    doc.body.textContent='Etichette non disponibili. Chiudi questa scheda e riprova.';
   }
  });
 };
 let draft;
 form.addEventListener('submit',event=>{
  event.preventDefault();if(selected)return;stopScan();
  run(async()=>{
   const data={azione:form.azione.value,quantita:form.quantita.valueAsNumber,pezzo:form.pezzo.value.trim()};
   const key=JSON.stringify(data);
   if(draft?.key!==key)draft={key,id:crypto.randomUUID()};
   const {movimento}=await request({comando:'avvia',id:draft.id,...data});
   draft=null;select(movimento);form.zona.focus();await refresh();
  });
 });
 for(const comando of ['conferma','annulla']){
  panel.querySelector('[data-command='+comando+']').onclick=()=>{
   if(!selected)return;
   stopScan();
   run(async()=>{
    await request({comando,id:selected.id,zona:form.zona.value.trim()});
    select(null);form.reset();
    status.textContent=comando==='conferma'?'Movimento registrato':'Movimento annullato';
    await refresh();
    if(comando==='conferma'&&typeof analyzeTray==='function')analyzeTray(document.getElementById('c_vassoio_target').value);
   });
  };
 }
})();

