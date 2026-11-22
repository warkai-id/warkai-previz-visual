import test from 'node:test';
import assert from 'node:assert/strict';
import { DirectionalLight, Scene, Vector3 } from 'three';
import { applyLightRig, defaultLightRig, describeLightRig, lightRigInspector, validateLightRig } from './light-rig.js';

const legacy = {mode:'scene',preset:'overcast',azimuth:90,elevation:45,intensity:2.7};

test('initial rig matches the preset key, with the fill initially off', () => {
  const rig = validateLightRig(defaultLightRig(legacy));
  assert.equal(rig.key.intensity,2.7);
  assert.equal(rig.key.color,'#f4f8ff');
  assert.deepEqual(rig.key.target,[0,0,0]);
  assert.ok(Math.abs(rig.key.position[0]-18/Math.sqrt(2)) < 1e-9);
  assert.equal(rig.fill.intensity,0);
});

test('rig lights use scene-space targets and scrub back to legacy, local, black and custom shots', () => {
  const scene = new Scene(), key = new DirectionalLight();
  const engine = {scene,key};
  scene.add(key);
  const rig = defaultLightRig(legacy);
  Object.assign(rig.key,{target:[1,2,3],shadows:false});
  Object.assign(rig.fill,{intensity:1.5,color:'#44ffaa',position:[2,6,1],target:[1,0,-2]});
  const shotLight = {...legacy,rig};
  applyLightRig(engine,shotLight);
  scene.updateMatrixWorld();
  assert.deepEqual(key.target.getWorldPosition(new Vector3()).toArray(),rig.key.target);
  assert.deepEqual(engine.fill.target.getWorldPosition(new Vector3()).toArray(),rig.fill.target);
  assert.equal(key.castShadow,false);
  assert.equal(engine.fill.intensity,1.5);
  assert.equal(engine.fill.visible,true);
  assert.equal(engine.fill.color.getHexString(),'44ffaa');
  const count = scene.children.length;
  for (const mode of ['local','black']) {
    key.intensity = 0; // legacy applyLighting already applied.
    applyLightRig(engine,{...shotLight,mode});
    assert.equal(key.intensity,0);
    assert.equal(engine.fill.visible,false);
    assert.equal(describeLightRig({...shotLight,mode}),'');
  }
  applyLightRig(engine,legacy);
  assert.deepEqual(key.target.position.toArray(),[0,0,0]);
  assert.equal(key.castShadow,true);
  applyLightRig(engine,shotLight);
  assert.equal(scene.children.length,count);
  assert.equal(engine.fill.visible,true);
  assert.match(describeLightRig(shotLight),/fill directional light.*#44ffaa/);
});

test('malformed directed lights fail project validation and controls reflect render mode', () => {
  for(const change of [
    r => r.fill.intensity = '1', r => r.key.color = 'red', r => r.key.shadows = 'false',
    r => r.fill.position = r.fill.target, r => r.fill.target[0] = Infinity,
  ]){
    const rig = defaultLightRig(legacy);
    change(rig);
    assert.throws(() => validateLightRig(rig),/Rig cahaya tidak valid/);
  }
  const helpers = {field:(name,path)=>path,vectorFields:(name,path)=>path};
  assert.match(lightRigInspector(legacy,helpers), /add-light-rig/);
  const rig = defaultLightRig(legacy);
  assert.match(lightRigInspector({...legacy,rig},helpers), /rig.fill.intensity/);
  assert.equal(lightRigInspector({...legacy,mode:'local',rig},helpers),'');
});
