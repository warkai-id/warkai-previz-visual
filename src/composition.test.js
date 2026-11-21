import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BoxGeometry, CapsuleGeometry, Group, Mesh, MeshBasicMaterial, PerspectiveCamera, Scene, SphereGeometry, Vector3 } from 'three';
import { createDemo } from './model.js';
import { inspectComposition } from './composition.js';

function stage() {
  const project = createDemo();
  project.actors = [];
  const shot = project.shots[0];
  shot.blocking = [];
  project.shots = [shot];
  const camera = new PerspectiveCamera(45, 16 / 9, 0.05, 300);
  camera.position.set(0, 1.4, 6);
  camera.lookAt(new Vector3(0, 1.4, 0));
  return { project, scene: new Scene(), camera, objects: new Map(), currentLight: { mode: 'scene' } };
}

function add(engine, id, type, position, scale = [1, 1, 1]) {
  const actor = { id, name: id, type, position, color: '#5588aa', scale: 1, visible: true, rotation: 0 };
  const root = new Group(), material = new MeshBasicMaterial();
  if (type === 'pill-person') {
    const body = new Mesh(new CapsuleGeometry(0.245, 0.82), material), head = new Mesh(new SphereGeometry(0.205), material);
    body.position.y = 0.655;
    head.position.y = 1.635;
    root.add(body, head);
  } else {
    const box = new Mesh(new BoxGeometry(1, 1, 1), material);
    box.position.y = 0.5;
    root.add(box);
  }
  root.position.fromArray(position); root.scale.fromArray(scale);
  engine.scene.add(root); engine.objects.set(id, root); engine.project.actors.push(actor);
  return root;
}

test('actual intervening mesh is named in a shot/frame warning; a hidden or rear mesh does not occlude', () => {
  const e = stage();
  add(e, 'Pemain', 'pill-person', [0, 0, 0]);
  const wall = add(e, 'Dinding', 'box', [0, 0, 3], [2, 3, 0.1]);
  const report = inspectComposition(e, 0.5);
  assert.equal(report.frame, 12);
  const warning = report.findings.find(f => f.code === 'subject-occluded');
  assert.deepEqual(warning.actorIds, ['Pemain', 'Dinding']);
  assert.equal(warning.shotId, e.project.shots[0].id);
  assert.equal(warning.localFrame, 12);
  wall.visible = false;
  assert.deepEqual(inspectComposition(e, 0.5).findings, []);
  wall.visible = true; wall.position.z = -3;
  assert.deepEqual(inspectComposition(e, 0.5).findings, []);
});

test('projected heads can overlap and be cropped at the edge independently', () => {
  const e = stage();
  add(e, 'Depan', 'pill-person', [0, 0, 0]);
  const rear = add(e, 'Belakang', 'pill-person', [0, 0, -0.5]);
  assert.ok(inspectComposition(e, 0).findings.some(f => f.code === 'heads-overlap'));
  rear.position.set(0, 2.45, 0);
  assert.ok(inspectComposition(e, 0).findings.some(f => f.code === 'head-cropped'));
  rear.position.set(0, 2.8, 0);
  assert.ok(inspectComposition(e, 0).findings.some(f => f.code === 'head-cropped'));
  rear.position.set(0, 10, 0);
  assert.ok(!inspectComposition(e, 0).findings.some(f => f.code === 'head-cropped'));
});

test('foreground and reveal use the assigned object, depth, and local reveal frame across a cut', () => {
  const e = stage(), shot = structuredClone(e.project.shots[0]);
  shot.id = 'cut-2'; shot.edit.shot_id = '2A';
  shot.composition = { foregroundId: 'Pintu', revealId: 'Lampu', revealFrame: 16 };
  e.project.shots.push(shot);
  add(e, 'Pemain', 'pill-person', [-1, 0, 0]);
  const door = add(e, 'Pintu', 'box', [1, 0, -3]);
  const lamp = add(e, 'Lampu', 'box', [-0.5, 0, 2]);
  lamp.visible = false;
  const start = e.project.shots[0].duration;
  assert.deepEqual(inspectComposition(e, start).findings.map(f => f.code), ['foreground-missing']);
  let report = inspectComposition(e, start + 16 / 24);
  assert.deepEqual(report.findings.map(f => f.code), ['foreground-missing', 'reveal-missing']);
  assert.equal(report.frame, start * 24 + 16);
  assert.equal(report.localFrame, 16);
  assert.equal(report.editShotId, '2A');
  door.position.z = 2; lamp.visible = true;
  report = inspectComposition(e, start + 17 / 24);
  assert.ok(!report.findings.some(f => f.code === 'foreground-missing' || f.code === 'reveal-missing'));
});

test('black shots do not warn about intended silhouettes; an explicitly required reveal still warns', () => {
  const e = stage();
  add(e, 'Pemain', 'pill-person', [0, 0, 0]);
  add(e, 'Dinding', 'box', [0, 0, 3], [2, 3, 0.1]);
  e.currentLight.mode = 'black';
  assert.deepEqual(inspectComposition(e, 0).findings, []);
  e.project.shots[0].composition = { revealId: 'Pemain' };
  assert.deepEqual(inspectComposition(e, e.project.shots[0].duration).findings.map(f => f.code), ['reveal-missing']);
});

test('Pill penetrating the set is reported even when both remain in frame', () => {
  const e = stage();
  add(e, 'Pemain', 'pill-person', [0, 0, 0]);
  const wall = add(e, 'Set', 'box', [0.15, 0, 0]);
  assert.ok(inspectComposition(e, 0).findings.some(f => f.code === 'set-intersection'));
  wall.position.x = 4;
  assert.ok(!inspectComposition(e, 0).findings.some(f => f.code === 'set-intersection'));
});

test('seated cue tolerates the seat surface but still checks the backrest', () => {
  const e = stage();
  add(e, 'Pemain', 'pill-person', [0, 0, 0]);
  e.project.actors[0].pose = 'sit';
  const chair = add(e, 'Kursi', 'chair', [0, 0, 0]);
  chair.clear();
  const seat = new Mesh(new BoxGeometry(0.8, 0.14, 0.7), new MeshBasicMaterial());
  seat.position.y = 0.655;
  chair.add(seat);
  assert.ok(!inspectComposition(e, 0).findings.some(f => f.code === 'set-intersection'));
  const back = new Mesh(new BoxGeometry(0.8, 0.6, 0.1), new MeshBasicMaterial());
  back.position.set(0, 0.9, 0.185); chair.add(back);
  assert.ok(inspectComposition(e, 0).findings.some(f => f.code === 'set-intersection'));
});
