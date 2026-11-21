import { validateProject } from './model.js';

const batchesUrl = '/api/previz/batches';
async function json(request, url, options) {
  const response = await request(url, options);
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || 'HTTP ' + response.status);
  return payload;
}
function postJSON(value) {
  return {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(value)};
}
async function png(surface) {
  if (surface instanceof Blob) return surface;
  if (surface?.convertToBlob) return surface.convertToBlob({type:'image/png'});
  if (!surface?.toBlob) throw new Error('Frame kamera belum tersedia.');
  const image = await new Promise(resolve => surface.toBlob(resolve,'image/png'));
  if (!image) throw new Error('Frame PNG gagal dibuat.');
  return image;
}

async function renderClips(batch, project, {captureFrame, prepareProject, onProgress, signal, request = fetch}) {
  if (typeof captureFrame !== 'function') throw new Error('Renderer frame belum tersedia.');
  try {
    await prepareProject?.(project);
    for (const clip of batch.clips) {
      if (clip.status === 'ready') continue;
      const progress = received => onProgress?.({
        batchId:batch.id,clipId:clip.clipId,order:clip.order,received,frames:clip.frames,clipCount:batch.clips.length
      });
      progress(0);
      signal?.throwIfAborted();
      const {width,height,fps} = batch;
      const job = await json(request,'/api/render',postJSON({width,height,fps,frames:clip.frames,batchId:batch.id,clipId:clip.clipId}));
      const jobUrl = '/api/render/'+job.id;
      try {
        for (let index=0; index<clip.frames; index++) {
          signal?.throwIfAborted();
          const sourceFrame = clip.startFrame+index;
          const frame = await captureFrame(sourceFrame/fps,{project,mode:batch.mode,sourceFrame,clip,width,height});
          const image = await png(frame);
          await json(request,jobUrl+'/frame?index='+index,{method:'POST',body:image,signal});
          progress(index+1);
        }
        signal?.throwIfAborted();
        await json(request,jobUrl+'/finish',{method:'POST',signal});
      } finally {
        // The published clip lives in the batch. This releases the temporary encoder file.
        await request(jobUrl,{method:'DELETE'}).catch(()=>{});
      }
    }
    return await json(request,batch.manifestUrl);
  } catch (err) {
    // Preserve the batch ID even if cancellation happens before the first frame.
    const failure = new Error(err.message,{cause:err});
    failure.name = err.name;
    failure.batchId = batch.id;
    failure.manifestUrl = batch.manifestUrl;
    throw failure;
  }
}

export async function exportClipBatch({project,clips,mode='clean',width,height,...options}) {
  const snapshot = validateProject(project);
  options.signal?.throwIfAborted();
  const batch = await json(options.request || fetch,batchesUrl,postJSON({project:snapshot,clips,mode,width,height}));
  return renderClips(batch,snapshot,options);
}
export async function resumeClipBatch({batchId,...options}) {
  const request = options.request || fetch;
  const batch = await json(request,batchesUrl+'/'+encodeURIComponent(batchId));
  if (batch.status === 'ready') return batch;
  const snapshot = await json(request,batch.snapshotUrl);
  return renderClips(batch,snapshot,options);
}
