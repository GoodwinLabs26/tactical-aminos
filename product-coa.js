let activeUrl=null,generation=0;
export function resetCoaPreview(){generation++;if(activeUrl)URL.revokeObjectURL(activeUrl);activeUrl=null;}
export async function loadProductCoa(button,getService){
  const result=document.getElementById('productCoaResult');resetCoaPreview();const token=generation;
  button.disabled=true;result.textContent='Loading COA…';
  try{
    const api=await getService();if(token!==generation)return;
    const response=await api.getProductCoa(button.dataset.loadCoa);if(token!==generation)return;
    if(!response.coa){result.textContent='No COA has been uploaded for this product yet. Contact tacticalaminos@gmail.com for availability.';return;}
    
    const {title,lot,base64}=response.coa;
    const mimeType=response.coa.mimeType||'application/pdf';
    const extension=mimeType==='image/png'?'png':mimeType==='image/jpeg'?'jpg':'pdf';
    const bytes=Uint8Array.from(atob(base64),c=>c.charCodeAt(0));
    activeUrl=URL.createObjectURL(new Blob([bytes],{type:mimeType}));
    result.replaceChildren();const heading=document.createElement('p');heading.textContent=title+(lot?' · Batch / lot: '+lot:'');result.append(heading);
    if(mimeType.startsWith('image/')){
      const image=document.createElement('img');
      image.src=activeUrl;image.alt=title;
      image.style.cssText='display:block;max-width:100%;height:auto;margin:16px 0';
      result.append(image);
    }
    const link=document.createElement('a');link.href=activeUrl;link.target='_blank';link.rel='noopener noreferrer';link.className='button';link.textContent='Open COA';result.append(link);
    const download=document.createElement('a');download.href=activeUrl;download.download='COA-'+button.dataset.loadCoa+'.'+extension;download.textContent='Download COA';download.style.marginLeft='16px';result.append(download);
  }catch{if(token===generation)result.textContent='Unable to load this COA. Please try again or contact us.';}
  finally{if(token===generation)button.disabled=false;}
}
