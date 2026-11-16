import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDemo, validateProject, evaluateShot, locateShot, actorPose, buildPrompt, applyBrief, totalDuration, shotManifest, mapLocalToSequence } from './model.js';
test('demo round-trips and shot boundaries cut to the next shot', () => {
  const p = validateProject(JSON.parse(JSON.stringify(createDemo())));
  assert.equal(totalDuration(p), 21);
  assert.equal(locateShot(p, 6).index, 1);
  assert.equal(locateShot(p, 21).localTime, 6);
});
test('camera path reaches exact endpoints including orbit and preserves constant radius', () => {
  const s = createDemo().shots[2];
  for (const [t, expected] of [[0, s.camera.start.position], [s.duration, s.camera.end.position]]) {
    evaluateShot(s, t).position.forEach((n, i) => assert.ok(Math.abs(n - expected[i]) < 1e-9));
  }
  s.camera.end.position = [-3.2, 2.9, 2];
  const a = evaluateShot(s, 0), m = evaluateShot(s, 2.5);
  assert.ok(Math.abs(Math.hypot(a.position[0] - a.target[0], a.position[2] - a.target[2]) - Math.hypot(m.position[0] - m.target[0], m.position[2] - m.target[2])) < 1e-8);
});
test('actor end position carries into later shots and prompt geometry agrees', () => {
  const p = createDemo(), a = p.actors[0];
  assert.deepEqual(actorPose(p, 1, 0, a).position, [-0.8, 0, 0.2]);
  assert.match(buildPrompt(p, p.shots[1]), /start \(-0.8, 0, 0.2\)/);
  assert.match(buildPrompt(p, p.shots[1]), /0.00–4.00s/);
});
test('invalid imports cannot replace a valid project', () => {
  for (const mutate of [p => p.shots[0].duration = -1, p => p.actors[1].id = p.actors[0].id, p => p.shots[0].camera.start.lens = NaN, p => p.shots[0].blocking[0].actorId = 'missing', p => p.light.background = 'url(http://example.com)', p => p.shots[0].camera.start.target = p.shots[0].camera.start.position]) {
    const p = createDemo(); mutate(p); assert.throws(() => validateProject(p), /Blueprint tidak valid/);
  }
});
test('offline brief assistant only changes known technical instructions', () => {
  const s = applyBrief(createDemo().shots[0], 'Orbit close-up 50mm selama 8 detik');
  assert.equal(s.duration, 8); assert.equal(s.camera.movement, 'orbit'); assert.equal(s.camera.start.lens, 50); assert.equal(s.size, 'CU');
});
test('subsecond cuts align to 30fps and remain independent from sequence edit offsets', () => {
  const p = createDemo(); p.fps = 30; p.shots = p.shots.slice(0, 2);
  p.shots[0].duration = .8; p.shots[0].edit = { sequence_id: 'SQ04', job_id: 'J01', shot_id: '04A', raw_in: .1, raw_out: .7, sequence_in: 10 };
  p.shots[1].duration = .9; p.shots[1].edit = { sequence_id: 'SQ04', job_id: 'J01', shot_id: '04B', raw_in: 0, raw_out: .9, sequence_in: 10.6 };
  validateProject(p);
  assert.equal(Math.round(totalDuration(p) * p.fps), 51);
  assert.equal(locateShot(p, 23 / 30).index, 0); assert.equal(locateShot(p, 24 / 30).index, 1);
  assert.equal(mapLocalToSequence(p.shots[0], .1), 10);
  const m = shotManifest(p); assert.equal(m[1].job_local_in, .8); assert.equal(m[1].sequence_edit_out, 11.5);
  p.fps = 25; assert.throws(() => validateProject(p), /kelipatan 1 frame/);
});
test('posture and rotation transitions carry across subsequent shots', () => {
  const p = createDemo(), a = p.actors[0], b = p.shots[0].blocking[0];
  Object.assign(b, { poseStart: 'sit', poseEnd: 'kneel', rotationStart: 0, rotationEnd: 90 });
  validateProject(p);
  const start = actorPose(p, 0, 0, a), mid = actorPose(p,0,3,a), next = actorPose(p,1,0,a);
  assert.equal(start.poseStart,'sit'); assert.equal(mid.rotation,45); assert.equal(mid.poseProgress,.5);
  assert.equal(next.poseStart,'kneel'); assert.equal(next.poseEnd,'kneel'); assert.equal(next.rotation,90);
});
test('cumulative decimal cut boundaries select the correct frame, without one-frame delays', () => {
  const p = createDemo(); p.fps = 30; p.shots = p.shots.slice(0,3);
  [.8,.9,1.3].forEach((d,i) => { p.shots[i].duration=d; p.shots[i].edit.raw_out=d; });
  validateProject(p);
  assert.equal(locateShot(p,23/30).index,0); assert.equal(locateShot(p,24/30).index,1);
  assert.equal(locateShot(p,50/30).index,1); assert.equal(locateShot(p,51/30).index,2);
  assert.equal(locateShot(p,51/30).localTime,0);
});
