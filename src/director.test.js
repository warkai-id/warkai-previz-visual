import{test}from'node:test';import assert from'node:assert/strict';
import{createDemo,validateProject,totalDuration,evaluateShot,clone,nextCharacterIdentity}from'./model.js';
import{directShot,insertShot,storyToProject,removeActor}from'./director.js';
test('Director edits exact keys, lens endpoints and 360 sweep without losing IDs',()=>{
 const p=createDemo(),s=p.shots[0];const r=directShot(s,'orbit -360 derajat 50mm 0.9 detik; cam in (0,2,5); cam out (0,3,5); target in (0,1,0); target out (0,1,0); lens in 35; lens out 65; f/4; fokus 4; linear',30).shot;
 assert.equal(r.id,s.id);assert.equal(r.duration,.9);assert.deepEqual(r.camera.start.position,[0,2,5]);assert.equal(r.camera.start.lens,35);assert.equal(r.camera.end.lens,65);assert.equal(r.camera.orbitDegrees,-360);assert.equal(r.camera.aperture,4);assert.equal(r.camera.focus,4);assert.equal(r.camera.easing,'linear');p.fps=30;p.shots[0]=r;validateProject(p);
 assert.ok(evaluateShot(r,.9/4).position[0]<-4.9);
});
test('insert before/after preserves old shot IDs and shifts affected sequence edit placement',()=>{
 for(const side of ['before','after']){const p=createDemo(),old=p.shots.map(s=>s.id),ref=p.shots[1],oldIn=ref.edit.sequence_in,total=totalDuration(p);const id=insertShot(p,ref.id,side);validateProject(p);assert.equal(p.shots.length,5);assert.equal(totalDuration(p),total+5);assert.deepEqual(p.shots.filter(s=>s.id!==id).map(s=>s.id),old);assert.equal(p.shots.findIndex(s=>s.id===id),side==='before'?1:2);assert.equal(ref.edit.sequence_in,side==='before'?oldIn+5:oldIn);}
});
test('story draft retains entire source and creates named pill cast and frame-valid editable shots',()=>{
 const text='INT. HALAMAN — SORE\nAlya menunggu. Wide 35mm 0.8 detik.\n\nBima datang. Dolly 50mm 0.9 detik.';
 const p=storyToProject(text,{name:'Pertemuan',cast:'Alya,Bima',fps:30});assert.equal(p.shots.length,2);assert.equal(p.sourceStory.text,text);assert.equal(p.shots[0].duration,.8);assert.equal(p.shots[1].duration,.9);assert.deepEqual(p.actors.map(a=>a.type),['pill-person','pill-person']);assert.deepEqual(p.actors.map(a=>a.characterTag),['CHAR_001','CHAR_002']);assert.equal(p.shots[1].edit.sequence_in,.8);assert.equal(Math.round(totalDuration(p)*30),51);validateProject(p);
});
test('delete removes object dependencies and default names/codes cannot collide',()=>{
 const p=validateProject(createDemo()),a=p.actors[0];p.shots[0].states=[{actorId:a.id,visible:true}];p.shots[0].light={mode:'local',practicals:[{actorId:a.id,offset:[0,1,0],color:'#ffffff',intensity:1,distance:3}]};removeActor(p,a.id);validateProject(p);assert.equal(p.shots[0].blocking.length,0);assert.equal(p.shots[0].states.length,0);assert.equal(p.shots[0].light.practicals.length,0);const id=nextCharacterIdentity(p.actors);assert.ok(!p.actors.some(a=>a.characterTag===id.characterTag||a.name===id.name));
});

test('technical revisions preserve approved action; explicit action command changes it',()=>{
 const s=createDemo().shots[0];s.action='Alya waits by the door.';
 assert.equal(directShot(s,'dolly 50mm 4 detik').shot.action,s.action);
 assert.equal(directShot(s,'dolly 50mm; aksi: Alya opens the door.').shot.action,'Alya opens the door.');
});
