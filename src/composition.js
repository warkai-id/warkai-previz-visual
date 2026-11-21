import { Box3, Raycaster, Vector2, Vector3 } from 'three';
import { actorPose, actorState, isCharacter, locateShot, totalDuration } from './model.js';

function frameInfo(project, time) {
  const { shot, localTime } = locateShot(project, time);
  const frameAt = (seconds, duration) => Math.min(
    Math.round(duration * project.fps) - 1,
    Math.floor(seconds * project.fps + 1e-7),
  );
  return {
    shot,
    shotId: shot.id,
    editShotId: shot.edit.shot_id,
    frame: frameAt(Math.max(0, time), totalDuration(project)),
    localFrame: frameAt(localTime, shot.duration),
  };
}

function visibleGeometry(engine) {
  const meshes = [], owners = new Map();
  for (const [id, root] of engine.objects) {
    root.traverseVisible(node => {
      if (!node.isMesh || !node.layers.test(engine.camera.layers)) return;
      meshes.push(node);
      owners.set(node, id);
    });
  }
  if (engine.ground?.visible) meshes.push(engine.ground);
  return { meshes, owners };
}

function worldDepth(world, camera) {
  return -world.clone().applyMatrix4(camera.matrixWorldInverse).z;
}

function raySamples(probes, id, camera, geometry) {
  const ray = new Raycaster(), samples = [];
  ray.layers.mask = camera.layers.mask;
  for (const point of probes) {
    const ndc = point.clone().project(camera);
    if (Math.abs(ndc.x) > 1 || Math.abs(ndc.y) > 1 || Math.abs(ndc.z) > 1) continue;
    ray.setFromCamera(new Vector2(ndc.x, ndc.y), camera);
    let first;
    for (const hit of ray.intersectObjects(geometry.meshes, false)) {
      const material = Array.isArray(hit.object.material) ? hit.object.material[hit.face.materialIndex] : hit.object.material;
      if (!material?.visible || (material.transparent && material.opacity < 0.5)) continue;
      const depth = worldDepth(hit.point, camera);
      if (depth < camera.near || depth > camera.far) continue;
      const owner = geometry.owners.get(hit.object) ?? null;
      if (first === undefined) first = owner;
      if (owner === id) {
        samples.push({ visible: first === id, blocker: first });
        break;
      }
    }
  }
  return samples;
}

// The simple Pill has a continuous capsule. Its upper cap is a head cue.
// Segmented Pills have a separate sphere. GLBs have no declared head landmark.
function pillLandmarks(actor, root, camera) {
  const segmented = actor.type === 'pill-person';
  const cy = segmented ? 1.635 : 1.44, radius = segmented ? 0.205 : 0.30;
  const local = (x, y, z = 0) => root.localToWorld(new Vector3(x, y, z));
  const headCenter = local(0, cy);
  const axial = worldDepth(headCenter, camera);
  let head = null;
  if (axial >= camera.near && axial <= camera.far) {
    const points = [];
    // Sample the transformed head surface instead of a world-aligned box
    // so a seated or rolled Pill retains its screen-space silhouette.
    for (let latitude = 0; latitude <= 8; latitude++) {
      const phi = Math.PI * latitude / 8;
      for (let longitude = 0; longitude < 12; longitude++) {
        const theta = 2 * Math.PI * longitude / 12;
        points.push(local(
          radius * Math.sin(phi) * Math.cos(theta),
          cy + radius * Math.cos(phi),
          radius * Math.sin(phi) * Math.sin(theta),
        ).project(camera));
      }
    }
    head = new Box3().setFromPoints(points);
  }
  return { head, center: local(0, 0.9), probes: [headCenter, local(0, 0.92), local(0, 0.36)] };
}

function objectLandmarks(root) {
  const bounds = new Box3().setFromObject(root), center = bounds.getCenter(new Vector3());
  const height = bounds.max.y - bounds.min.y;
  if (bounds.isEmpty()) return { head: null, center, probes: [] };
  const probes = [0, -0.3, 0.3].map(t => center.clone().add(new Vector3(0, t * height, 0)));
  return { head: null, center, probes };
}

function overlapsFrame(rect) {
  return rect && rect.max.x >= -1 && rect.min.x <= 1 && rect.max.y >= -1 && rect.min.y <= 1;
}

function headOverlap(a, b) {
  const dx = Math.max(0, Math.min(1, a.max.x, b.max.x) - Math.max(-1, a.min.x, b.min.x));
  const dy = Math.max(0, Math.min(1, a.max.y, b.max.y) - Math.max(-1, a.min.y, b.min.y));
  const area = box => (box.max.x - box.min.x) * (box.max.y - box.min.y);
  return dx * dy > 0.2 * Math.min(area(a), area(b));
}

function propVolumes(engine) {
  const volumes = [];
  for (const actor of engine.project.actors) {
    if (isCharacter(actor) || ['panel', 'rings'].includes(actor.type)) continue;
    const root = engine.objects.get(actor.id);
    root?.traverseVisible(mesh => {
      if (!mesh.isMesh) return;
      const g = mesh.geometry;
      if (!g.boundingBox) g.computeBoundingBox();
      if (!g.boundingBox || g.boundingBox.isEmpty()) return;
      const seat = ['chair', 'bench'].includes(actor.type) && g.parameters?.height === 0.14;
      volumes.push({ actor, mesh, bounds: g.boundingBox, seat, inverse: mesh.matrixWorld.clone().invert() });
    });
  }
  return volumes;
}

function intersectedProps(root, actor, pose, volumes) {
  const segmented = actor.type === 'pill-person';
  const radius = segmented ? 0.245 : 0.30;
  const bodyEnd = segmented ? 1.065 : 1.44;
  const probes = [radius, (radius + bodyEnd) / 2, bodyEnd].flatMap(y =>
    [[0, 0], [-0.8, 0], [0.8, 0], [0, -0.8], [0, 0.8]]
      .map(([x, z]) => root.localToWorld(new Vector3(x * radius, y, z * radius))));
  const seated = pose.poseStart === 'sit' && pose.poseProgress < 1 || pose.poseEnd === 'sit' && pose.poseProgress > 0;
  const hits = new Set();
  for (const { actor: prop, mesh, inverse, bounds, seat } of volumes) {
    if (hits.has(prop) || seated && seat) continue;
    if (probes.some(p => {
      const local = p.clone().applyMatrix4(inverse);
      if (!bounds.containsPoint(local)) return false;
      const g = mesh.geometry;
      if (g.type === 'SphereGeometry') return local.lengthSq() < g.parameters.radius ** 2;
      if (g.type === 'CylinderGeometry') {
        const { height, radiusTop, radiusBottom } = g.parameters;
        const r = radiusBottom + (radiusTop - radiusBottom) * (local.y / height + 0.5);
        return Math.hypot(local.x, local.z) < r;
      }
      return true;
    })) hits.add(prop);
  }
  return hits;
}

/** Inspect the already-updated frame. Findings are geometric cues for the Director. */
export function inspectComposition(engine, time) {
  const { project, camera } = engine;
  const { shot, ...identity } = frameInfo(project, time);
  const findings = [], expected = shot.composition ?? {};
  const add = (code, actorIds, message) => findings.push({ ...identity, code, actorIds, message });
  const report = { ...identity, findings };
  engine.scene.updateMatrixWorld(true);
  camera.updateMatrixWorld(true);
  const black = engine.currentLight?.mode === 'black';
  const geometry = visibleGeometry(engine), volumes = propVolumes(engine), subjects = [], visible = new Map();
  const { index, localTime } = locateShot(project, time);
  for (const actor of project.actors) {
    const root = engine.objects.get(actor.id);
    if (!root?.visible || black) continue;
    const character = isCharacter(actor);
    if (!character && actor.id !== expected.foregroundId && actor.id !== expected.revealId) continue;
    const landmarks = ['pill', 'pill-person'].includes(actor.type) ?
      pillLandmarks(actor, root, camera) : objectLandmarks(root);
    if (['pill', 'pill-person'].includes(actor.type)) {
      const pose = actorPose(project, index, localTime, actor);
      for (const prop of intersectedProps(root, actor, pose, volumes))
        add('set-intersection', [actor.id, prop.id], `Titik badan ${actor.name} masuk volume ${prop.name}. Periksa blocking dan kontak yang disengaja.`);
    }
    const samples = raySamples(landmarks.probes, actor.id, camera, geometry);
    const clear = samples.filter(s => s.visible).length;
    if (clear) visible.set(actor.id, worldDepth(landmarks.center, camera));
    if (!character) continue;
    if (samples.length > clear) {
      const blockers = [...new Set(samples.filter(s => !s.visible).map(s => s.blocker).filter(Boolean))];
      const names = blockers.map(id => project.actors.find(a => a.id === id)?.name).filter(Boolean);
      add('subject-occluded', [actor.id, ...blockers],
        `${actor.name} tertutup pada ${samples.length - clear} dari ${samples.length} titik yang diuji${names.length ? ' oleh ' + names.join(', ') : ''}.`);
    }
    const head = landmarks.head;
    if (head && (overlapsFrame(head) || clear > 0)
      && (head.min.x < -1 || head.max.x > 1 || head.min.y < -1 || head.max.y > 1))
      add('head-cropped', [actor.id], `Kepala ${actor.name} terpotong tepi frame.`);
    if (!overlapsFrame(head)) continue;
    for (const other of subjects) if (headOverlap(head, other.head))
      add('heads-overlap', [other.actor.id, actor.id], `Siluet kepala ${other.actor.name} dan ${actor.name} bertumpuk di kamera.`);
    subjects.push({ actor, head });
  }
  const { foregroundId, revealId } = expected;
  if (foregroundId) {
    const depth = visible.get(foregroundId);
    const behindSubject = project.actors.some(a => a.id !== foregroundId && isCharacter(a) && visible.get(a.id) < depth);
    if (depth === undefined || behindSubject)
      add('foreground-missing', [foregroundId], 'Periksa objek foreground. Titik yang diuji belum terlihat di depan pemeran.');
  }
  const revealFrame = expected.revealFrame ?? Math.round(shot.duration * project.fps) - 1;
  if (revealId && identity.localFrame >= revealFrame && !visible.has(revealId))
    add('reveal-missing', [revealId], 'Objek reveal belum terlihat pada titik yang diuji setelah frame arahan.');
  return report;
}

const worldPosition = object => object.getWorldPosition(new Vector3());

function activeLights(engine) {
  const list = [];
  engine.scene.traverseVisible(light => {
    if (!light.isLight || light.intensity <= 0 || engine.currentLight?.mode === 'black') return;
    const name = light.name || (light === engine.key ? 'Key' : light === engine.hemi ? 'Ambient' :
      light === engine.fill ? 'Fill' : light.isPointLight ? 'Practical' : light.type.replace('Light', ''));
    list.push({
      name, color: '#' + light.color.getHexString(), intensity: light.intensity,
      position: light.isHemisphereLight || light.isAmbientLight ? null : worldPosition(light),
      target: light.target ? worldPosition(light.target) : null, shadow: light.castShadow,
    });
  });
  return list;
}

function drawPlan(ctx, area, points, draw) {
  const { x, y, width, height } = area, pad = 22;
  const bounds = new Box3().setFromPoints(points), center = bounds.getCenter(new Vector3());
  const scale = Math.min((width - pad * 2) / Math.max(bounds.max.x - bounds.min.x, 4),
    (height - pad * 2) / Math.max(bounds.max.z - bounds.min.z, 4));
  const project = p => [x + width / 2 + (p.x - center.x) * scale, y + height / 2 + (p.z - center.z) * scale];
  const line = (from, to, color) => {
    ctx.strokeStyle = color; ctx.beginPath(); ctx.moveTo(...project(from)); ctx.lineTo(...project(to)); ctx.stroke();
  };
  const mark = (point, text, color, radius = 4) => {
    const [px, py] = project(point);
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(px, py, radius, 0, 2 * Math.PI); ctx.fill();
    if (text) {
      ctx.fillStyle = '#edf2ee'; ctx.font = '13px system-ui';
      ctx.fillText(text, Math.min(px + 7, x + width - 7 - Math.min(ctx.measureText(text).width, 105)), py - 5, 105);
    }
  };
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, width, height); ctx.clip();
  ctx.fillStyle = '#222a2a'; ctx.fillRect(x, y, width, height);
  draw({ line, mark, project });
  ctx.restore();
}

function drawBreakdownMaps(ctx, engine, shot) {
  const { project, camera } = engine, cam = worldPosition(camera);
  const target = new Vector3(...engine.currentPose.target);
  const actors = project.actors.filter(a => engine.objects.get(a.id)?.visible).map(actor => ({
    position: worldPosition(engine.objects.get(actor.id)), color: actorState(project, shot, actor).color,
    label: actor.characterTag || actor.name, character: isCharacter(actor),
  }));
  const anchors = [cam, target, ...actors.map(a => a.position)];
  const route = [], lineAttribute = engine.path?.geometry.getAttribute('position');
  if (lineAttribute) for (let i = 0; i < lineAttribute.count; i++)
    route.push(new Vector3().fromBufferAttribute(lineAttribute, i).applyMatrix4(engine.path.matrixWorld));
  const drawActors = (mark, labels) => actors.forEach(a => mark(a.position, labels && a.character ? a.label : '', a.color, a.character ? 5 : 3));
  const rays = [-1, 1].map(x => {
    const direction = new Vector3(x, 0, 0).unproject(camera).sub(cam).normalize();
    return cam.clone().addScaledVector(direction, Math.min(8, Math.max(1, cam.distanceTo(target))));
  });
  drawPlan(ctx, { x: 812, y: 91, width: 442, height: 207 }, [...anchors, ...route, ...rays], ({ line, mark }) => {
    for (let i = 1; i < route.length; i++) line(route[i - 1], route[i], '#6caf9a');
    for (const ray of rays) line(cam, ray, '#a3c2b1');
    line(rays[0], rays[1], '#6a827b');
    drawActors(mark, true); mark(cam, 'Kamera', '#c1e4bc');
  });
  const lights = activeLights(engine), positioned = lights.filter(l => l.position);
  const lightPoints = positioned.flatMap(l => l.target ? [l.position, l.target] : [l.position]);
  drawPlan(ctx, { x: 812, y: 357, width: 442, height: 183 }, [...anchors, ...lightPoints], ({ line, mark }) => {
    drawActors(mark, false);
    positioned.forEach((l, i) => {
      if (l.target) { line(l.position, l.target, l.color); mark(l.target, '', l.color, 2); }
      mark(l.position, l.name + (positioned.filter(v => v.name === l.name).length > 1 ? ' ' + (i + 1) : ''), l.color, 5);
    });
  });
  return lights;
}

/** The caller updates the engine first using the same time as the clean capture. */
export function captureDirectorBreakdown(engine, time, canvas = document.createElement('canvas')) {
  if (canvas.width !== 1280 || canvas.height !== 720) { canvas.width = 1280; canvas.height = 720; }
  const ctx = canvas.getContext('2d'), { shot, localFrame, frame } = frameInfo(engine.project, time);
  engine.scene.updateMatrixWorld(true); engine.camera.updateMatrixWorld(true);
  const frameWidth = Math.round(Math.min(760, 485 * engine.camera.aspect));
  const clean = engine.captureFrame(frameWidth);
  ctx.fillStyle = '#151b1c'; ctx.fillRect(0, 0, 1280, 720);
  const label = (s, x, y, size, width, color = '#e2e9e4') => {
    ctx.fillStyle = color; ctx.font = size + 'px system-ui'; ctx.fillText(s, x, y, width);
  };
  label(shot.name, 26, 40, 26, 715);
  label('Director Breakdown', 812, 40, 18, 442, '#b1c3b7');
  label('Frame kamera', 26, 78, 16, 720);
  ctx.fillStyle = '#0a0d0e'; ctx.fillRect(26, 91, 760, 485);
  const height = Math.min(485, 760 * clean.height / clean.width), width = height * clean.width / clean.height;
  ctx.drawImage(clean, 26 + (760 - width) / 2, 91 + (485 - height) / 2, width, height);
  label('Denah kamera dan pemain', 812, 78, 16, 442);
  label('Denah cahaya', 812, 344, 16, 442);
  const lights = drawBreakdownMaps(ctx, engine, shot);
  const lighting = lights.map(l => `${l.name} ${l.intensity.toFixed(1)}${l.shadow ? ' · bayangan' : ''}`);
  label(lighting.join(' / ') || 'Semua sumber padam', 812, 563, 13, 442);
  ctx.strokeStyle = '#465452'; ctx.beginPath(); ctx.moveTo(26, 600); ctx.lineTo(1254, 600); ctx.stroke();
  const pose = engine.currentPose;
  label(`${shot.edit.shot_id}  ·  Frame shot ${localFrame}  ·  Frame proyek ${frame}  ·  ${engine.project.fps} fps`, 26, 633, 18, 760);
  label(`${shot.size}  ·  ${pose.lens.toFixed(1)} mm  ·  f/${shot.camera.aperture}  ·  Fokus arahan ${pose.focus ?? shot.camera.focus} m`, 26, 668, 18, 760);
  label('Posisi kamera XYZ (m)', 812, 632, 14, 442, '#bbcac0');
  label(pose.position.map(v => v.toFixed(2)).join('   /   '), 812, 663, 20, 442);
  return canvas;
}
