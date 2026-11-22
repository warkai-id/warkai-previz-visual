import { writeFile, mkdir } from 'node:fs/promises';
import { stringify } from 'yaml';
import { createDemo, validateProject } from '../src/model.js';
await mkdir('examples', {recursive:true});
for (const [name, kind] of [['quiet-signal','signal'],['pill-action','reference']]) {
 const p = createDemo(kind); await writeFile(`examples/${name}.json`, JSON.stringify(p,null,2)); await writeFile(`examples/${name}.yaml`,stringify(p));
}
const p=createDemo(); p.name='Frame timing & posture study';p.fps=30;p.shots=p.shots.slice(0,3);p.actors[0].type='pill-person';
const durations=[.8,.9,1.3];let cursor=0;
for(let i=0;i<3;i++) { const s=p.shots[i];s.duration=durations[i];s.edit={sequence_id:'SQ-DEMO',job_id:'J01',shot_id:`P0${i+1}`,raw_in:0,raw_out:s.duration,sequence_in:cursor};cursor+=s.duration; }
p.shots[0].blocking=[{actorId:'actor-a',start:[-1.9,0,.8],end:[-1.9,0,.8],action:'hold',poseStart:'stand',poseEnd:'sit',rotationStart:20,rotationEnd:20}];
p.shots[1].blocking=[{actorId:'actor-a',start:[-1.9,0,.8],end:[-1.9,0,.8],action:'hold',poseStart:'sit',poseEnd:'kneel',rotationStart:20,rotationEnd:70}];
p.shots[2].blocking=[{actorId:'actor-a',start:[-1.9,0,.8],end:[-1.9,0,.8],action:'hold',poseStart:'kneel',poseEnd:'stand',rotationStart:70,rotationEnd:20}];
p.shots[0].name='Stand → sit';p.shots[1].name='Sit → kneel';p.shots[2].name='Kneel → stand';
p.shots[0].action='The mannequin bends into a seated posture.';p.shots[1].action='The mannequin lowers to its knees and turns.';p.shots[2].action='The mannequin rises to stand.';
for(const [i,s] of p.shots.entries()) { s.camera.movement='static';s.camera.start={position:i===1?[-4,1.8,4]:[3.5,2.5,6],target:[-1.2,1,0],lens:i===1?50:35};s.camera.end=structuredClone(s.camera.start); }
validateProject(p);await writeFile('examples/subsecond-30fps.json',JSON.stringify(p,null,2));await writeFile('examples/subsecond-30fps.yaml',stringify(p));
