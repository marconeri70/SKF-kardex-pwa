window.kardexDownloadQr = async function(payload,label,status,button){
 const doc=button.ownerDocument;
 button.disabled=true;
 try{
  if(typeof QRCode==='undefined')throw Error('Generatore PNG non disponibile. Ricarica la pagina e riprova.');
  const holder=doc.createElement('div');
  new QRCode(holder,{text:payload,width:512,height:512,correctLevel:QRCode.CorrectLevel.M});
  const source=holder.querySelector('canvas');
  if(!source)throw Error('Impossibile creare il QR.');
  const canvas=doc.createElement('canvas');
  const border=96;
  canvas.width=source.width+2*border;
  canvas.height=source.height+2*border;
  const context=canvas.getContext('2d');
  context.fillStyle='#fff';
  context.fillRect(0,0,canvas.width,canvas.height);
  context.drawImage(source,border,border);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
  if(!blob)throw Error('Creazione PNG non riuscita.');
  const url=URL.createObjectURL(blob);
  const link=doc.createElement('a');
  link.href=url;
  link.download='SKF-QR-'+label.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/gi,'-').replace(/^-+|-+$/g,'')+'.png';
  doc.body.append(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),60000);
  status.textContent='Download PNG avviato.';
 }catch(error){status.textContent=error.message;}
 finally{button.disabled=false;}
};
