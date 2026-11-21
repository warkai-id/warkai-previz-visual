import { createDemo, makeShot, validateProject } from './model.js';

export const ARAGI_PLAN_SCHEMA = 'aragi.previz.plan.v1';
const ratios = ['16:9', '9:16', '4:3', '1:1', '21:9', '48:9'];

function requirePlan(condition, message) {
  if (!condition) throw new Error('Plan Aragi tidak valid. ' + message);
}
const boundedText = (s, max) => typeof s === 'string' && s.length <= max;
const validId = id => typeof id === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.-]{0,95}$/.test(id);
const positiveInteger = n => Number.isSafeInteger(n) && n > 0;

export function validateAragiPlan(plan) {
  requirePlan(plan?.schema === ARAGI_PLAN_SCHEMA, 'Periksa versi berkas plan.');
  requirePlan(plan.fps === 24 && ratios.includes(plan.ratio), 'Plan v1 menggunakan 24 fps dan rasio studio.');
  requirePlan(['auto','manual'].includes(plan.mode), 'Mode pembagian klip harus auto atau manual.');
  requirePlan(typeof plan.storyHash === 'string' && /^[a-f0-9]{64}$/.test(plan.storyHash), 'Sidik cerita sumber hilang.');
  requirePlan(boundedText(plan.requirements, 2000), 'Periksa teks kebutuhan produksi.');
  requirePlan(positiveInteger(plan.durationSeconds) && plan.durationSeconds <= 1800, 'Durasi proyek lokal harus 1–1800 detik.');

  const target = plan.target;
  requirePlan(target && validId(target.id) && boundedText(target.label, 160) && target.label.trim()
    && validId(target.provider), 'Identitas profil model tidak lengkap.');
  requirePlan(Array.isArray(target.ratios) && target.ratios.length <= ratios.length
    && target.ratios.every(ratio => ratios.includes(ratio)) && target.ratios.includes(plan.ratio), 'Rasio berbeda dari profil model.');
  requirePlan(positiveInteger(target.minSeconds) && positiveInteger(target.maxSeconds)
    && target.minSeconds <= target.maxSeconds, 'Rentang durasi keluaran profil tidak valid.');
  requirePlan(target.referenceSeconds === null || positiveInteger(target.referenceSeconds), 'Batas referensi harus berupa detik atau null.');
  requirePlan(positiveInteger(target.maxVideoReferences) && Array.isArray(target.resolutions)
    && target.resolutions.length > 0 && target.resolutions.every(r => boundedText(r,64)), 'Metadata referensi/resolusi model tidak lengkap.');

  requirePlan(Array.isArray(plan.shots) && plan.shots.length > 0 && plan.shots.length <= 120,
    'Studio mendukung 1–120 shot. Bagi plan lebih panjang per sequence.');
  const shotOrder = new Map();
  for (const [i, shot] of plan.shots.entries()) {
    requirePlan(validId(shot?.id) && !shotOrder.has(shot.id), 'Periksa ID shot sumber yang kosong atau ganda.');
    requirePlan(boundedText(shot.text, 12000) && shot.text.trim(), 'Teks shot harus berisi 1–12000 karakter.');
    shotOrder.set(shot.id, i);
  }
  requirePlan(plan.shots.reduce((n,s) => n + s.text.length, 0) <= 24000, 'Teks sumber plan v1 melebihi 24.000 karakter.');
  requirePlan(Array.isArray(plan.clips) && plan.clips.length > 0 && plan.clips.length <= plan.durationSeconds, 'Daftar klip tidak valid.');
  const clipIds = new Set();
  let cursor = 0, previousShot = -1;
  for (const [i, clip] of plan.clips.entries()) {
    requirePlan(validId(clip?.id) && !clipIds.has(clip.id) && clip.order === i+1, 'Periksa urutan atau ID klip.');
    const label = clip.id + ' · ';
    clipIds.add(clip.id);
    requirePlan(clip.status === 'planned' && boundedText(clip.direction, 400), label + 'Status atau arahan klip tidak valid.');
    requirePlan(clip.startFrame === cursor && Number.isSafeInteger(clip.endFrameExclusive) && clip.endFrameExclusive > cursor,
      label + 'Rentang frame harus sambung tanpa celah atau tumpang tindih.');
    const frames = clip.endFrameExclusive - cursor;
    requirePlan(cursor === clip.startSeconds*plan.fps && clip.endFrameExclusive === clip.endSeconds*plan.fps
      && typeof clip.startSeconds === 'number' && typeof clip.endSeconds === 'number'
      && positiveInteger(clip.durationSeconds) && frames === clip.durationSeconds * plan.fps, label + 'Timecode dan durasi berbeda.');
    requirePlan(clip.durationSeconds >= target.minSeconds && clip.durationSeconds <= target.maxSeconds, label + 'Durasi di luar batas keluaran profil.');
    requirePlan(target.referenceSeconds === null || clip.durationSeconds <= target.referenceSeconds, label + 'Durasi melebihi batas referensi profil.');
    requirePlan(Array.isArray(clip.shotIds) && clip.shotIds.length > 0 && clip.shotIds.length <= Math.min(frames,plan.shots.length),
      label + 'Setiap shot yang dirujuk memerlukan minimal satu frame.');
    const first = shotOrder.get(clip.shotIds[0]);
    requirePlan(typeof clip.continuesPrevious === 'boolean'
      && first === previousShot + (clip.continuesPrevious ? 0 : 1), label + 'Shot sambungan atau urutannya berbeda.');
    clip.shotIds.forEach((id,k) => requirePlan(shotOrder.get(id) === first+k, label + 'Rujukan shot hilang, ganda atau melompati shot.'));
    previousShot = first + clip.shotIds.length - 1;
    cursor = clip.endFrameExclusive;
  }
  requirePlan(previousShot === plan.shots.length - 1 && cursor === plan.durationSeconds * plan.fps, 'Klip belum mencakup seluruh shot dan durasi.');
  return plan;
}

// Aragi assigns membership by word count but does not send frame-accurate cuts within a clip.
// Estimate those cuts only. Every supplied clip boundary and continuation stays exact.
function draftShotFrames(plan) {
  const weights = plan.shots.map(s => s.text.trim().split(/\s+/u).length);
  const total = weights.reduce((a,b) => a+b);
  const endFrames = new Map();
  let weight = 0;
  plan.shots.forEach((s,i) => {
    weight += weights[i];
    endFrames.set(s.id, Math.round(plan.durationSeconds * plan.fps * weight / total));
  });
  const counts = new Map();
  for (const clip of plan.clips) {
    let frame = clip.startFrame;
    clip.shotIds.forEach((id, i) => {
      const remaining = clip.shotIds.length - i - 1;
      const end = remaining ? Math.max(frame+1, Math.min(endFrames.get(id), clip.endFrameExclusive-remaining)) : clip.endFrameExclusive;
      counts.set(id, (counts.get(id) || 0) + end-frame);
      frame = end;
    });
  }
  return counts;
}

export function projectFromAragiPlan(input, {name = 'Previz Aragi'} = {}) {
  const plan = structuredClone(validateAragiPlan(input));
  const project = createDemo();
  project.name = name;
  project.aragiPlan = plan;
  project.aspect = plan.ratio;
  project.fps = plan.fps;
  project.description = plan.requirements;
  project.sourceStory = {
    name:'Aragi · ' + plan.storyHash.slice(0,12),
    text:plan.shots.map(s => s.text).join('\n'),
    method:'Teks per shot dari plan Aragi. Pemisah paragraf dokumen asal tidak dikirim.',
  };
  project.setting = 'Panggung netral. Director mengatur lokasi dan properti dari cerita sumber.';
  project.actors = [{id:'pill-001', characterTag:'CHAR_001', name:'Karakter 01', type:'pill-person',
    color:'#3389bc', position:[0,0,0], rotation:0, scale:1, visible:true}];
  project.light = {...project.light, preset:'studio'};
  project.shots = [];
  const counts = draftShotFrames(plan);
  let cursor = 0;
  for (const source of plan.shots) {
    let remaining = counts.get(source.id), part = 0;
    while (remaining) {
      // An uninterrupted source beat can span several provider clips and exceed a local shot's 60 s ceiling.
      const frames = Math.min(remaining, 60*plan.fps);
      const shot = makeShot(project.shots.length+1);
      shot.id = 'aragi-' + source.id + ':' + (++part);
      shot.name = source.id + ' · ' + source.text.slice(0,58);
      shot.sourceShotId = source.id;
      shot.action = source.text;
      shot.purpose = '';
      shot.sound = '';
      shot.duration = frames / plan.fps;
      shot.edit = {sequence_id:'SQ01', job_id:'J01', shot_id:source.id, raw_in:0, raw_out:shot.duration, sequence_in:cursor / plan.fps};
      shot.camera.movement = 'static';
      shot.camera.end = structuredClone(shot.camera.start);
      shot.notes = '';
      project.shots.push(shot);
      cursor += frames;
      remaining -= frames;
    }
  }
  return validateProject(project);
}

export function clipsForAragiExport(project) {
  const plan = validateAragiPlan(project.aragiPlan);
  const stale = reason => { throw new Error('Ekspor klip Aragi tertahan. ' + reason + ' Pulihkan timeline sesuai plan atau impor plan yang direvisi.'); };
  if (project.fps !== plan.fps || project.aspect !== plan.ratio) stale('FPS atau rasio proyek berubah.');
  let cursor = 0;
  const timeline = project.shots.map(shot => {
    const frames = Math.round(shot.duration * plan.fps), start = cursor;
    if (frames < 1 || Math.abs(shot.duration*plan.fps-frames) > 1e-5
      || Math.abs(shot.edit.raw_in) > 1e-8 || Math.abs(shot.edit.raw_out-shot.duration) > 1e-8
      || Math.abs(shot.edit.sequence_in*plan.fps-start) > 1e-5) stale('Trim/penempatan ' + shot.name + ' berbeda dari waktu rencana.');
    cursor += frames;
    return {shot, start, end:cursor};
  });
  if (cursor !== plan.durationSeconds * plan.fps) stale('Durasi timeline berubah.');
  return plan.clips.map(clip => {
    const selected = timeline.filter(s => s.start < clip.endFrameExclusive && s.end > clip.startFrame);
    const ids = selected.map(s => s.shot.sourceShotId).filter((id,i,all) => i === 0 || id !== all[i-1]);
    if (ids.length !== clip.shotIds.length || ids.some((id,i) => id !== clip.shotIds[i])) stale('Pemetaan shot pada ' + clip.id + ' berubah.');
    return {...structuredClone(clip), clipId:clip.id, warkaiShotIds:selected.map(s => s.shot.id)};
  });
}

export function aragiWarnings(project) {
  if (!project.aragiPlan) return [];
  const warnings = [];
  try {
    clipsForAragiExport(project);
  } catch (err) {
    warnings.push(err.message);
    if (!Array.isArray(project.aragiPlan.clips)) return warnings;
  }
  if (project.aragiPlan.target?.referenceSeconds === null) warnings.push('Batas durasi video referensi belum tercantum dalam profil model. Periksa sebelum generate.');
  if (project.actors.some(a => a.id === 'pill-001' && a.name === 'Karakter 01')) warnings.push('Tentukan pemeran untuk Karakter 01. Plan v1 hanya memasok teks dan ID shot.');
  if (project.aragiPlan.clips?.some(c => c.shotIds?.length > 1)) warnings.push('Periksa titik potong antar-shot dalam klip. Waktu potong awal mengikuti bobot kata sumber.');
  return warnings;
}
