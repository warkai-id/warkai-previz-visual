export const SCHEMA = 'warkai-previz/1';
export const STATE_SCHEMA = 'warkai-previz/2';
export const clone = (v) => structuredClone(v);
export const uid = (prefix = 'item') => `${prefix}-${globalThis.crypto.randomUUID().slice(0, 8)}`;
export const isCharacter = a => ['pill','pill-person'].includes(a.type) || a.type==='glb'&&a.role==='character';
export function nextCharacterIdentity(actors) {
  const tags=new Set(actors.map(a=>a.characterTag)),names=new Set(actors.map(a=>a.name.trim().toLowerCase()));let n=1;
  while(tags.has(`CHAR_${String(n).padStart(3,'0')}`))n++;
  let name=`Karakter ${String(n).padStart(2,'0')}`;let suffix=2;while(names.has(name.toLowerCase()))name=`Karakter ${String(n).padStart(2,'0')} (${suffix++})`;
  return {name,characterTag:`CHAR_${String(n).padStart(3,'0')}`};
}
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const mix = (a, b, t) => t <= 0 ? a : t >= 1 ? b : a + (b - a) * t;
export const mix3 = (a, b, t) => a.map((v, i) => mix(v, b[i], t));
export const totalDuration = (p) => p.shots.reduce((n, s) => n + s.duration, 0);
export const shotOffset = (p, id) => p.shots.slice(0, p.shots.findIndex((s) => s.id === id)).reduce((n, s) => n + s.duration, 0);
export function locateShot(p, time) {
  let cursor = 0;
  const t = clamp(time, 0, totalDuration(p));
  for (let i = 0; i < p.shots.length; i++) {
    const shot = p.shots[i];
    // Decimal seconds such as .8 + .9 must cut at frame 51 / 30,
    // even when the sum is represented as 1.7000000000000002.
    if (t < cursor + shot.duration - 1e-8 || i === p.shots.length - 1) return { shot, index: i, localTime: clamp(t - cursor, 0, shot.duration), offset: cursor };
    cursor += shot.duration;
  }
}
const frame = (position, target, lens = 35) => ({ position, target, lens });
export function makeShot(n = 1) {
  return { id: uid('shot'), name: `Shot ${String(n).padStart(2, '0')}`, duration: 5, size: 'MS', purpose: 'Reveal the subject and establish a clear action.', action: 'The subject waits, then turns toward the light.', sound: 'Subtle room tone. No dialogue or narration.', notes: '', edit: { sequence_id: 'SQ01', job_id: 'J01', shot_id: `${String(n).padStart(2, '0')}A`, raw_in: 0, raw_out: 5, sequence_in: 0 }, camera: { movement: 'dolly', easing: 'smooth', start: frame([5, 2.5, 8], [0, 1.2, 0], 35), end: frame([3.4, 1.8, 5.5], [0, 1.3, 0], 50), aperture: 2.8, focus: 6 }, blocking: [] };
}
export function createDemo(kind = 'signal') {
  const actors = [
    { id: 'actor-a', name: 'A · Penjelajah', type: 'pill', color: '#e5aa57', position: [-1.9, 0, 0.8], rotation: 20, scale: 1, visible: true },
    { id: 'actor-b', name: 'B · Penjaga', type: 'pill', color: '#66959b', position: [1.6, 0, -1.4], rotation: -25, scale: 1, visible: true },
    { id: 'bench', name: 'Bangku', type: 'bench', color: '#9e7e61', position: [-2, 0, -1.7], rotation: 0, scale: 1, visible: true },
    { id: 'portal', name: 'Instalasi orbital', type: 'rings', color: '#667879', position: [1.3, 0, -3.6], rotation: 0, scale: 1, visible: true },
    { id: 'pillar-a', name: 'Pilar kiri', type: 'column', color: '#c8beab', position: [-4, 0, -3.5], rotation: 0, scale: 1, visible: true },
    { id: 'pillar-b', name: 'Pilar kanan', type: 'column', color: '#c8beab', position: [4, 0, -3.5], rotation: 0, scale: 1, visible: true },
  ];
  const shots = [makeShot(1), makeShot(2), makeShot(3), makeShot(4)];
  Object.assign(shots[0], { name: 'Sebuah pertemuan', size: 'WS', duration: 6, purpose: 'Establish the distance between two strangers.', action: 'The amber explorer takes two slow steps toward the teal guardian. The guardian remains still.' });
  shots[0].camera.start = frame([7.5, 4.4, 10], [0, 1, -0.8], 32);
  shots[0].camera.end = frame([5.8, 3, 8.5], [0, 1, -0.8], 35);
  shots[0].blocking = [{ actorId: 'actor-a', start: [-1.9, 0, 0.8], end: [-0.8, 0, 0.2], action: 'walk' }];
  Object.assign(shots[1], { name: 'Tatapan penjaga', size: 'MCU', duration: 4, purpose: 'Read the guardian’s response.', action: 'The teal guardian leans slightly forward, looking at the explorer.' });
  shots[1].camera.start = frame([2.8, 1.9, 2], [1.6, 1.35, -1.4], 65);
  shots[1].camera.end = frame([2.5, 1.8, 1.4], [1.6, 1.4, -1.4], 75);
  Object.assign(shots[2], { name: 'Mengitari sinyal', size: 'MS', duration: 5, purpose: 'Reveal the orbital installation behind the guardian.', action: 'The orbital rings rotate slowly. Both characters hold their ground.' });
  shots[2].camera.movement = 'orbit';
  shots[2].camera.start = frame([5.8, 2.9, 2], [1.3, 1.35, -2.4], 38);
  shots[2].camera.end = frame([-2.5, 3.2, 2.8], [1.3, 1.35, -2.4], 38);
  Object.assign(shots[3], { name: 'Ruang yang terbuka', size: 'EWS', duration: 6, purpose: 'End on a spatial reveal.', action: 'The explorer and guardian remain facing each other as the camera rises. The rings continue to rotate.' });
  shots[3].camera.movement = 'crane';
  shots[3].camera.start = frame([3.5, 2.2, 6], [0.3, 1.1, -1], 30);
  shots[3].camera.end = frame([7, 9, 11], [0.3, 0.6, -1], 28);
  const p = { schema: SCHEMA, name: 'The quiet signal', description: 'Dua sosok bertemu di sebuah ruang terbuka. Sebuah instalasi orbital mulai bergerak.', setting: 'An open concrete courtyard with two stone columns, a wooden bench and an orbital sculpture. Ground plane at y=0. Units in meters.', aspect: '16:9', fps: 24, light: { preset: 'golden', intensity: 3.5, azimuth: -35, elevation: 45, background: '#dedbd0', ground: '#c9c3b3' }, actors, shots };
  if (kind === 'reference') {
    p.name = 'Pill action study'; p.aspect = '4:3'; p.description = 'Studi graybox: kapsul, kursi, dan efek orbital. Terinspirasi video referensi Mas Ardi; bukan rekonstruksi persis.';
    p.light = { preset: 'overcast', intensity: 2.8, azimuth: 20, elevation: 55, background: '#b0b5bd', ground: '#8b919a' };
    p.actors[0].color = '#c74a53'; p.actors[1].color = '#588dc6'; p.actors[2].type = 'chair';
    p.shots[0].duration = 4; p.shots[1].duration = 3; p.shots[2].duration = 4; p.shots[3].duration = 4;
  }
  let cursor = 0;
  for (const s of p.shots) { s.edit.raw_out = s.duration; s.edit.sequence_in = cursor; cursor += s.duration; }
  return p;
}
export function shotManifest(p) {
  const cursors = new Map(); let projectTime = 0;
  return p.shots.map((s) => {
    const e = s.edit, key = `${e.sequence_id}/${e.job_id}`, jobStart = cursors.get(key) || 0;
    const entry = { sequence_id: e.sequence_id, job_id: e.job_id, shot_id: e.shot_id, name: s.name, raw_duration: s.duration, project_raw_in: projectTime, project_raw_out: projectTime + s.duration, shot_local_in: e.raw_in, shot_local_out: e.raw_out, job_local_in: jobStart + e.raw_in, job_local_out: jobStart + e.raw_out, sequence_edit_in: e.sequence_in, sequence_edit_out: e.sequence_in + e.raw_out - e.raw_in, fps: p.fps };
    projectTime += s.duration; cursors.set(key, jobStart + s.duration); return entry;
  });
}
export function mapLocalToSequence(shot, shotLocalTime) { return shot.edit.sequence_in + shotLocalTime - shot.edit.raw_in; }
export function orbitSweep(camera) {
  if(camera.orbitDegrees!==undefined)return camera.orbitDegrees;
  const a=Math.atan2(camera.start.position[0]-camera.start.target[0],camera.start.position[2]-camera.start.target[2]);
  let b=Math.atan2(camera.end.position[0]-camera.end.target[0],camera.end.position[2]-camera.end.target[2]);
  while(b-a>Math.PI)b-=2*Math.PI;while(b-a< -Math.PI)b+=2*Math.PI;return(b-a)*180/Math.PI;
}
export function setOrbitSweep(camera,degrees){
  camera.orbitDegrees=degrees;camera.movement='orbit';const start=camera.start,end=camera.end;
  const a=Math.atan2(start.position[0]-start.target[0],start.position[2]-start.target[2])+degrees*Math.PI/180;
  const r=Math.hypot(end.position[0]-end.target[0],end.position[2]-end.target[2]);
  end.position[0]=end.target[0]+Math.sin(a)*r;end.position[2]=end.target[2]+Math.cos(a)*r;
}
export function evaluateShot(shot, localTime) {
  const raw = clamp(localTime / shot.duration, 0, 1);
  const t = shot.camera.easing === 'linear' ? raw : raw * raw * (3 - 2 * raw);
  const { start, end, movement } = shot.camera;
  let position = mix3(start.position, end.position, t);
  const target = mix3(start.target, end.target, t);
  if (movement === 'static') position = [...start.position];
  if (movement === 'orbit') {
    const a = Math.atan2(start.position[0] - start.target[0], start.position[2] - start.target[2]);
    const b = a + orbitSweep(shot.camera)*Math.PI/180;
    const r0 = Math.hypot(start.position[0] - start.target[0], start.position[2] - start.target[2]);
    const r1 = Math.hypot(end.position[0] - end.target[0], end.position[2] - end.target[2]);
    const r = mix(r0, r1, t), theta = mix(a, b, t);
    position = [target[0] + Math.sin(theta) * r, position[1], target[2] + Math.cos(theta) * r];
  }
  return { position, target, roll:mix(shot.camera.rollStart||0,shot.camera.rollEnd||0,t), lens: mix(start.lens, end.lens, t), focusDistance: Math.hypot(...position.map((v, i) => v - target[i])), progress: raw };
}
// Blocking carries the end pose of earlier shots into later shots.
export function actorPose(project, shotIndex, localTime, actor) {
  let position = [...actor.position], action = 'hold', rotation = actor.rotation, pitch = actor.pitch || 0, roll = actor.roll || 0;
  let poseStart = actor.pose || 'stand', poseEnd = poseStart, poseProgress = 1;
  for (let i = 0; i <= shotIndex; i++) {
    const shot = project.shots[i];
    const track = shot.blocking.find((b) => b.actorId === actor.id);
    if (!track) continue;
    const t = i === shotIndex ? clamp(localTime / shot.duration, 0, 1) : 1;
    position = mix3(track.start, track.end, t);
    rotation = mix(track.rotationStart ?? rotation, track.rotationEnd ?? track.rotationStart ?? rotation, t);
    pitch = mix(track.pitchStart ?? pitch, track.pitchEnd ?? track.pitchStart ?? pitch, t);
    roll = mix(track.rollStart ?? roll, track.rollEnd ?? track.rollStart ?? roll, t);
    const fromPose = track.poseStart || poseEnd, toPose = track.poseEnd || fromPose;
    if (i === shotIndex) { action = track.action; poseStart = fromPose; poseEnd = toPose; poseProgress = t * t * (3 - 2 * t); }
    else { poseStart = poseEnd = toPose; poseProgress = 1; }
  }
  return { position, action, rotation, pitch, roll, poseStart, poseEnd, poseProgress };
}
// Shot overrides are local to that shot. Scrubbing does not depend on playback history.
export function actorState(project, shot, actor) {
  const state = shot.states?.find(s => s.actorId === actor.id) || {};
  return { visible: actor.visible, color: actor.color, image: actor.image || null, imageName: actor.imageName || '', imageRegion: actor.imageRegion || [0,0,1,1], unlit: actor.unlit || false, emissive: actor.emissive || 0, note: '', ...state };
}
export function imageUV(region=[0,0,1,1]) { return {offset:[region[0],1-region[1]-region[3]],repeat:[region[2],region[3]]}; }
export function shotLight(project, shot) { return { ...project.light, mode: 'scene', practicals: [], ...shot.light }; }
export function aspectValue(aspect) { const [w, h] = aspect.split(':').map(Number); return w / h; }
const vector4 = v => `(${v.join(', ')})`;
const vector = (v) => `(${v.map((n) => Number(n.toFixed(2))).join(', ')})`;
export function buildPrompt(project, shot) {
  const index = project.shots.indexOf(shot);
  const visible = project.actors.filter(a => actorState(project, shot, a).visible);
  const cast = visible.filter((a) => ['pill', 'pill-person', 'glb'].includes(a.type));
  const props = visible.filter((a) => !cast.includes(a));
  const light = shotLight(project, shot);
  const placement = (a) => {
    const start = actorPose(project, index, 0, a), end = actorPose(project, index, shot.duration, a);
    const state = actorState(project, shot, a);
    return `${a.characterTag ? a.characterTag+' = ':''}${a.name} [object ID ${a.id}; ${['pill','pill-person'].includes(a.type) ? 'pill stand-in; replace with the approved reference assigned to this exact character' : a.type}], color ${state.color}, scale ${a.scale}, dimension multipliers ${vector(a.dimensions || [1,1,1])}: start ${vector(start.position)} m, facing ${start.rotation} degrees, pitch ${start.pitch}°, roll ${start.roll}°, pose ${start.poseStart}; end ${vector(end.position)} m, facing ${end.rotation} degrees, pitch ${end.pitch}°, roll ${end.roll}°, pose ${end.poseEnd}; action ${end.action}. Prop cue: ${state.note || 'default'}. Surface emission ${state.emissive}.${state.image ? ` Reference image ${state.imageName || '(embedded cue plate)'} is displayed on the panel, cropped from normalized top-left source region ${vector4(state.imageRegion)}. Attach the actual image file separately when using a generator.` : ''}`;
  };
  const c = shot.camera;
  const lighting = light.mode === 'black' ? 'TRUE BLACK for this entire shot: no visible objects, background, grid, emission or lights.' : `${light.preset} lighting; mode ${light.mode}; key intensity ${light.mode === 'local' ? 0 : light.intensity}, ambient ${light.mode === 'local' ? 0 : light.ambient ?? 'preset'}. Key azimuth ${light.azimuth}°, elevation ${light.elevation}°. Background ${light.mode === 'local' ? '#000000' : light.background}, ground ${light.ground}. ${light.practicals.map(l => `Local light follows ${l.actorId}, world-space offset ${vector(l.offset)} m, color ${l.color}, intensity ${l.intensity}, range ${l.distance} m.`).join(' ')} Preserve directional shadow continuity.`;
  return `Create one continuous ${shot.duration}-second ${project.aspect} shot at ${project.fps} fps.\n\nPURPOSE\n${shot.purpose}\n\nSETTING AND GEOMETRY\n${project.setting}\nRight-handed stage coordinates: X right, Y up, +Z toward the front of the stage. Camera looks toward its target. Positions are in meters.\n${[...cast, ...props].map(placement).join('\n')}\nHidden in this shot: ${project.actors.filter(a => !actorState(project, shot, a).visible).map(a => a.name).join(', ') || 'none'}.\n\nACTION / LOCAL TIMELINE\n0.00–${shot.duration.toFixed(2)}s: ${shot.action}\nStart with the positions above, perform only the specified actions, end at the listed end positions.\n\nCAMERA\n${shot.size}; ${c.movement} movement; ${c.easing} interpolation. Camera start ${vector(c.start.position)} m, end ${vector(c.movement === 'static' ? c.start.position : c.end.position)} m. Look-at target start ${vector(c.start.target)} m, end ${vector(c.end.target)} m. Camera roll ${c.rollStart||0}° → ${c.rollEnd||0}°. Lens ${c.start.lens} → ${c.end.lens} mm, 36 mm sensor-width reference, aperture f/${c.aperture}; focus intention ${c.focus} m. ${c.movement === 'orbit' ? `Follow a signed ${orbitSweep(c).toFixed(2)}-degree orbit around the moving look-at target; positive/negative specify opposite directions; interpolate radius and height.` : 'Translate between the listed positions.'}\n\nLIGHT\n${lighting}\n\nSOUND\n${shot.sound}\n\nCONTINUITY AND FINISH\nKeep character identity, wardrobe, prop scale and screen direction consistent throughout this shot. No extra characters, text or unrequested cuts. ${shot.notes || 'Use the previz as a spatial and timing guide; replace blockout forms with approved production designs.'}\nOptical values are creative guidance; exact simulation depends on the chosen video model. No model-specific attachment syntax is assumed.`;
}
export function projectPrompt(p) { return p.shots.map((s, i) => `=== ${String(i + 1).padStart(2, '0')} · ${s.name} ===\n${buildPrompt(p, s)}`).join('\n\n'); }
// Offline keyword assistant: deliberately does not claim LLM understanding.
export function applyBrief(shot, text) {
  const s = clone(shot), lower = text.toLowerCase();
  s.action = text.trim() || s.action;
  const secs = lower.match(/(\d+(?:\.\d+)?)\s*(?:detik|seconds?|secs?)/);
  if (secs) s.duration = clamp(Number(secs[1]), 1, 60);
  const lens = lower.match(/(\d+(?:\.\d+)?)\s*mm/);
  if (lens) s.camera.start.lens = s.camera.end.lens = clamp(Number(lens[1]), 12, 200);
  if (/orbit|mengitari|melingkar/.test(lower)) s.camera.movement = 'orbit';
  else if (/crane|naik|rise|rises/.test(lower)) { s.camera.movement = 'crane'; s.camera.end.position[1] = s.camera.start.position[1] + 4; }
  else if (/static|statis|locked/.test(lower)) { s.camera.movement = 'static'; s.camera.end = clone(s.camera.start); }
  else if (/truck|geser|lateral/.test(lower)) { s.camera.movement = 'truck'; s.camera.end.position[0] = s.camera.start.position[0] + 3; }
  else if (/dolly|push|mendekat/.test(lower)) { s.camera.movement = 'dolly'; s.camera.end.position = mix3(s.camera.start.position, s.camera.start.target, 0.35); }
  if (/close.?up|\bcu\b/.test(lower)) s.size = 'CU'; else if (/wide|lebar/.test(lower)) s.size = 'WS';
  return s;
}
export function validateProject(value) {
  const fail = (s) => { throw new Error(`Blueprint tidak valid: ${s}`); };
  const finite = (n, lo, hi, label) => { if (typeof n !== 'number' || !Number.isFinite(n) || n < lo || n > hi) fail(label); };
  const str = (s, label, max = 12000) => { if (typeof s !== 'string' || s.length > max) fail(label); };
  const vec = (v, label) => { if (!Array.isArray(v) || v.length !== 3) fail(label); v.forEach((n) => finite(n, -10000, 10000, label)); };
  const color = (v) => { if (typeof v !== 'string' || !/^#[0-9a-f]{6}$/i.test(v)) fail('warna harus #RRGGBB'); };
  const image = (v) => { if (typeof v !== 'string' || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(v) || v.length > 5600000) fail('plate harus PNG/JPEG/WebP embedded, maksimal 4 MB'); };
  const region = (r) => { if(!Array.isArray(r)||r.length!==4)fail('imageRegion [x,y,width,height]');r.forEach(n=>finite(n,0,1,'imageRegion'));if(r[2]<=0||r[3]<=0||r[0]+r[2]>1+1e-9||r[1]+r[3]>1+1e-9)fail('imageRegion di luar batas gambar'); };
  const lightOverride = (l) => {
    if (!l || typeof l !== 'object' || Array.isArray(l)) fail('light override');
    if (l.mode !== undefined && !['scene','black','local'].includes(l.mode)) fail('mode cahaya');
    if (l.preset !== undefined && !['golden','overcast','night','studio'].includes(l.preset)) fail('preset cahaya shot');
    for (const [k,lo,hi] of [['intensity',0,12],['ambient',0,6],['azimuth',-180,180],['elevation',5,90]]) if (l[k] !== undefined) finite(l[k],lo,hi,k);
    for (const k of ['background','ground']) if (l[k] !== undefined) color(l[k]);
  };
  const p = clone(value);
  if (![SCHEMA,STATE_SCHEMA].includes(p?.schema)) fail(`schema harus ${SCHEMA} atau ${STATE_SCHEMA}`);
  str(p.name, 'nama proyek', 160); str(p.description, 'deskripsi'); str(p.setting, 'setting');
  if(p.sourceStory!==undefined){str(p.sourceStory.name,'nama sumber',200);str(p.sourceStory.text,'cerita asli',200000);}
  if (!['16:9', '9:16', '4:3', '1:1', '21:9', '48:9'].includes(p.aspect)) fail('rasio');
  if (![24, 25, 30].includes(p.fps)) fail('fps');
  if (!p.light) fail('lighting');
  lightOverride(p.light);
  if (!['golden', 'overcast', 'night', 'studio'].includes(p.light.preset)) fail('preset cahaya');
  finite(p.light.intensity, 0, 12, 'intensitas'); finite(p.light.azimuth, -180, 180, 'azimuth'); finite(p.light.elevation, 5, 90, 'elevation'); color(p.light.background); color(p.light.ground);
  if (!Array.isArray(p.actors) || p.actors.length > 80) fail('maksimal 80 objek');
  const ids = new Set();
  const characterNames=new Set(),characterTags=new Set();
  for (const a of p.actors) {
    if(a.type==='human'){a.type='pill-person';a.modelMigration='human-to-pill-person';}
    str(a.id, 'ID objek', 160); if (ids.has(a.id)) fail('ID objek duplikat'); ids.add(a.id);
    str(a.name, 'nama objek', 160); if (!['pill', 'pill-person', 'box', 'sphere', 'chair', 'bench', 'column', 'rings', 'glb','panel'].includes(a.type)) fail('tipe objek');
    if(isCharacter(a)){
      if(!a.name.trim())fail('nama karakter wajib diisi');const key=a.name.trim().toLowerCase();if(characterNames.has(key))fail('nama karakter harus unik');characterNames.add(key);
      if(!a.characterTag){const taken=new Set(p.actors.map(x=>x.characterTag));let n=1;while(taken.has(`CHAR_${String(n).padStart(3,'0')}`))n++;a.characterTag=`CHAR_${String(n).padStart(3,'0')}`;}
      if(!/^CHAR_\d{3,6}$/.test(a.characterTag)||characterTags.has(a.characterTag))fail('kode karakter harus unik, format CHAR_001');characterTags.add(a.characterTag);
    }
    color(a.color); vec(a.position, 'posisi objek'); finite(a.rotation, -360, 360, 'rotasi'); finite(a.scale, 0.1, 20, 'skala');
    if (a.pose !== undefined && !['stand','sit','kneel','crouch','lie'].includes(a.pose)) fail('postur objek');
    for (const k of ['pitch','roll']) if (a[k] !== undefined) finite(a[k],-360,360,k);
    if (a.dimensions !== undefined) { vec(a.dimensions,'dimensi'); a.dimensions.forEach(n => finite(n,.005,100,'dimensi positif')); }
    if (a.image !== undefined) { if (a.type !== 'panel') fail('gambar hanya untuk panel'); image(a.image); }
    if(a.imageRegion!==undefined){if(a.type!=='panel')fail('imageRegion hanya untuk panel');region(a.imageRegion);}
    if(a.imageName!==undefined)str(a.imageName,'nama plate',200);
    if (a.unlit !== undefined && typeof a.unlit !== 'boolean') fail('unlit');
    if (a.emissive !== undefined) finite(a.emissive,0,8,'surface emission');
    if (typeof a.visible !== 'boolean') fail('visibilitas');
    if (a.type === 'glb' && (typeof a.asset !== 'string' || !/^data:(model\/gltf-binary|application\/octet-stream);base64,[A-Za-z0-9+/=]+$/.test(a.asset) || a.asset.length > 17000000)) fail('GLB harus embedded, maksimal 12 MB');
  }
  if (!Array.isArray(p.shots) || p.shots.length < 1 || p.shots.length > 120) fail('butuh 1–120 shot');
  const shotIds = new Set();
  for (const s of p.shots) {
    str(s.id, 'ID shot', 160); if (shotIds.has(s.id)) fail('ID shot duplikat'); shotIds.add(s.id);
    str(s.name, 'nama shot', 160); finite(s.duration, 1 / p.fps - 1e-9, 60, 'durasi minimal 1 frame, maksimal 60 detik');
    if (Math.abs(s.duration * p.fps - Math.round(s.duration * p.fps)) > 1e-5) fail(`durasi shot harus kelipatan 1 frame pada ${p.fps} fps`);
    if (!s.edit) s.edit = { sequence_id: 'SQ01', job_id: 'J01', shot_id: s.id, raw_in: 0, raw_out: s.duration, sequence_in: 0 };
    for (const k of ['sequence_id', 'job_id', 'shot_id']) str(s.edit[k], k, 160);
    finite(s.edit.raw_in, 0, s.duration, 'RAW trim in'); finite(s.edit.raw_out, s.edit.raw_in + 1 / p.fps - 1e-9, s.duration + 1e-9, 'RAW trim out'); finite(s.edit.sequence_in, 0, 86400, 'sequence edit in');
    for (const k of ['raw_in','raw_out','sequence_in']) if (Math.abs(s.edit[k] * p.fps - Math.round(s.edit[k] * p.fps)) > 1e-5) fail(`${k} harus kelipatan 1 frame pada ${p.fps} fps`);
    if (!['EWS', 'WS', 'FS', 'MS', 'MCU', 'CU', 'ECU', 'OTS', 'POV'].includes(s.size)) fail('ukuran shot');
    for (const k of ['purpose', 'action', 'sound', 'notes']) str(s[k], k);
    if(s.directorPrompt!==undefined)str(s.directorPrompt,'prompt Director');
    const c = s.camera; if (!c) fail('kamera');
    if (!['static', 'dolly', 'truck', 'crane', 'orbit', 'handheld'].includes(c.movement)) fail('gerak kamera');
    if (!['smooth', 'linear'].includes(c.easing)) fail('easing');
    if(c.orbitDegrees!==undefined)finite(c.orbitDegrees,-1080,1080,'orbit -1080 sampai1080 derajat');
    for(const k of ['rollStart','rollEnd'])if(c[k]!==undefined)finite(c[k],-360,360,'camera roll');
    finite(c.aperture, 1, 22, 'aperture'); finite(c.focus, 0.1, 1000, 'focus');
    for (const f of [c.start, c.end]) { if (!f) fail('frame kamera'); vec(f.position, 'posisi kamera'); vec(f.target, 'target kamera'); finite(f.lens, 12, 200, 'lensa 12–200 mm'); if (Math.hypot(...f.position.map((n, i) => n - f.target[i])) < 0.01) fail('kamera dan target harus terpisah'); }
    if (!Array.isArray(s.blocking) || s.blocking.length > 80) fail('blocking');
    const tracks = new Set();
    if (s.light !== undefined) {
      lightOverride(s.light);
      if (s.light.practicals !== undefined) {
        if (!Array.isArray(s.light.practicals) || s.light.practicals.length>4) fail('maksimal 4 lampu lokal');
        for (const l of s.light.practicals) { if (!ids.has(l.actorId)) fail('objek lampu lokal hilang'); color(l.color); vec(l.offset,'offset lampu'); finite(l.intensity,0,100,'intensitas lampu lokal'); finite(l.distance,.1,30,'jarak lampu lokal'); }
      }
    }
    if (s.states !== undefined) {
      if (!Array.isArray(s.states) || s.states.length>80) fail('state properti'); const seen=new Set();
      for (const state of s.states) { if (!ids.has(state.actorId) || seen.has(state.actorId)) fail('ID state hilang/duplikat'); seen.add(state.actorId);
        if (state.visible!==undefined && typeof state.visible!=='boolean') fail('state visibility');
        if (state.unlit!==undefined && typeof state.unlit!=='boolean') fail('state unlit');
        if (state.color!==undefined) color(state.color); if (state.emissive!==undefined) finite(state.emissive,0,8,'state emission');
        if (state.note!==undefined) str(state.note,'catatan state');
        if (state.image!==undefined) { if (p.actors.find(a=>a.id===state.actorId).type!=='panel') fail('gambar state hanya untuk panel'); image(state.image); }
        if(state.imageRegion!==undefined){if(p.actors.find(a=>a.id===state.actorId).type!=='panel')fail('imageRegion hanya untuk panel');region(state.imageRegion);}
        if(state.imageName!==undefined)str(state.imageName,'nama plate state',200);
      }
    }
    for (const b of s.blocking) { if (!ids.has(b.actorId) || tracks.has(b.actorId)) fail('ID blocking hilang/duplikat'); tracks.add(b.actorId); vec(b.start, 'awal blocking'); vec(b.end, 'akhir blocking'); if (!['hold', 'walk', 'run', 'jump', 'float'].includes(b.action)) fail('aksi blocking');
      for (const k of ['poseStart','poseEnd']) if (b[k] !== undefined && !['stand','sit','kneel','crouch','lie'].includes(b[k])) fail('cue postur');
      for (const k of ['rotationStart','rotationEnd','pitchStart','pitchEnd','rollStart','rollEnd']) if (b[k] !== undefined) finite(b[k],-360,360,'rotasi blocking');
    }
  }
  if (totalDuration(p) > 1800) fail('total durasi maksimal 30 menit');
  // New-feature exports must not silently render as daylight/static props in CP001.
  if(p.actors.some(a=>a.type==='pill-person'||a.type==='panel'||a.dimensions!==undefined||a.pitch!==undefined||a.roll!==undefined)||p.shots.some(s=>s.camera.orbitDegrees!==undefined||s.camera.rollStart!==undefined||s.camera.rollEnd!==undefined||s.states!==undefined||s.light!==undefined||s.blocking.some(b=>['pitchStart','pitchEnd','rollStart','rollEnd'].some(k=>b[k]!==undefined))))p.schema=STATE_SCHEMA;
  return p;
}
