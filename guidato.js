(() => {
 const panel=document.getElementById('movimentiGuidati');
 const form=panel.querySelector('form');
 const status=panel.querySelector('[role=status]');
 const list=panel.querySelector('#movimentiRecenti');
 const pending=panel.querySelector('#movimentiAperti');
 const start=panel.querySelector('#movimentoAvvio');
 const step=panel.querySelector('#passaggioGuidato');
 let request, busy=false, selected, draft, expected;
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
  status.textContent='';
  if(!navigator.mediaDevices?.getUserMedia){
   status.textContent='Fotocamera non disponibile. Per continuare serve la scansione.';
   field.focus();return;
  }
  const version=scanVersion;
  try {
   let detector;
   try{if(window.BarcodeDetector)detector=new window.BarcodeDetector({formats:['qr_code']});}catch{}
   const canvas=document.createElement('canvas');
   const context=canvas.getContext('2d',{willReadFrequently:true});
   if(!detector&&(!window.jsQR||!context))throw Error('Lettore QR non disponibile. Per continuare serve la scansione.');
   const camera=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}}});
   if(version!==scanVersion){camera.getTracks().forEach(track=>track.stop());return;}
   stream=camera;video.srcObject=stream;video.hidden=false;await video.play();
   while(version===scanVersion){
    let value;
    if(detector){
     try{value=(await detector.detect(video))[0]?.rawValue;}catch{detector=null;}
    }
    if(!detector){
     if(!window.jsQR||!context)throw Error('Lettore QR non disponibile. Per continuare serve la scansione.');
     if(video.videoWidth&&video.videoHeight){
      const scale=Math.min(1,960/Math.max(video.videoWidth,video.videoHeight));
      canvas.width=Math.round(video.videoWidth*scale);
      canvas.height=Math.round(video.videoHeight*scale);
      context.drawImage(video,0,0,canvas.width,canvas.height);
      const frame=context.getImageData(0,0,canvas.width,canvas.height);
      value=window.jsQR(frame.data,frame.width,frame.height)?.data;
     }
    }
    if(version!==scanVersion)return;
    if(value){
     if(field===form.pezzo&&expected&&value!==expected.pezzo){
      stopScan();status.textContent='QR diverso dal componente selezionato. Scansiona '+expected.nome+'.';return;
     }
     field.value=value;stopScan();field.focus();return;}
    await new Promise(resolve=>setTimeout(resolve,150));
   }
  }catch(error){if(version===scanVersion){stopScan();status.textContent=error.name==='NotAllowedError'?'Consenti l’accesso alla fotocamera e riprova.':error.name==='NotFoundError'?'Fotocamera non trovata. Per continuare serve la scansione.':error.message;}}
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
  if(panel.hidden){expected=null;draft=null;stopScan();list.replaceChildren();pending.replaceChildren();select(null);form.reset();}
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
 window.addEventListener('kardex:guided-start',event=>{
  if(panel.hidden)return;
  panel.open=true;
  panel.scrollIntoView({block:'start'});
  if(busy||selected){status.textContent='Completa o annulla il movimento in corso.';return;}
  stopScan();
  expected=event.detail;
  form.azione.value=expected.azione;
  form.quantita.value=expected.quantita;
  form.pezzo.value='';draft=null;
  step.textContent='1 di 2 · Scansiona '+expected.nome;
  panel.querySelector('[data-scan="codiceMovimentoPezzo"]').focus();
 });
 form.addEventListener('submit',event=>{
  event.preventDefault();if(selected)return;
  if(!form.pezzo.value){status.textContent='Scansiona il QR del componente prima di avviare.';return;}
  stopScan();
  run(async()=>{
   const data={azione:form.azione.value,quantita:form.quantita.valueAsNumber,pezzo:form.pezzo.value.trim()};
   const key=JSON.stringify(data);
   if(draft?.key!==key)draft={key,id:crypto.randomUUID()};
   const {movimento}=await request({comando:'avvia',id:draft.id,...data});
   draft=null;expected=null;select(movimento);form.zona.focus();await refresh();
  });
 });
 for(const comando of ['conferma','annulla']){
  panel.querySelector('[data-command='+comando+']').onclick=()=>{
   if(!selected)return;
   if(comando==='conferma'&&!form.zona.value){status.textContent='Scansiona il QR della zona prima di confermare.';return;}
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

