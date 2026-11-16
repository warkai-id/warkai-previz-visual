export const SCHEMA = 'warkai-previz/1';
export const clone = (v) => structuredClone(v);
export const uid = (prefix = 'item') => `${prefix}-${globalThis.crypto.randomUUID().slice(0, 8)}`;
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
export function evaluateShot(shot, localTime) {
  const raw = clamp(localTime / shot.duration, 0, 1);
  const t = shot.camera.easing === 'linear' ? raw : raw * raw * (3 - 2 * raw);
  const { start, end, movement } = shot.camera;
  let position = mix3(start.position, end.position, t);
  const target = mix3(start.target, end.target, t);
  if (movement === 'static') position = [...start.position];
  if (movement === 'orbit') {
    const a = Math.atan2(start.position[0] - start.target[0], start.position[2] - start.target[2]);
    let b = Math.atan2(end.position[0] - end.target[0], end.position[2] - end.target[2]);
    while (b - a > Math.PI) b -= Math.PI * 2;
    while (b - a < -Math.PI) b += Math.PI * 2;
    const r0 = Math.hypot(start.position[0] - start.target[0], start.position[2] - start.target[2]);
    const r1 = Math.hypot(end.position[0] - end.target[0], end.position[2] - end.target[2]);
    const r = mix(r0, r1, t), theta = mix(a, b, t);
    position = [target[0] + Math.sin(theta) * r, position[1], target[2] + Math.cos(theta) * r];
  }
  return { position, target, lens: mix(start.lens, end.lens, t), focusDistance: Math.hypot(...position.map((v, i) => v - target[i])), progress: raw };
}
// Blocking carries the end pose of earlier shots into later shots.
export function actorPose(project, shotIndex, localTime, actor) {
  let position = [...actor.position], action = 'hold', rotation = actor.rotation;
  let poseStart = actor.pose || 'stand', poseEnd = poseStart, poseProgress = 1;
  for (let i = 0; i <= shotIndex; i++) {
    const shot = project.shots[i];
    const track = shot.blocking.find((b) => b.actorId === actor.id);
    if (!track) continue;
    const t = i === shotIndex ? clamp(localTime / shot.duration, 0, 1) : 1;
    position = mix3(track.start, track.end, t);
    rotation = mix(track.rotationStart ?? rotation, track.rotationEnd ?? track.rotationStart ?? rotation, t);
    const fromPose = track.poseStart || poseEnd, toPose = track.poseEnd || fromPose;
    if (i === shotIndex) { action = track.action; poseStart = fromPose; poseEnd = toPose; poseProgress = t * t * (3 - 2 * t); }
    else { poseStart = poseEnd = toPose; poseProgress = 1; }
  }
  return { position, action, rotation, poseStart, poseEnd, poseProgress };
}
export function aspectValue(aspect) { const [w, h] = aspect.split(':').map(Number); return w / h; }
const vector = (v) => `(${v.map((n) => Number(n.toFixed(2))).join(', ')})`;
export function buildPrompt(project, shot) {
  const index = project.shots.indexOf(shot);
  const cast = project.actors.filter((a) => a.visible && ['pill', 'human', 'glb'].includes(a.type));
  const props = project.actors.filter((a) => a.visible && !cast.includes(a));
  const placement = (a) => {
    const start = actorPose(project, index, 0, a), end = actorPose(project, index, shot.duration, a);
    return `${a.name} [${a.type === 'pill' ? 'capsule stand-in; replace with your approved character reference' : a.type}], color ${a.color}, height scale ${a.scale}: start ${vector(start.position)} m, facing ${start.rotation} degrees, pose ${start.poseStart}; end ${vector(end.position)} m, facing ${end.rotation} degrees, pose ${end.poseEnd}; action ${end.action}`;
  };
  const c = shot.camera;
  return `Create one continuous ${shot.duration}-second ${project.aspect} shot at ${project.fps} fps.\n\nPURPOSE\n${shot.purpose}\n\nSETTING AND GEOMETRY\n${project.setting}\nRight-handed stage coordinates: X right, Y up, +Z toward the front of the stage. Camera looks toward its target. Positions are in meters.\n${[...cast, ...props].map(placement).join('\n')}\n\nACTION / LOCAL TIMELINE\n0.00–${shot.duration.toFixed(2)}s: ${shot.action}\nStart with the positions above, perform only the specified actions, end at the listed end positions.\n\nCAMERA\n${shot.size}; ${c.movement} movement; ${c.easing} interpolation. Camera start ${vector(c.start.position)} m, end ${vector(c.movement === 'static' ? c.start.position : c.end.position)} m. Look-at target start ${vector(c.start.target)} m, end ${vector(c.end.target)} m. Lens ${c.start.lens} → ${c.end.lens} mm, 36 mm sensor-width reference, aperture f/${c.aperture}; focus intention ${c.focus} m. ${c.movement === 'orbit' ? 'Follow the shortest circular arc around the moving look-at target, interpolating radius and height.' : 'Translate between the listed positions.'}\n\nLIGHT\n${project.light.preset} lighting; key azimuth ${project.light.azimuth}°, elevation ${project.light.elevation}°. Background ${project.light.background}, ground ${project.light.ground}. Preserve directional shadow continuity.\n\nSOUND\n${shot.sound}\n\nCONTINUITY AND FINISH\nKeep character identity, wardrobe, prop scale and screen direction consistent throughout this shot. No extra characters, text or unrequested cuts. ${shot.notes || 'Use the previz as a spatial and timing guide; replace blockout forms with approved production designs.'}\nOptical values are creative guidance; exact simulation depends on the chosen video model. No model-specific attachment syntax is assumed.`;
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
  const p = clone(value);
  if (p?.schema !== SCHEMA) fail(`schema harus ${SCHEMA}`);
  str(p.name, 'nama proyek', 160); str(p.description, 'deskripsi'); str(p.setting, 'setting');
  if (!['16:9', '9:16', '4:3', '1:1', '21:9', '48:9'].includes(p.aspect)) fail('rasio');
  if (![24, 25, 30].includes(p.fps)) fail('fps');
  if (!p.light) fail('lighting');
  if (!['golden', 'overcast', 'night', 'studio'].includes(p.light.preset)) fail('preset cahaya');
  finite(p.light.intensity, 0, 12, 'intensitas'); finite(p.light.azimuth, -180, 180, 'azimuth'); finite(p.light.elevation, 5, 90, 'elevation'); color(p.light.background); color(p.light.ground);
  if (!Array.isArray(p.actors) || p.actors.length > 80) fail('maksimal 80 objek');
  const ids = new Set();
  for (const a of p.actors) {
    str(a.id, 'ID objek', 160); if (ids.has(a.id)) fail('ID objek duplikat'); ids.add(a.id);
    str(a.name, 'nama objek', 160); if (!['pill', 'human', 'box', 'sphere', 'chair', 'bench', 'column', 'rings', 'glb'].includes(a.type)) fail('tipe objek');
    color(a.color); vec(a.position, 'posisi objek'); finite(a.rotation, -360, 360, 'rotasi'); finite(a.scale, 0.1, 20, 'skala');
    if (a.pose !== undefined && !['stand','sit','kneel','crouch','lie'].includes(a.pose)) fail('postur objek');
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
    const c = s.camera; if (!c) fail('kamera');
    if (!['static', 'dolly', 'truck', 'crane', 'orbit', 'handheld'].includes(c.movement)) fail('gerak kamera');
    if (!['smooth', 'linear'].includes(c.easing)) fail('easing');
    finite(c.aperture, 1, 22, 'aperture'); finite(c.focus, 0.1, 1000, 'focus');
    for (const f of [c.start, c.end]) { if (!f) fail('frame kamera'); vec(f.position, 'posisi kamera'); vec(f.target, 'target kamera'); finite(f.lens, 12, 200, 'lensa 12–200 mm'); if (Math.hypot(...f.position.map((n, i) => n - f.target[i])) < 0.01) fail('kamera dan target harus terpisah'); }
    if (!Array.isArray(s.blocking) || s.blocking.length > 80) fail('blocking');
    const tracks = new Set();
    for (const b of s.blocking) { if (!ids.has(b.actorId) || tracks.has(b.actorId)) fail('ID blocking hilang/duplikat'); tracks.add(b.actorId); vec(b.start, 'awal blocking'); vec(b.end, 'akhir blocking'); if (!['hold', 'walk', 'run', 'jump', 'float'].includes(b.action)) fail('aksi blocking');
      for (const k of ['poseStart','poseEnd']) if (b[k] !== undefined && !['stand','sit','kneel','crouch','lie'].includes(b[k])) fail('cue postur');
      for (const k of ['rotationStart','rotationEnd']) if (b[k] !== undefined) finite(b[k],-360,360,'arah hadap blocking');
    }
  }
  if (totalDuration(p) > 1800) fail('total durasi maksimal 30 menit');
  return p;
}
