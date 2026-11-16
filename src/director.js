import { clone, makeShot, createDemo, uid, clamp, applyBrief, validateProject, totalDuration, evaluateShot, setOrbitSweep } from './model.js';

// An explicit local command grammar makes revisions predictable and reversible.
export function directShot(shot, text, fps = 30) {
  const s = applyBrief(shot,text), applied=[];
  // Technical revisions must not replace approved narrative with camera commands.
  s.action=shot.action;
  const action=text.match(/(?:^|\n|;)\s*(?:aksi|action)\s*:\s*([^\n;]+)/i);
  if(action){s.action=action[1].trim();applied.push('action');}
  const vector = '(?:\\[|\\()\\s*(-?\\d+(?:\\.\\d+)?)\\s*,\\s*(-?\\d+(?:\\.\\d+)?)\\s*,\\s*(-?\\d+(?:\\.\\d+)?)\\s*(?:\\]|\\))';
  for(const [label,path] of [['cam in',['start','position']],['cam out',['end','position']],['target in',['start','target']],['target out',['end','target']]]) {
    const m=text.match(new RegExp(label+'\\s*[:=]?\\s*'+vector,'i'));
    if(m){s.camera[path[0]][path[1]]=m.slice(1,4).map(Number);applied.push(label);}
  }
  for(const [label,frame]of[['lens in','start'],['lens out','end']]) {const m=text.match(new RegExp(label+'\\s*[:=]?\\s*(\\d+(?:\\.\\d+)?)','i'));if(m){s.camera[frame].lens=clamp(Number(m[1]),12,200);applied.push(label);}}
  const f=text.match(/(?:f\/|aperture\s*[:=]?\s*)(\d+(?:\.\d+)?)/i);if(f)s.camera.aperture=clamp(Number(f[1]),1,22);
  const focus=text.match(/(?:focus|fokus)\s*[:=]?\s*(\d+(?:\.\d+)?)/i);if(focus)s.camera.focus=clamp(Number(focus[1]),.1,1000);
  if(/\blinear\b/i.test(text))s.camera.easing='linear';if(/ease|smooth/i.test(text))s.camera.easing='smooth';
  if(/(?:cam out)/i.test(text)&&s.camera.movement==='static')s.camera.movement='dolly';
  const duration=text.match(/(\d+(?:\.\d+)?)\s*(?:detik|seconds?|secs?)/i);
  if(duration)s.duration=Math.round(clamp(Number(duration[1]),1/fps,60)*fps)/fps;
  if(s.edit.raw_out===shot.duration)s.edit.raw_out=s.duration;
  const orbit=text.match(/(?:orbit|mengitari)\s*([+-]?\d+(?:\.\d+)?)\s*(?:deg|derajat|°)/i);if(orbit){setOrbitSweep(s.camera,clamp(Number(orbit[1]),-1080,1080));applied.push('orbit degrees');}
  s.directorPrompt=text;return {shot:s,applied};
}
export function insertShot(project,selectedId,side='after') {
  const index=project.shots.findIndex(s=>s.id===selectedId);if(index<0)throw new Error('Shot tidak ditemukan.');
  const ref=project.shots[index],n=makeShot(project.shots.length+1),at=index+(side==='after'?1:0);
  n.name='Insert · '+ref.name;n.size=ref.size;n.action=ref.action;n.purpose='DRAFT insert: '+ref.purpose;n.sound=ref.sound;n.notes='Insert shot; director to review action, blocking and timing.';n.edit={...clone(ref.edit),shot_id:uid('insert'),raw_in:0,raw_out:n.duration,sequence_in:ref.edit.sequence_in+(side==='after'?ref.edit.raw_out-ref.edit.raw_in:0)};
  const pose=clone(ref.camera[side==='after'?'end':'start']);n.camera={...clone(ref.camera),movement:'static',start:clone(pose),end:clone(pose)};
  n.states=clone(ref.states||[]);if(ref.light)n.light=clone(ref.light);
  for(const s of project.shots.slice(at))if(s.edit.sequence_id===n.edit.sequence_id)s.edit.sequence_in+=n.duration;
  project.shots.splice(at,0,n);return n.id;
}
export function removeActor(project,id){project.actors=project.actors.filter(a=>a.id!==id);for(const s of project.shots){s.blocking=s.blocking.filter(b=>b.actorId!==id);if(s.states)s.states=s.states.filter(b=>b.actorId!==id);if(s.light?.practicals)s.light.practicals=s.light.practicals.filter(b=>b.actorId!==id);}}

export function storyToProject(text,{name='Story draft',cast='',fps=30,duration=5,model='pill-person',sourceName='Pasted story'}={}) {
  text=text.trim();if(!text)throw new Error('Masukkan cerita dahulu.');if(text.length>200000)throw new Error('Teks maksimal 200.000 karakter.');
  const explicitNames=cast.split(/[,\n]/).map(n=>n.trim()).filter(Boolean);
  const screenplayNames=[...text.matchAll(/^([A-Z][A-Z \-'’]{1,30}):\s*\S/gm)].map(m=>m[1]);
  const names=[...new Set(explicitNames.length?explicitNames:screenplayNames)].slice(0,12);
  if(!names.length)names.push('Pemeran A','Pemeran B');
  // Scene headings and blank paragraphs are deterministic split points; no text is discarded.
  let beats=text.split(/\n\s*\n|\n(?=(?:INT\.|EXT\.|SCENE\s|ADEGAN\s|SHOT\s|SQ\d))/i).map(t=>t.trim()).filter(Boolean);
  if(beats.length===1&&text.includes('\n'))beats=text.split(/\n+/).map(t=>t.trim()).filter(Boolean);
  if(beats.length>60)throw new Error('Lebih dari 60 bagian cerita. Gabungkan paragraf atau impor satu sequence per proyek.');
  const p=createDemo();p.name=name||'Story draft';p.description='DRAFT dari cerita. Kamera, blocking dan set adalah usulan yang perlu diperiksa Director.';p.setting='Proposed neutral stage. Units in meters; locations and character marks require director review against the story.';p.fps=fps;
  p.actors=names.map((name,i)=>({id:uid('cast'),name,type:model==='pill'?'pill':'pill-person',color:['#3389bc','#d18b36','#719d83','#ad7ea4'][i%4],position:[(i-(names.length-1)/2)*1.5,0,0],rotation:0,scale:1,visible:true}));
  p.sourceStory={name:sourceName,text,status:'DRAFT',method:'offline paragraph and technical-keyword planner; not semantic AI reconstruction'};
  let cursor=0;
  p.shots=beats.map((beat,i)=>{let s=makeShot(i+1);s.name=beat.split('\n')[0].slice(0,72);s.duration=Math.round(clamp(duration,1/fps,60)*fps)/fps;s.edit.raw_out=s.duration;s.action=beat;s.purpose='DRAFT: represent this story beat; director to confirm shot purpose.';s.camera.start={position:[4,2.3,7],target:[0,1.1,0],lens:35};s.camera.end=clone(s.camera.start);s.camera.movement='static';s=directShot(s,beat,fps).shot;s.edit.sequence_in=cursor;s.edit.raw_in=0;s.edit.raw_out=s.duration;cursor+=s.duration;s.notes='Proposed neutral blocking. Original story is preserved in sourceStory; review action, eyeline, props and cut before production.';return s;});
  return validateProject(p);
}
