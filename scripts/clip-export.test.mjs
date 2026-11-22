import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdtemp,mkdir,readFile,rm,writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { renderAPI } from './render-api.mjs';
import { exportClipBatch,resumeClipBatch } from '../src/clip-export.js';
import { createDemo, validateProject } from '../src/model.js';
import { clipsForAragiExport } from '../src/aragi-plan.js';

async function serve(root) {
  const plugin=renderAPI();
  await plugin.configResolved({root});
  let handler;
  plugin.configureServer({middlewares:{use:middleware=>{handler=middleware;}}});
  const server=createServer((req,res)=>handler(req,res,()=>{res.writeHead(404).end();}));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  return {
    request:(url,init)=>fetch('http://127.0.0.1:'+server.address().port+url,init),
    close:async()=>{plugin.closeBundle();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
  };
}

test('clean clips keep snapshot, measured frames, mappings and published MP4 across server restart', {timeout:20000},async t=>{
  const root=await mkdtemp(path.join(tmpdir(),'warkai-clips-'));
  const ffmpeg=process.env.WARKAI_FFMPEG || (await readFile('.local/ffmpeg-path','utf8').catch(()=>'ffmpeg')).trim();
  await mkdir(path.join(root,'.local'));
  await writeFile(path.join(root,'.local/ffmpeg-path'),ffmpeg);
  const png=spawnSync(ffmpeg,['-hide_banner','-loglevel','error','-f','lavfi','-i','color=c=blue:size=128x72','-frames:v','1','-f','image2pipe','-vcodec','png','pipe:1']);
  assert.equal(png.status,0,png.stderr?.toString());
  let api = await serve(root);
  t.after(async()=>{await api.close();await rm(root,{recursive:true,force:true});});

  const project=validateProject(createDemo());
  project.shots=project.shots.slice(0,2);
  project.shots.forEach((s,i)=>{s.duration=3/24;s.edit.raw_in=0;s.edit.raw_out=s.duration;s.edit.sequence_in=i*s.duration;});
  const image='data:image/png;base64,'+png.stdout.toString('base64');
  project.actors.push({id:'plate',name:'Papan',type:'panel',color:'#ffffff',position:[0,0,0],rotation:0,scale:1,visible:true,image,imageName:'papan.png'});
  project.shots[1].states=[{actorId:'plate',image,imageName:'papan-dua.png'}];
  const clips=[
    {id:'CL001',order:1,startFrame:0,endFrameExclusive:2,shotIds:[project.shots[0].id],direction:'Tahan kamera.'},
    {id:'CL002',order:2,startFrame:2,endFrameExclusive:6,shotIds:project.shots.map(s=>s.id)}
  ];
  const originalName=project.name;
  const frames=[];
  let id;
  await assert.rejects(exportClipBatch({
    project,clips,width:128,height:72,request:api.request,
    prepareProject:snapshot=>{assert.notEqual(project,snapshot);project.name='Revisi baru';},
    captureFrame:(seconds,{sourceFrame,project:snapshot})=>{
      assert.equal(seconds,sourceFrame/24);
      assert.equal(snapshot.name,originalName);
      if(sourceFrame===2) throw new Error('Uji putus sesudah klip pertama');
      frames.push(sourceFrame);return new Blob([png.stdout]);
    },
    onProgress:p=>{id=p.batchId;}
  }),err=>err.batchId===id && err.message.includes('putus'));
  const first=await (await api.request('/api/previz/batches/'+id)).json();
  assert.deepEqual(first.clips.map(c=>c.status),['ready','pending']);
  assert.equal(first.status,'partial');
  assert.equal(first.clips[0].direction,'Tahan kamera.');
  assert.equal(first.assets.length,1);
  assert.equal(first.assets[0].sha256,createHash('sha256').update(png.stdout).digest('hex'));
  assert.deepEqual(first.assets[0].uses.map(a=>a.shotId),[null,project.shots[1].id]);
  await api.close();
  api=await serve(root);
  const retained=await (await api.request(first.snapshotUrl)).json();
  assert.equal(retained.name,originalName);
  assert.equal(createHash('sha256').update(JSON.stringify(retained)).digest('hex'),first.revision);
  const finished=await resumeClipBatch({
    batchId:id,request:api.request,captureFrame:(_,ctx)=>{assert.equal(ctx.project.name,originalName);frames.push(ctx.sourceFrame);return new Blob([png.stdout]);}
  });
  assert.deepEqual(frames,[0,1,2,3,4,5]);
  assert.equal(finished.status,'ready');
  assert.deepEqual(finished.clips.map(c=>c.measured.frames),[2,4]);
  assert.deepEqual(finished.clips[1].sourceShots.map(s=>[s.clipInFrame,s.clipOutFrameExclusive]),[[0,1],[1,4]]);
  assert.equal(finished.clips[0].measured.sha256,first.clips[0].measured.sha256);
  for(const c of finished.clips){
    const media=await api.request(c.url);
    assert.equal(media.status,200);
    assert.equal(media.headers.get('content-type'),'video/mp4');
    const bytes=Buffer.from(await media.arrayBuffer());
    assert.equal(createHash('sha256').update(bytes).digest('hex'),c.measured.sha256);
    assert.deepEqual([c.measured.width,c.measured.height,c.measured.fps],[128,72,24]);
    assert.ok(Math.abs(c.measured.durationSeconds-c.frames/24)<0.00001);
  }
  const wrong=await api.request('/api/previz/batches',{method:'POST',body:JSON.stringify({project,clips,mode:'clean',width:128,height:80})});
  assert.equal(wrong.status,400);
  assert.equal((await api.request(first.snapshotUrl,{headers:{origin:'https://example.com'}})).status,403);
});

test('Aragi can submit a plan, poll pending clips and open the same snapshot for Director review',async t=>{
  const root=await mkdtemp(path.join(tmpdir(),'warkai-aragi-'));
  const ffmpeg=process.env.WARKAI_FFMPEG || (await readFile('.local/ffmpeg-path','utf8').catch(()=>'ffmpeg')).trim();
  await mkdir(path.join(root,'.local'));
  await writeFile(path.join(root,'.local/ffmpeg-path'),ffmpeg);
  const api=await serve(root);
  t.after(async()=>{await api.close();await rm(root,{recursive:true,force:true});});
  const plan=JSON.parse(await readFile(new URL('../examples/aragi-manual.plan.json',import.meta.url),'utf8'));
  const post = (url,payload)=>api.request(url,{method:'POST',body:JSON.stringify(payload)});
  const created=await post('/api/previz/batches',{plan,mode:'clean',width:128,height:72});
  assert.equal(created.status,201);
  const batch=await created.json();
  assert.equal(batch.status,'pending');
  assert.equal(batch.studioUrl,'/?batch='+batch.id);
  assert.deepEqual(batch.clips.map(c=>c.clipId),['CL001','CL002']);
  assert.equal(batch.clips[0].direction,plan.clips[0].direction);
  assert.deepEqual(batch.sourcePlan.target,plan.target);
  const project=await (await api.request(batch.snapshotUrl)).json();
  const clips=clipsForAragiExport(project);
  clips[1].direction='Berbeda dari keputusan Director.';
  const changed=await post('/api/previz/batches',{project,clips,width:128,height:72});
  assert.equal(changed.status,400);
  const clip=batch.clips[0];
  const job=await post('/api/render',{batchId:batch.id,clipId:clip.clipId,width:128,height:72,fps:24,frames:clip.frames});
  assert.equal(job.status,200);
  const active=await (await api.request(batch.manifestUrl)).json();
  assert.equal(active.status,'rendering');
  assert.equal((await api.request(active.clips[0].cancelUrl,{method:'DELETE'})).status,200);
  assert.equal((await (await api.request(batch.manifestUrl)).json()).status,'pending');
  const png=spawnSync(ffmpeg,['-loglevel','error','-f','lavfi','-i','color=c=gray:size=128x72','-frames:v','1','-f','image2pipe','-vcodec','png','pipe:1']);
  assert.equal(png.status,0,png.stderr?.toString());
  const image=new Blob([png.stdout],{type:'image/png'});
  const rendered=await resumeClipBatch({batchId:batch.id,request:api.request,captureFrame:()=>image});
  assert.deepEqual(rendered.clips.map(c=>[c.clipId,c.measured.frames,c.measured.durationSeconds]),[['CL001',96,4],['CL002',144,6]]);
  assert.equal(rendered.visualReview,'pending');
});
