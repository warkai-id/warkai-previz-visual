import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { aragiWarnings, clipsForAragiExport, projectFromAragiPlan, validateAragiPlan } from './aragi-plan.js';
import { locateShot, validateProject } from './model.js';

const fixture = () => JSON.parse(readFileSync(new URL('../examples/aragi-manual.plan.json', import.meta.url)));

test('manual plan preserves supplied story, requirements, timecodes and clip instructions on round-trip', () => {
  const input = fixture();
  const project = validateProject(JSON.parse(JSON.stringify(projectFromAragiPlan(input))));
  assert.deepEqual(project.aragiPlan, input);
  assert.notEqual(project.aragiPlan, input);
  assert.equal(project.description, input.requirements);
  assert.deepEqual(project.shots.map(s => s.action), input.shots.map(s => s.text));
  assert.deepEqual(project.shots.map(s => s.sourceShotId), ['SH001','SH002']);
  assert.equal(project.actors[0].characterTag, 'CHAR_001');
  assert.equal(project.actors[0].type, 'pill-person');
  assert.equal(locateShot(project,4).shot.id, locateShot(project,4-1/24).shot.id);
  const clips = clipsForAragiExport(project);
  assert.deepEqual(clips.map(({clipId,warkaiShotIds,...clip}) => clip), input.clips);
  assert.deepEqual(clips.map(c => c.warkaiShotIds.length), [1,2]);
  assert.match(aragiWarnings(project).join(' '), /referensi.*pemeran.*potong/s);
  input.clips[0].endFrameExclusive = 50;
  clips[1].shotIds.reverse();
  assert.equal(project.aragiPlan.clips[0].endFrameExclusive, 96);
  assert.deepEqual(project.aragiPlan.clips[1].shotIds,['SH001','SH002']);
});

test('invalid plan fields fail import before a project can be opened', () => {
  const invalid = [
    p => p.fps = 25,
    p => p.clips[0].id = 'unsafe "',
    p => p.shots[0].text = '',
    p => p.clips[1].shotIds = ['SH002','SH001'],
    p => p.clips[1].continuesPrevious = false,
    p => p.clips[1].startFrame++,
    p => p.clips[1].id = p.clips[0].id,
    p => p.clips[0].startSeconds = '0',
    p => p.clips[0].durationSeconds++,
    p => p.clips[1].order = 1,
    p => p.clips[1].shotIds = ['SH999'],
    p => p.target.referenceSeconds = 5,
    p => p.target.maxSeconds = 5,
    p => p.target.minSeconds = 5,
    p => p.target.ratios = ['9:16'],
    p => p.target.referenceSeconds = undefined,
  ];
  for (const change of invalid) {
    const plan = fixture();
    change(plan);
    assert.throws(() => projectFromAragiPlan(plan), /Plan Aragi tidak valid/);
  }
});

test('camera/actor revisions remain exportable while stale timeline/trim/source conflicts are reported', () => {
  const project = projectFromAragiPlan(fixture());
  project.actors[0].name = 'Rani';
  project.shots[0].camera.start.position[0] += 1;
  assert.equal(clipsForAragiExport(project).length, 2);
  assert.ok(aragiWarnings(project).every(w => !w.includes('Karakter 01')));
  const edits = [
    p => p.aspect = '4:3',
    p => p.fps = 30,
    p => p.shots.reverse(),
    p => p.shots[0].duration += 1/24,
    p => p.shots[0].edit.raw_in = 1/24,
    p => p.shots[1].edit.sequence_in = 0,
    p => p.shots[1].sourceShotId = 'SH001',
    p => p.shots.splice(1,1),
  ];
  for (const edit of edits) {
    const changed = structuredClone(project);
    edit(changed);
    assert.throws(() => clipsForAragiExport(changed), /Ekspor klip Aragi tertahan/);
    assert.match(aragiWarnings(changed)[0], /Ekspor klip Aragi tertahan/);
  }
});

test('180 seconds in six planned clean clips keeps one source beat across long local shots', () => {
  const plan = fixture();
  plan.durationSeconds = 180;
  plan.mode = 'auto';
  plan.shots = [plan.shots[0]];
  plan.clips = Array.from({length:6}, (_,i) => ({
    id:'CL00'+(i+1), order:i+1, direction:'', startFrame:i*720,endFrameExclusive:(i+1)*720,
    startSeconds:i*30,endSeconds:(i+1)*30,durationSeconds:30,shotIds:['SH001'],continuesPrevious:i>0,status:'planned',
  }));
  validateAragiPlan(plan);
  const project = projectFromAragiPlan(plan);
  assert.deepEqual(project.shots.map(s => s.duration), [60,60,60]);
  const clips = clipsForAragiExport(project);
  assert.equal(clips.length, 6);
  assert.deepEqual(clips.map(c => c.durationSeconds), Array(6).fill(30));
  assert.deepEqual(clips[0].warkaiShotIds, clips[1].warkaiShotIds);
  assert.notDeepEqual(clips[1].warkaiShotIds, clips[2].warkaiShotIds);
  assert.equal(clips[5].endFrameExclusive,4320);
});
