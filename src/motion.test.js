import test from 'node:test';
import assert from 'node:assert/strict';
import {actorPose,buildPrompt,cameraPathTimes,createDemo,evaluateShot,validateProject,setOrbitSweep} from './model.js';
import {addMotionKey,blockingTrack,cutCamera,directShot,removeActor} from './director.js';
import {technicalCues} from './shot-controls.js';

test('camera keys are sampled by frame with signed orbit, target, focus and handheld offsets',()=>{
  const p=createDemo(), shot=p.shots[0], camera=shot.camera;
  camera.easing='linear';
  addMotionKey(p,shot,36);
  const key=camera.keys[0];
  Object.assign(key,{target:[0,1,0],lens:62,focus:4,roll:-8});
  setOrbitSweep(camera,-360);
  const pose=evaluateShot(shot,1.5);
  assert.ok(cameraPathTimes(shot).includes(1.5));
  pose.position.forEach((n,i)=>assert.ok(Math.abs(n-key.position[i])<1e-9));
  assert.deepEqual([pose.lens,pose.focus,pose.roll],[62,4,-8]);
  assert.deepEqual(pose.target,key.target);
  camera.movement='handheld';
  const base=evaluateShot(shot,1.5,{handheld:false});
  assert.ok(Math.abs(evaluateShot(shot,1.5).position[0]-base.position[0]-Math.sin(1.5*4.7)*.025)<1e-8);
  assert.match(buildPrompt(p,shot),/1\.500s: camera/);
  const revised=directShot(shot,'key 36: cam (2,1,3) target (0,1,0) lens 70 focus 2',24).shot;
  assert.equal(revised.action,shot.action);
  assert.equal(revised.camera.keys.length,1);
  assert.deepEqual(revised.camera.keys[0].position,[2,1,3]);
  assert.equal(revised.camera.keys[0].lens,70);
  assert.throws(()=>addMotionKey(p,shot,36),/Sudah ada/);
});

test('cut and recut camera leave actor marks, phase, pose and duration identical at every original frame',()=>{
  const legacy=createDemo(), p=validateProject(legacy), shot=p.shots[0], actor=p.actors[0];
  addMotionKey(p,shot,36,actor);
  Object.assign(shot.blocking[0].keys[0],{position:[-1,0,2],rotation:76,pose:'sit',holdFrames:8});
  const expected=Array.from({length:144},(_,i)=>actorPose(p,0,i/24,actor));
  assert.deepEqual(expected[37].position,expected[40].position);
  const nextId=cutCamera(p,shot,48);
  cutCamera(p,p.shots[1],31);
  assert.equal(p.shots[1].id,nextId);
  assert.equal(validateProject(p).schema,'warkai-previz/3');
  assert.equal(legacy.takes,undefined);
  for (let i=0;i<144;i++) {
    const index=i<48?0:i<79?1:2, offset=[0,48,79][index];
    const pose=actorPose(p,index,(i-offset)/24,actor);
    for (const field of ['position','mark']) pose[field].forEach((v,k)=>assert.ok(Math.abs(v-expected[i][field][k])<1e-10));
    for (const field of ['rotation','roll','poseProgress']) assert.ok(Math.abs(pose[field]-expected[i][field])<1e-10);
    assert.equal(pose.action,expected[i].action);
  }
  p.shots[1].camera.easing='linear';
  assert.equal(blockingTrack(p,p.shots[0],actor),blockingTrack(p,p.shots[1],actor));
  removeActor(p,actor.id); validateProject(p);
});

test('Director receives actionable cues for missing performance and contradictory declared shot duration',()=>{
  const p=createDemo(), shot=p.shots[0];
  shot.action='Ayah mendekati anak sambil memegang HP. Durasi shot 3 detik.';
  shot.blocking=[];
  assert.equal(technicalCues(p,shot).length,3);
  addMotionKey(p,shot,24,p.actors[0]);shot.blocking[0].keys[0].holdFrames=999;
  assert.throws(()=>validateProject(p),/durasi diam/);
});
