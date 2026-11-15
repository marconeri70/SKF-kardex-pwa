(() => {
 const panel=document.getElementById('movimentiGuidati');
 const form=panel.querySelector('form');
 const status=panel.querySelector('[role=status]');
 const list=panel.querySelector('#movimentiRecenti');
 let request, busy=false, selected;
 const scanButtons=panel.querySelectorAll('[data-scan]');
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
  panel.hidden=!event.detail.logged;
  if(panel.hidden){stopScan();list.replaceChildren();selected=null;form.reset();}
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
  list.replaceChildren();
  for(const movement of movimenti){
   const row=document.createElement('li');
   row.append(movement.azione+' '+movement.quantita+' × '+movement.componente+' · '+movement.ripiano+' / '+movement.posizione+' / '+movement.zona+' · '+movement.stato+' · '+movement.creato_il+(movement.operatore?' · '+movement.operatore:''));
   if(movement.stato==='aperto'){
    const button=document.createElement('button');
    button.type='button';button.className='secondary';button.textContent='Riprendi';
    button.onclick=()=>select(movement);
    row.append(' ',button);
   }
   list.append(row);
  }
 }
 function select(movement){
  selected=movement;
  const target=panel.querySelector('#movimentoDestinazione');
  target.textContent=movement?'Destinazione: '+movement.ripiano+' → '+movement.posizione+' → '+movement.zona:'';
  panel.querySelector('#movimentoConferma').hidden=!movement;
  form.zona.value='';
 }
 let draft;
 form.addEventListener('submit',event=>{
  event.preventDefault();stopScan();
  run(async()=>{
   const data={azione:form.azione.value,quantita:form.quantita.valueAsNumber,pezzo:form.pezzo.value.trim()};
   const key=JSON.stringify(data);
   if(draft?.key!==key)draft={key,id:crypto.randomUUID()};
   const {movimento}=await request({comando:'avvia',id:draft.id,...data});
   draft=null;select(movimento);await refresh();
  });
 });
 for(const comando of ['conferma','annulla']){
  panel.querySelector('[data-command='+comando+']').onclick=()=>{
   if(!selected)return;
   stopScan();
   run(async()=>{
    await request({comando,id:selected.id,zona:form.zona.value.trim()});
    select(null);
    status.textContent=comando==='conferma'?'Movimento registrato':'Movimento annullato';
    await refresh();
    if(comando==='conferma'&&typeof analyzeTray==='function')analyzeTray(document.getElementById('c_vassoio_target').value);
   });
  };
 }
})();
