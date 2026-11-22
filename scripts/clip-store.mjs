import { execFile } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { copyFile, link, mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify, isDeepStrictEqual } from 'node:util';
import { shotManifest, totalDuration, validateProject } from '../src/model.js';
import { clipsForAragiExport, projectFromAragiPlan } from '../src/aragi-plan.js';

const run = promisify(execFile);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const missing = () => Object.assign(new Error('Batch atau klip tidak ditemukan.'), {status:404});
const conflict = message => Object.assign(new Error(message), {status:409});

async function atomicJSON(file, data) {
  const tmp = file + '.' + randomUUID() + '.tmp';
  try {
    await writeFile(tmp, JSON.stringify(data));
    await rename(tmp, file);
  } finally {
    await rm(tmp, {force:true});
  }
}
async function jsonFile(file) {
  try { return JSON.parse(await readFile(file, 'utf8')); }
  catch (err) { if (err.code === 'ENOENT') throw missing(); throw err; }
}
function assetInventory(project) {
  const assets = new Map();
  function record(actorId, shotId, uri, name) {
    if (!uri) return;
    const comma = uri.indexOf(',');
    const data = Buffer.from(uri.slice(comma + 1), 'base64');
    const sha256 = hash(data);
    if (!assets.has(sha256)) assets.set(sha256, {
      sha256, bytes:data.length, mime:uri.slice(5, uri.indexOf(';')), uses:[]
    });
    assets.get(sha256).uses.push({actorId, shotId, name});
  }
  for (const a of project.actors) {
    record(a.id, null, a.image, a.imageName);
    record(a.id, null, a.asset, a.assetName);
  }
  for (const s of project.shots) for (const state of s.states || []) record(state.actorId, s.id, state.image, state.imageName);
  return [...assets.values()];
}

function clipPlan(project, clips, mode, width, height) {
  const [ratioW, ratioH] = project.aspect.split(':').map(Number);
  if (!['clean','breakdown'].includes(mode)) throw new Error('Jenis keluaran tidak dikenal.');
  if (![width,height].every(n => Number.isSafeInteger(n) && n >= 64 && n <= 1920 && n % 2 === 0)) throw new Error('Ukuran video tidak valid.');
  if (mode === 'clean' ? width * ratioH !== height * ratioW : width * 9 !== height * 16) throw new Error('Rasio frame berbeda dari rasio keluaran.');
  if (!Array.isArray(clips) || !clips.length || clips.length > 1800) throw new Error('Daftar klip tidak valid.');
  if (project.aragiPlan) {
    const approved = clipsForAragiExport(project);
    if (!isDeepStrictEqual(approved, clips)) throw new Error('Pembagian klip atau arahan berbeda dari plan Aragi.');
  }
  const shots = shotManifest(project);
  const ids = new Set();
  let cursor = 0;
  const result = clips.map((clip, i) => {
    if (!clip || typeof clip.id !== 'string' || !clip.id.trim() || clip.id.length > 160 || ids.has(clip.id)) throw new Error('ID klip kosong atau duplikat.');
    if (clip.order !== i+1 || clip.startFrame !== cursor || !Number.isSafeInteger(clip.endFrameExclusive) || clip.endFrameExclusive <= cursor) throw new Error('Urutan atau batas frame klip tidak valid.');
    if (!Array.isArray(clip.shotIds) || !clip.shotIds.length || clip.shotIds.some(id => typeof id !== 'string' || !id || id.length > 160)) throw new Error('Pemetaan ID shot tidak lengkap.');
    ids.add(clip.id);
    cursor = clip.endFrameExclusive;
    const sourceShots = [];
    shots.forEach((shot, j) => {
      // The shot active at frame f owns f/fps. A fractional cut starts on the next frame.
      const first = Math.ceil(shot.project_raw_in * project.fps - 1e-7);
      const last = Math.ceil(shot.project_raw_out * project.fps - 1e-7);
      const startFrame = Math.max(first,clip.startFrame);
      const endFrameExclusive = Math.min(last,clip.endFrameExclusive);
      if (startFrame < endFrameExclusive) sourceShots.push({
        id:project.shots[j].id, editShotId:shot.shot_id, sequenceId:shot.sequence_id, jobId:shot.job_id,
        startFrame,endFrameExclusive, clipInFrame:startFrame-clip.startFrame, clipOutFrameExclusive:endFrameExclusive-clip.startFrame
      });
    });
    if (!sourceShots.length) throw new Error('Klip di luar rentang timeline.');
    if (!project.aragiPlan && !isDeepStrictEqual(clip.shotIds,sourceShots.map(s=>s.id))) throw new Error('ID shot klip berbeda dari urutan timeline.');
    const {id,order,startFrame,endFrameExclusive,shotIds,direction='',continuesPrevious=false} = clip;
    if (typeof direction!=='string' || direction.length>12000 || typeof continuesPrevious!=='boolean') throw new Error('Arahan atau status sambungan klip tidak valid.');
    return {id,clipId:id,order,startFrame,endFrameExclusive,shotIds,direction,continuesPrevious,sourceShots,
      warkaiShotIds:sourceShots.map(s=>s.id),frames:endFrameExclusive-startFrame,
      durationSeconds:(endFrameExclusive-startFrame)/project.fps,startSeconds:startFrame/project.fps,endSeconds:endFrameExclusive/project.fps};
  });
  if (cursor !== Math.round(totalDuration(project)*project.fps)) throw new Error('Timeline telah berubah. Periksa ulang pembagian klip.');
  return result;
}
async function probeVideo(ffprobe, file, expected) {
  const {stdout} = await run(ffprobe, ['-v','error','-select_streams','v:0','-count_packets','-show_entries','stream=codec_name,width,height,avg_frame_rate,nb_frames,nb_read_packets,duration','-of','json',file],{timeout:120000,maxBuffer:65536});
  const stream = JSON.parse(stdout).streams?.[0];
  const [num, den] = String(stream?.avg_frame_rate).split('/').map(Number);
  const frames = Number(stream?.nb_frames), fps = num / den, durationSeconds = Number(stream?.duration);
  if (stream?.codec_name !== 'h264' || Number(stream.nb_read_packets) !== frames || frames !== expected.frames || fps !== expected.fps ||
      stream.width !== expected.width || stream.height !== expected.height || !Number.isFinite(durationSeconds) ||
      Math.abs(durationSeconds - frames/fps) > 0.00001) throw new Error('Hasil MP4 tidak sesuai frame, ukuran, atau durasi yang diminta.');
  const digest = createHash('sha256');
  for await (const chunk of createReadStream(file)) digest.update(chunk);
  return {codec:'h264',width:stream.width,height:stream.height,frames,fps,durationSeconds,bytes:(await stat(file)).size,sha256:digest.digest('hex')};
}

export function clipStore(root, ffmpeg) {
  const base = path.join(root, '.local', 'previz-batches');
  const ffprobe = process.env.WARKAI_FFPROBE || (ffmpeg && path.isAbsolute(ffmpeg) ? path.join(path.dirname(ffmpeg), 'ffprobe') : 'ffprobe');
  const batchDir = id => {
    if (!uuid.test(id)) throw missing();
    return path.join(base,id);
  };
  const batchUrl = id => '/api/previz/batches/' + id;
  const readPlan = id => jsonFile(path.join(batchDir(id),'plan.json'));

  async function readResult(id, order) {
    try { return await jsonFile(path.join(batchDir(id), 'clip-'+order+'.json')); }
    catch (err) { if (err.status === 404) return null; throw err; }
  }
  async function status(id, jobs) {
    const plan = await readPlan(id);
    const clips = [];
    for (const clip of plan.clips) {
      const result = await readResult(id,clip.order);
      const job = [...jobs.values()].find(job => job.binding?.batchId === id && job.binding?.order === clip.order && !job.error && !job.stopping && !job.published);
      clips.push({...clip, status:result?'ready':job?'rendering':'pending', ...(result ? {url:result.url,measured:result.measured}
        : job ? {received:job.received,cancelUrl:'/api/render/'+job.id} : {})});
    }
    const ready = clips.filter(c=>c.status==='ready').length;
    return {...plan,clips,status:ready === clips.length?'ready':clips.some(c=>c.status==='rendering')?'rendering':ready?'partial':'pending',
      manifestUrl:batchUrl(id),snapshotUrl:batchUrl(id)+'/snapshot',studioUrl:'/?batch='+id};
  }
  async function create(input, jobs) {
    if (!ffmpeg) throw new Error('FFmpeg diperlukan untuk mengekspor klip.');
    try { await run(ffprobe,['-version'],{timeout:5000}); }
    catch { throw new Error('ffprobe diperlukan untuk mengukur hasil MP4. Atur WARKAI_FFPROBE bila perlu.'); }
    if (!input || Boolean(input.plan) === Boolean(input.project)) throw new Error('Berikan satu plan Aragi atau satu proyek studio.');
    const project = input.plan ? projectFromAragiPlan(input.plan) : validateProject(input.project);
    const {mode='clean',width,height} = input;
    const requested = input.clips ?? (project.aragiPlan ? clipsForAragiExport(project) : null);
    const clips = clipPlan(project,requested,mode,width,height);
    const bytes = JSON.stringify(project), revision = hash(bytes);
    const id = randomUUID(), dir = batchDir(id);
    await mkdir(dir,{recursive:true});
    try {
      await writeFile(path.join(dir,'snapshot.json'),bytes,{flag:'wx'});
      const plan = {schema:'warkai.previz.batch.v1',id,createdAt:new Date().toISOString(),projectName:project.name,revision,
        mode,aspect:project.aspect,outputAspect:mode==='clean'?project.aspect:'16:9',width,height,fps:project.fps,
        assets:assetInventory(project),visualReview:'pending',clips};
      if (project.aragiPlan) {
        const {schema,storyHash,requirements,target,mode} = project.aragiPlan;
        plan.sourcePlan = {schema,storyHash,requirements,target,mode};
      }
      await atomicJSON(path.join(dir,'plan.json'),plan);
      return await status(id,jobs);
    } catch (err) { await rm(dir,{recursive:true,force:true}); throw err; }
  }
  async function bind(batchId,clipId,parameters) {
    const plan = await readPlan(batchId);
    const clip = plan.clips.find(c=>c.clipId===clipId);
    if (!clip) throw missing();
    if (await readResult(batchId,clip.order)) throw conflict('Klip sudah selesai dan tersimpan.');
    if (parameters.frames !== clip.frames || parameters.width !== plan.width || parameters.height !== plan.height || parameters.fps !== plan.fps) throw new Error('Parameter render berbeda dari snapshot.');
    return {batchId,order:clip.order,clipId};
  }
  async function publish(job) {
    const {batchId,order} = job.binding, dir = batchDir(batchId);
    const measured = await probeVideo(ffprobe,job.file,job);
    const file = 'clip-'+order+'-'+job.id+'.mp4';
    const dest = path.join(dir,file);
    const result = {url:batchUrl(batchId)+'/clips/'+order+'/video',measured};
    const descriptor = path.join(dir,'clip-'+order+'.json');
    // The descriptor is the commit point. Readers only see fully copied media.
    const tmp = descriptor+'.'+randomUUID()+'.tmp';
    try {
      await copyFile(job.file, dest);
      await writeFile(tmp,JSON.stringify({...result,file}));
      await link(tmp,descriptor);
    } catch(err) {
      await rm(dest,{force:true});
      if (err.code === 'EEXIST') throw conflict('Klip sudah dipublikasikan.');
      throw err;
    } finally { await rm(tmp,{force:true}); }
    return result;
  }
  async function handle(req,res,parts,body,json,jobs) {
    if (parts[2] !== 'batches') throw missing();
    const id = parts[3];
    if (!id && req.method === 'POST') return json(res,201,await create(JSON.parse((await body(req,34*1024*1024)).toString()),jobs));
    if (req.method !== 'GET') throw missing();
    if (!id) {
      const entries = await readdir(base).catch(err=>{if(err.code==='ENOENT')return [];throw err;});
      const batches=[];
      for (const id of entries.filter(name=>uuid.test(name))) {
        let plan;
        try { plan = await readPlan(id); } catch (err) { if (err.status===404) continue;throw err; }
        batches.push({id,createdAt:plan.createdAt,projectName:plan.projectName,mode:plan.mode,manifestUrl:batchUrl(id)});
      }
      return json(res,200,{batches:batches.sort((a,b)=>b.createdAt.localeCompare(a.createdAt))});
    }
    if (parts.length===4) return json(res,200,await status(id,jobs));
    if (parts[4]==='snapshot' && parts.length===5) return json(res,200,await jsonFile(path.join(batchDir(id),'snapshot.json')));
    if (parts[4]==='clips' && parts[6]==='video' && parts.length===7 && /^[1-9]\d{0,3}$/.test(parts[5])) {
      const result=await readResult(id,Number(parts[5]));
      if(!result) throw missing();
      const file=path.join(batchDir(id),result.file), info=await stat(file);
      res.setHeader('Content-Type','video/mp4');
      res.setHeader('Content-Length',info.size);
      res.setHeader('Content-Disposition','attachment; filename="warkai-clip-'+parts[5]+'.mp4"');
      const stream=createReadStream(file);
      stream.on('error',e=>res.destroy(e));
      res.on('close',()=>stream.destroy());
      return stream.pipe(res);
    }
    throw missing();
  }
  return {handle,bind,publish};
}
