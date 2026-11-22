import {applyLightRig} from './light-rig.js';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { evaluateShot, actorPose, actorState, shotLight, imageUV, aspectValue, locateShot, totalDuration, mix, mix3, cameraPathTimes } from './model.js';

const v3 = (a) => new THREE.Vector3(...a);
const mat = (c, extra = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.72, ...extra });
const solid = (g, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; return o; };
function pill(color, segmented = false) {
  const g=new THREE.Group(),body=mat(color,{roughness:.38});
  if(segmented){
    g.add(solid(new THREE.CapsuleGeometry(.245,.82,8,24),body,0,.655));
    g.add(solid(new THREE.BoxGeometry(.65,.105,.15),body,0,1.43,0));
    g.add(solid(new THREE.SphereGeometry(.205,24,18),body,0,1.635,0));
    // The white dot is a small facing cue, kept on the positive-Z side.
    const eye=solid(new THREE.SphereGeometry(.035,12,10),mat('#e5f1f3'),0,1.65,.195);g.add(eye);
  }else{
    g.add(solid(new THREE.CapsuleGeometry(.30,1.14,8,24),body,0,.87));
    g.add(solid(new THREE.SphereGeometry(.09,16,12),mat('#e6f4f8'),0,1.4,.28));
  }
  return g;
}
const POSE_HEIGHT={stand:1,sit:.76,kneel:.64,crouch:.53,lie:.3};
function poseFigure(g,a,pose){
  if(!['pill','pill-person'].includes(a.type))return;
  const height=mix(POSE_HEIGHT[pose.poseStart],POSE_HEIGHT[pose.poseEnd],pose.poseProgress);
  g.scale.set(a.scale,a.scale*height,a.scale);
}
function createObject(actor) {
  const g = new THREE.Group(), m = mat(actor.color);
  switch (actor.type) {
    case 'pill': return pill(actor.color);
    case 'pill-person': return pill(actor.color, true);
    case 'box': g.add(solid(new THREE.BoxGeometry(1, 1, 1), m, 0, 0.5)); break;
    case 'panel': {
      const lit = mat(actor.color, { side: THREE.DoubleSide });
      const unlit = new THREE.MeshBasicMaterial({ color: actor.color, side: THREE.DoubleSide, toneMapped: false });
      const panel = solid(new THREE.PlaneGeometry(1,1), lit, 0,.5,0);
      panel.name = 'cue-panel'; panel.userData.cueMaterials = {lit,unlit}; g.add(panel); break;
    }
    case 'sphere': g.add(solid(new THREE.SphereGeometry(0.65, 28, 20), m, 0, 0.65)); break;
    case 'column':
      g.add(solid(new THREE.CylinderGeometry(0.32, 0.38, 3, 24), m, 0, 1.5));
      g.add(solid(new THREE.CylinderGeometry(0.53, 0.53, 0.18, 24), m, 0, 0.09));
      g.add(solid(new THREE.CylinderGeometry(0.49, 0.49, 0.16, 24), m, 0, 2.95)); break;
    case 'chair': case 'bench': {
      const w = actor.type === 'bench' ? 2.4 : 0.8;
      g.add(solid(new THREE.BoxGeometry(w, 0.14, 0.7), m, 0, 0.66));
      g.add(solid(new THREE.BoxGeometry(w, 0.65, 0.1), m, 0, 1.05, -0.31));
      for (const x of [-w * 0.39, w * 0.39]) for (const z of [-0.24, 0.24]) g.add(solid(new THREE.BoxGeometry(0.09, 0.64, 0.09), mat('#454b48'), x, 0.32, z));
      break;
    }
    case 'rings': {
      const rings = new THREE.Group(); rings.name = 'orbital'; rings.position.y = 1.65;
      for (let i = 0; i < 3; i++) {
        const ring = solid(new THREE.TorusGeometry(1.35 + i * 0.08, 0.025, 8, 80), m); ring.rotation.set(i * 0.8, i * 0.9, i * 0.6); rings.add(ring);
      }
      rings.add(solid(new THREE.IcosahedronGeometry(0.3, 1), mat('#e9b85f', { metalness: 0.45, emissive: '#9c6725', emissiveIntensity: 0.3 })));
      g.add(rings); break;
    }
    case 'glb': break;
  }
  return g;
}
export class PrevizEngine {
  constructor(stageHost, monitorHost, labelsHost, onSelect, onTransform, onError, onContext, onCameraKey) {
    this.stageHost = stageHost; this.monitorHost = monitorHost; this.labelsHost = labelsHost; this.onError = onError; this.onCameraKey=onCameraKey;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#dedbd0');
    this.stageRenderer = this.makeRenderer(stageHost); this.monitorRenderer = this.makeRenderer(monitorHost);
    this.stageCamera = new THREE.PerspectiveCamera(42, 1, 0.1, 300); this.stageCamera.position.set(9, 7, 10);
    this.camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.05, 300); this.camera.filmGauge = 36;
    this.controls = new OrbitControls(this.stageCamera, this.stageRenderer.domElement); this.controls.target.set(0, 0.8, -0.5); this.controls.enableDamping = true;
    this.transform = new TransformControls(this.stageCamera, this.stageRenderer.domElement); this.transform.setSize(0.85);
    this.helpers = new THREE.Group(); this.scene.add(this.helpers); this.helpers.add(this.transform.getHelper());
    this.transform.addEventListener('dragging-changed', (e) => { this.controls.enabled = !e.value; this.dragging = e.value; });
    this.transform.addEventListener('mouseUp', () => { if (this.transform.object) onTransform(this.transform.object.userData.cameraKey ? '@camera:'+this.transform.object.userData.cameraKey : this.transform.object.userData.actorId, this.transform.object.position.toArray(), [this.transform.object.rotation.x,this.transform.object.rotation.y,this.transform.object.rotation.z].map(THREE.MathUtils.radToDeg)); });
    this.helperCamera = this.camera.clone(); this.cameraHelper = new THREE.CameraHelper(this.helperCamera); this.helpers.add(this.cameraHelper);
    this.path = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({color:'#257963',depthTest:false})); this.helpers.add(this.path);this.path.renderOrder=998;this.pathArrows=new THREE.Group();this.helpers.add(this.pathArrows);
    this.cameraMarker = solid(new THREE.BoxGeometry(0.36, 0.25, 0.5), mat('#243b34')); this.helpers.add(this.cameraMarker);
    this.keyMarkers=new Map();
    this.keyLabels=document.createElement('div');this.keyLabels.className='camera-key-labels';stageHost.parentElement.append(this.keyLabels);
    this.key = new THREE.DirectionalLight('#fff1d6', 3.5); this.key.castShadow = true; this.key.shadow.mapSize.set(2048, 2048); Object.assign(this.key.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 0.1, far: 60 }); this.key.shadow.bias = -0.0003; this.key.shadow.normalBias = 0.025; this.scene.add(this.key);
    this.hemi = new THREE.HemisphereLight('#e3eff2', '#a09883', 2); this.scene.add(this.hemi);
    this.practicals = Array.from({length:4},()=> { const light = new THREE.PointLight('#ffffff',0,3,2); this.scene.add(light); return light; });
    this.textures = new Map(); this.textureLoader = new THREE.TextureLoader();
    this.ground = solid(new THREE.PlaneGeometry(200, 200), mat('#c9c3b3')); this.ground.rotation.x = -Math.PI / 2; this.ground.position.y = -0.015; this.ground.castShadow = false; this.scene.add(this.ground);
    this.grid = new THREE.GridHelper(30, 30, '#8c9992', '#b1b8ad'); this.grid.position.y = 0.003; this.grid.material.transparent = true; this.grid.material.opacity = 0.32; this.scene.add(this.grid);
    this.objects = new Map(); this.mixers = new Map(); this.loader = new GLTFLoader(); this.raycaster = new THREE.Raycaster();
    this.selectionBox = new THREE.BoxHelper(undefined, '#417a61'); this.helpers.add(this.selectionBox); this.selectionBox.visible = false;
    let down;
    this.stageRenderer.domElement.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY]; });
    this.stageRenderer.domElement.addEventListener('pointerup', (e) => {
      if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 4 || this.transform.axis) return;
      const r = this.stageRenderer.domElement.getBoundingClientRect(); this.raycaster.setFromCamera(new THREE.Vector2((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1), this.stageCamera);
      const keyHit=this.raycaster.intersectObjects([...this.keyMarkers.values()].filter(m=>m.visible),false)[0];if(keyHit&&this.helpers.visible){onCameraKey?.(keyHit.object.userData.cameraKey);return;}
      const hit = this.raycaster.intersectObjects([...this.objects.values()].filter(o=>o.visible), true)[0];
      if (hit) { let o = hit.object; while (o && !o.userData.actorId) o = o.parent; if (o) onSelect(o.userData.actorId); }
    });
    this.stageRenderer.domElement.addEventListener('contextmenu',e=>{e.preventDefault();const r=this.stageRenderer.domElement.getBoundingClientRect();this.raycaster.setFromCamera(new THREE.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1),this.stageCamera);const hit=this.raycaster.intersectObjects([...this.objects.values()].filter(o=>o.visible),true)[0];let o=hit?.object;while(o&&!o.userData.actorId)o=o.parent;onContext?.(o?.userData.actorId||null,e.clientX,e.clientY);});
    this.resizeObserver = new ResizeObserver(() => this.resize()); this.resizeObserver.observe(stageHost); this.resizeObserver.observe(monitorHost);
    this.resize();
  }
  makeRenderer(host) {
    const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: false });
    r.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFShadowMap; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1;
    host.append(r.domElement); return r;
  }
  resize() {
    const w = Math.max(1, this.stageHost.clientWidth), h = Math.max(1, this.stageHost.clientHeight);
    this.stageRenderer.setSize(w, h); this.stageCamera.aspect = w / h; this.stageCamera.updateProjectionMatrix();
    const mw = Math.max(1, this.monitorHost.clientWidth), mh = Math.max(1, this.monitorHost.clientHeight);
    this.monitorRenderer.setSize(mw, mh);
  }
  disposeObject(g) { const mats=new Set(),textures=new Set();g.traverse(o=>{o.geometry?.dispose();for(const m of [...(Array.isArray(o.material)?o.material:[o.material]),...Object.values(o.userData.cueMaterials||{})]) if(m)mats.add(m);});for(const m of mats){for(const v of Object.values(m))if(v?.isTexture)textures.add(v);m.dispose();}for(const t of textures)t.dispose(); }
  rebuild(project) {
    this.project = project; this.transform.detach(); this.selectionBox.visible = false;
    for (const o of this.objects.values()) { this.scene.remove(o); this.disposeObject(o); }
    this.objects.clear(); this.mixers.clear(); this.labelsHost.replaceChildren();
    for (const t of this.textures.values()) t.dispose(); this.textures.clear();
    this.buildToken = (this.buildToken || 0) + 1; const token = this.buildToken;
    const loading = []; this.assetErrors = [];
    const images = new Set([...project.actors.map(a=>a.image),...project.shots.flatMap(s=>(s.states||[]).map(x=>x.image))].filter(Boolean));
    for(const src of images) loading.push(new Promise(resolve=>this.textureLoader.load(src,texture=>{ if(this.buildToken===token){texture.colorSpace=THREE.SRGBColorSpace;this.textures.set(src,texture);}else texture.dispose();resolve();},undefined,()=>{if(this.buildToken===token)this.assetErrors.push('Plate gambar gagal dimuat.');resolve();})));
    for (const a of project.actors) {
      const g = createObject(a); g.userData.actorId = a.id; g.scale.setScalar(a.scale); g.visible = a.visible; this.scene.add(g); this.objects.set(a.id, g);
      const label = document.createElement('span'); label.className = 'actor-label'; label.dataset.actorId = a.id; label.textContent = a.name+(a.characterTag?' · '+a.characterTag:''); this.labelsHost.append(label);
      if (a.type === 'glb') {
        const buffer = Uint8Array.from(atob(a.asset.split(',')[1]), (c) => c.charCodeAt(0)).buffer;
        loading.push(new Promise(resolve => this.loader.parse(buffer, '', (gltf) => {
          if (this.buildToken !== token) { this.disposeObject(gltf.scene); resolve(); return; }
          const model = gltf.scene, box = new THREE.Box3().setFromObject(model), size = box.getSize(new THREE.Vector3());
          const norm = 1.8 / Math.max(size.y, 0.01); model.scale.setScalar(norm); box.setFromObject(model);
          const center = box.getCenter(new THREE.Vector3()); model.position.set(-center.x, -box.min.y, -center.z);
          model.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); g.add(model);
          if (gltf.animations.length) { const mixer = new THREE.AnimationMixer(model); mixer.clipAction(gltf.animations[0]).play(); this.mixers.set(a.id, mixer); }
          resolve();
        }, (e) => { if (this.buildToken === token) { const message = `GLB ${a.name}: ${e.message || 'format tidak didukung. Gunakan GLB tanpa Draco.'}`; this.assetErrors.push(message); this.onError(message); } resolve(); })));
      }
    }
    this.applyLighting(project.light);
    this.camera.aspect = aspectValue(project.aspect); this.camera.updateProjectionMatrix();
    this.assetsReady = Promise.all(loading);
  }
  async waitForAssets() { await this.assetsReady; if (this.assetErrors.length) throw new Error(this.assetErrors.join(' / ')); }
  applyLighting(light) {
    const presets = { golden: ['#ffe0ab', '#e5edf0', '#b0a386', 1.7], overcast: ['#f4f8ff', '#e2edf7', '#8c9199', 2.5], night: ['#bacfff', '#54738e', '#17202b', 0.65], studio: ['#ffffff', '#edf3ff', '#869083', 2.3] };
    const p = presets[light.preset]; this.key.color.set(p[0]); this.hemi.color.set(p[1]); this.hemi.groundColor.set(p[2]); this.hemi.intensity = light.ambient ?? p[3]; this.key.intensity = light.intensity;
    if (light.mode === 'local' || light.mode === 'black') { this.hemi.intensity=0; this.key.intensity=0; }
    const az = THREE.MathUtils.degToRad(light.azimuth), el = THREE.MathUtils.degToRad(light.elevation);
    this.key.position.set(18 * Math.cos(el) * Math.sin(az), 18 * Math.sin(el), 18 * Math.cos(el) * Math.cos(az)); this.ground.material.color.set(light.ground); this.scene.background.set(light.mode === 'local' || light.mode === 'black' ? '#000000' : light.background);
    applyLightRig(this,light);
  }
  applyObjectState(root, actor, state) {
    const dark=this.currentLight.mode==='local'||this.currentLight.mode==='black';
    root.traverse(o=>{
      if(!o.material) return;
      if(o.userData.cueMaterials){o.material=o.userData.cueMaterials[state.unlit?'unlit':'lit'];const source=state.image?this.textures.get(state.image)||null:null;if(o.userData.panelSource!==source){o.userData.panelMap?.dispose();o.userData.panelSource=source;o.userData.panelMap=source?.clone()||null;if(o.userData.panelMap)o.userData.panelMap.needsUpdate=true;}const tex=o.userData.panelMap;if(tex){const uv=imageUV(state.imageRegion);tex.offset.fromArray(uv.offset);tex.repeat.fromArray(uv.repeat);}if(o.material.map!==tex){o.material.map=tex;o.material.needsUpdate=true;}}
      for(const m of Array.isArray(o.material)?o.material:[o.material]){
        if(!m.userData.base){m.userData.base={color:m.color?.clone(),emissive:m.emissive?.clone(),intensity:m.emissiveIntensity||0,tintable:m.color?.getHexString()===actor.color.slice(1).toLowerCase()};}
        const base=m.userData.base;
        if(base.color)m.color.copy(base.color);if(base.tintable||o.userData.cueMaterials)m.color.set(state.color);
        if(m.emissive){m.emissive.copy(dark?new THREE.Color('#000000'):base.emissive||new THREE.Color('#000000'));m.emissiveIntensity=dark?0:base.intensity;if(state.emissive>0){m.emissive.set(state.color);m.emissiveIntensity=state.emissive;}}
      }
    });
  }
  syncKeyMarkers(shot) {
    const marks=[['start','IN'],...(shot.camera.keys || []).map((_,i)=>['keys.'+i,'K'+(i+1)]),['end','OUT']];
    const active=new Set();
    for (const [key,name] of marks) for (const part of ['position','target']) {
      const id=key+'.'+part;
      active.add(id);
      if(this.keyMarkers.has(id)) continue;
      const marker=solid(new THREE.SphereGeometry(part==='target'?.09:.14,16,12),new THREE.MeshBasicMaterial({color:key==='end'?'#edb767':'#72cbef',depthTest:false}));
      marker.renderOrder=999;marker.userData.cameraKey=id;this.helpers.add(marker);this.keyMarkers.set(id,marker);
      const label=document.createElement('button');label.className='camera-key-label';label.dataset.key=id;
      label.textContent=name+(part==='target'?' · TARGET':' · CAM');label.onclick=()=>this.onCameraKey?.(id);this.keyLabels.append(label);
    }
    for (const label of [...this.keyLabels.children]) if(!active.has(label.dataset.key)) {
      const marker=this.keyMarkers.get(label.dataset.key);
      if(this.transform.object===marker)this.transform.detach();
      this.helpers.remove(marker);this.disposeObject(marker);this.keyMarkers.delete(label.dataset.key);label.remove();
    }
  }
  selectCameraKey(id){
    const marker=this.keyMarkers.get(id);
    this.selected=null;
    if(marker)this.transform.attach(marker);else this.transform.detach();
    this.transform.setMode('translate');this.selectionBox.visible=false;
  }
  select(id, mode = 'translate') {
    this.selected = id; const o = this.objects.get(id);
    if (o) { this.transform.attach(o); this.transform.setMode(mode); this.selectionBox.setFromObject(o); this.selectionBox.visible = true; }
    else { this.transform.detach(); this.selectionBox.visible = false; }
  }
  setView(view) {
    if (view === 'top') { this.stageCamera.position.set(0, 22, 0.01); this.controls.target.set(0, 0, -1); }
    else { this.stageCamera.position.set(9, 7, 10); this.controls.target.set(0, 0.8, -0.5); }
    this.controls.update();
  }
  getStagePose() { return { position: this.stageCamera.position.toArray(), target: this.controls.target.toArray() }; }
  setStageToCamera() { this.stageCamera.position.copy(this.camera.position); this.controls.target.copy(this.currentPose.target ? v3(this.currentPose.target) : new THREE.Vector3()); this.controls.update(); }
  update(time, { guides = true, grid = true, render = true } = {}) {
    const p = this.project; if (!p) return;
    const { shot, index, localTime } = locateShot(p, time), pose = evaluateShot(shot, localTime); this.currentPose = pose;
    this.currentLight=shotLight(p,shot); this.applyLighting(this.currentLight);
    this.camera.position.fromArray(pose.position); this.camera.lookAt(v3(pose.target));this.camera.rotateZ(THREE.MathUtils.degToRad(pose.roll));
    // Horizontal sensor width stays 36 mm for every output aspect ratio.
    this.camera.filmGauge = 36 / Math.min(this.camera.aspect, 1);
    this.camera.setFocalLength(pose.lens); this.camera.updateMatrixWorld();
    for (const a of p.actors) {
      const o = this.objects.get(a.id), ap = actorPose(p, index, localTime, a);
      if (!(this.dragging && a.id === this.selected)) { o.position.fromArray(ap.position); o.rotation.set(THREE.MathUtils.degToRad(ap.pitch), THREE.MathUtils.degToRad(ap.rotation), THREE.MathUtils.degToRad(ap.roll)); }
      o.scale.setScalar(a.scale); poseFigure(o, a, ap); o.scale.multiply(v3(a.dimensions || [1,1,1]));
      const state=actorState(p,shot,a); o.visible=state.visible; this.applyObjectState(o,a,state);
      const orbital = ap.orbital && o.getObjectByName('orbital');
      if (orbital) { orbital.rotation.x = ap.orbital[0]; orbital.rotation.y = ap.orbital[1]; }
      this.mixers.get(a.id)?.setTime(time);
    }
    this.practicals.forEach((light,i)=>{const cfg=this.currentLight.practicals[i],o=cfg&&this.objects.get(cfg.actorId);light.intensity=cfg&&o?.visible&&this.currentLight.mode!=='black'?cfg.intensity:0;if(cfg&&o){light.color.set(cfg.color);light.distance=cfg.distance;light.position.copy(o.position).add(v3(cfg.offset));}});
    if (this.selected && this.objects.has(this.selected)) this.selectionBox.setFromObject(this.objects.get(this.selected));
    this.cameraMarker.position.copy(this.camera.position); this.cameraMarker.quaternion.copy(this.camera.quaternion);
    this.helperCamera.copy(this.camera); this.helperCamera.far = 3; this.helperCamera.near = .2; this.helperCamera.updateProjectionMatrix(); this.cameraHelper.update();
    if (this.lastShot !== shot || this.pathDirty) {
      this.syncKeyMarkers(shot);
      const points = cameraPathTimes(shot).map(t=>v3(evaluateShot(shot,t).position));
      this.path.geometry.dispose(); this.path.geometry = new THREE.BufferGeometry().setFromPoints(points); this.path.computeLineDistances();
      for(const o of this.pathArrows.children){o.line.geometry.dispose();o.cone.geometry.dispose();o.line.material.dispose();o.cone.material.dispose();}this.pathArrows.clear();
      for(let i=8;i<points.length;i+=Math.max(8,Math.floor(points.length/8))){const from=points[i-2],to=points[i],dir=to.clone().sub(from);if(dir.length()>.001){const arrow=new THREE.ArrowHelper(dir.normalize(),from,.38,'#328d71',.17,.09);arrow.line.material.depthTest=false;arrow.cone.material.depthTest=false;this.pathArrows.add(arrow);}}
      this.lastShot = shot; this.pathDirty = false;
    }
    for(const [id,marker]of this.keyMarkers){if(!(this.dragging&&this.transform.object===marker))marker.position.fromArray(id.split('.').reduce((v,k)=>v[k],shot.camera));}
    for(const label of this.keyLabels.children){const marker=this.keyMarkers.get(label.dataset.key),point=marker.position.clone().project(this.stageCamera);marker.visible=!!this.cameraKeysEnabled;label.hidden=!guides||!this.cameraKeysEnabled||point.z>1;label.style.left=`${(point.x+1)*50}%`;label.style.top=`${(-point.y+1)*50}%`;}
    this.controls.update(); this.grid.visible = grid;
    if (render) {
      this.helpers.visible = guides; this.stageRenderer.render(this.scene, this.stageCamera);
      this.renderMonitor();
      this.helpers.visible = guides;
      for (const el of this.labelsHost.children) {
        const o = this.objects.get(el.dataset.actorId); const point = o.position.clone().add(new THREE.Vector3(0, 2.15 * o.scale.y, 0)).project(this.stageCamera);
        const a = p.actors.find(a => a.id === el.dataset.actorId), important = ['pill','pill-person','glb'].includes(a.type) || a.id === this.selected;
        el.style.display = guides && important && o.visible && point.z < 1 ? '' : 'none'; el.style.left = `${(point.x + 1) * 50}%`; el.style.top = `${(-point.y + 1) * 50}%`;
      }
    }
    return { ...pose, shot, index, localTime };
  }
  renderMonitor() {
    this.helpers.visible = false;
    const r = this.monitorRenderer, canvas = r.domElement, ratio = this.camera.aspect, w = canvas.clientWidth, h = canvas.clientHeight;
    r.setScissorTest(false); r.setClearColor(this.currentLight?.mode==='black'?'#000000':'#171c1c'); r.clear();
    if(this.currentLight?.mode==='black') return;
    const vw = Math.min(w, h * ratio), vh = vw / ratio;
    r.setViewport((w - vw) / 2, (h - vh) / 2, vw, vh); r.setScissor((w - vw) / 2, (h - vh) / 2, vw, vh); r.setScissorTest(true);
    const grid=this.grid.visible;if(this.currentLight?.mode==='local')this.grid.visible=false;
    r.render(this.scene, this.camera);this.grid.visible=grid; r.setScissorTest(false); r.setViewport(0, 0, w, h);
  }
  captureFrame(width = 1920) {
    const h = Math.round(width / this.camera.aspect);
    if (!this.exportRenderer) {
      this.exportRenderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
      this.exportRenderer.shadowMap.enabled = true; this.exportRenderer.shadowMap.type = THREE.PCFShadowMap;
      this.exportRenderer.toneMapping = THREE.ACESFilmicToneMapping; this.exportRenderer.setPixelRatio(1);
    }
    const r = this.exportRenderer;
    if (r.domElement.width !== width || r.domElement.height !== h) r.setSize(width, h, false);
    this.helpers.visible = false;
    if(this.currentLight?.mode==='black'){r.setClearColor('#000000');r.clear();return r.domElement;}
    const grid=this.grid.visible;if(this.currentLight?.mode==='local')this.grid.visible=false;
    r.render(this.scene, this.camera);this.grid.visible=grid; return r.domElement;
  }
  drawRadar(canvas, time) {
    const ctx = canvas.getContext('2d'), dpr = window.devicePixelRatio || 1, w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h); const scale = Math.min(w / 20, h / 15), x = (v) => w / 2 + v * scale, y = (v) => h / 2 + (v + 1) * scale;
    ctx.strokeStyle = '#30383b'; ctx.lineWidth = 0.5;
    for (let i = -15; i <= 15; i++) { ctx.beginPath(); ctx.moveTo(x(i), 0); ctx.lineTo(x(i), h); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, y(i)); ctx.lineTo(w, y(i)); ctx.stroke(); }
    const { shot, index, localTime } = locateShot(this.project, time), pose = evaluateShot(shot, localTime);
    ctx.strokeStyle = '#8fbba0'; ctx.setLineDash([3, 3]); ctx.beginPath(); cameraPathTimes(shot).forEach((t,i)=>{ const p=evaluateShot(shot,t).position; i ? ctx.lineTo(x(p[0]),y(p[2])) : ctx.moveTo(x(p[0]),y(p[2])); }); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#a5c9af20'; ctx.strokeStyle = '#a5c9af88'; ctx.beginPath(); ctx.moveTo(x(pose.position[0]), y(pose.position[2]));
    const theta = Math.atan2(pose.target[2] - pose.position[2], pose.target[0] - pose.position[0]), spread = Math.atan(18 / pose.lens);
    for (const sign of [-1, 1]) ctx.lineTo(x(pose.position[0] + Math.cos(theta + sign * spread) * 5), y(pose.position[2] + Math.sin(theta + sign * spread) * 5)); ctx.closePath(); ctx.fill(); ctx.stroke();
    for (const a of this.project.actors.filter((a) => actorState(this.project,shot,a).visible)) { const p = actorPose(this.project, index, localTime, a).position; ctx.fillStyle = actorState(this.project,shot,a).color; ctx.beginPath(); ctx.arc(x(p[0]), y(p[2]), ['pill', 'pill-person', 'glb'].includes(a.type) ? 4 : 2.5, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#c4e9b6'; ctx.fillRect(x(pose.position[0]) - 3, y(pose.position[2]) - 3, 6, 6); ctx.font = '9px monospace'; ctx.fillText('CAM', x(pose.position[0]) + 7, y(pose.position[2]) + 3);
  }
  drawCurves(canvas, time) {
    const ctx = canvas.getContext('2d'), w = canvas.clientWidth, h = canvas.clientHeight, dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr; canvas.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); const total = totalDuration(this.project);
    ctx.strokeStyle = '#2c3437'; ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) { ctx.beginPath(); ctx.moveTo(0, i * h / 4); ctx.lineTo(w, i * h / 4); ctx.stroke(); }
    for (const [key, color, max] of [['lens', '#83b1c7', 120], ['focusDistance', '#d7b277', 25]]) {
      ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.beginPath();
      for (let i = 0; i <= 250; i++) { const l = locateShot(this.project, total * i / 250), p = evaluateShot(l.shot, l.localTime); const x = i / 250 * w, y = h - 5 - Math.min(p[key] / max, 1) * (h - 10); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke();
    }
    ctx.strokeStyle = '#c3e5b4'; ctx.beginPath(); ctx.moveTo(time / total * w, 0); ctx.lineTo(time / total * w, h); ctx.stroke();
  }
}
