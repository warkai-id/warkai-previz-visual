import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { renderAPI } from './render-api.mjs';

test('local render cancellation closes an idle FFmpeg input pipe and rejects cross-origin access', { timeout: 10000 }, async () => {
  const root = await mkdtemp(path.join(process.cwd(), '.local/render-test-'));
  const ffmpeg = process.env.WARKAI_FFMPEG || (await readFile('.local/ffmpeg-path','utf8')).trim();
  await mkdir(path.join(root,'.local')); await writeFile(path.join(root,'.local/ffmpeg-path'),ffmpeg);
  const plugin = renderAPI(); await plugin.configResolved({ root });
  let handler; plugin.configureServer({ middlewares: { use: h => handler = h } });
  const server = createServer((req,res) => handler(req,res,() => { res.statusCode=404;res.end(); }));
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const status = await (await fetch(`${base}/api/render/status`)).json(); assert.equal(status.available,true);
    const create = await fetch(`${base}/api/render`,{ method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({width:1280,height:720,fps:30,frames:90}) });
    assert.equal(create.status,200); const {id}=await create.json();
    const start=performance.now(); const cancel=await fetch(`${base}/api/render/${id}`,{method:'DELETE',signal:AbortSignal.timeout(3500)});
    assert.equal(cancel.status,200);assert.deepEqual(await cancel.json(),{cancelled:true});assert.ok(performance.now()-start<3000);
    const blocked=await fetch(`${base}/api/render/status`,{headers:{Origin:'https://example.com'}});assert.equal(blocked.status,403);
    const missing=await fetch(`${base}/api/render/${id}/video`);assert.equal(missing.status,404);
  } finally { plugin.closeBundle(); await new Promise(resolve=>server.close(resolve));await rm(root,{recursive:true,force:true}); }
});
