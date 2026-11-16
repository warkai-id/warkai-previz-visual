export async function readStoryFile(file){
  if(file.size>15*1024*1024)throw new Error('Dokumen maksimal 15 MB.');
  const ext=file.name.split('.').pop().toLowerCase();let text;
  if(['txt','md','text'].includes(ext))text=await file.text();
  else if(ext==='docx'){
    const mod=await import('mammoth/mammoth.browser.js');const mammoth=mod.default||mod;
    text=(await mammoth.extractRawText({arrayBuffer:await file.arrayBuffer()})).value;
  }else if(ext==='pdf'){
    const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');if(typeof window!=='undefined'){const worker=(await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')).default;pdfjs.GlobalWorkerOptions.workerSrc=worker;}
    const task=pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false,useSystemFonts:true});const doc=await task.promise;
    try{if(doc.numPages>100)throw new Error('PDF maksimal 100 halaman.');const pages=[];for(let i=1;i<=doc.numPages;i++){const page=await doc.getPage(i),content=await page.getTextContent();let line='';for(const item of content.items){line+=item.str+(item.hasEOL?'\n':' ');}pages.push(line.trim());}text=pages.join('\n\n');}finally{await task.destroy();}
  }else throw new Error('Gunakan TXT, MD, DOCX atau PDF bertulisan.');
  if(!text?.trim())throw new Error('Teks tidak ditemukan. PDF scan memerlukan OCR; tempel teks hasil OCR.');
  if(text.length>200000)throw new Error('Teks maksimal 200.000 karakter; impor satu sequence dahulu.');
  return text;
}
