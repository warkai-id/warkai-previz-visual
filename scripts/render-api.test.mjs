import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, request } from 'node:http';
import { tmpdir } from 'node:os';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { renderAPI } from './render-api.mjs';

async function renderServer(t, onRequest = () => {}) {
  const root = await mkdtemp(path.join(tmpdir(), 'warkai-render-test-'));
  const ffmpeg = process.env.WARKAI_FFMPEG || (await readFile('.local/ffmpeg-path','utf8').catch(() => 'ffmpeg')).trim();
  await mkdir(path.join(root,'.local')); await writeFile(path.join(root,'.local/ffmpeg-path'),ffmpeg);
  const plugin = renderAPI(); await plugin.configResolved({ root });
  let handler; plugin.configureServer({ middlewares: { use: h => handler = h } });
  const server = createServer((req,res) => {
    onRequest(req);
    handler(req,res,() => { res.statusCode=404;res.end(); });
  });
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    plugin.closeBundle();
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    await rm(root, {recursive:true, force:true});
  });
  return base;
}

test('local render cancellation closes an idle FFmpeg input pipe and rejects cross-origin access', { timeout: 10000 }, async t => {
    const base = await renderServer(t);
    const status = await (await fetch(`${base}/api/render/status`)).json(); assert.equal(status.available,true);
    const create = await fetch(`${base}/api/render`,{ method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({width:1280,height:720,fps:30,frames:90}) });
    assert.equal(create.status,200); const {id}=await create.json();
    const start=performance.now(); const cancel=await fetch(`${base}/api/render/${id}`,{method:'DELETE',signal:AbortSignal.timeout(3500)});
    assert.equal(cancel.status,200);assert.deepEqual(await cancel.json(),{cancelled:true});assert.ok(performance.now()-start<3000);
    const blocked=await fetch(`${base}/api/render/status`,{headers:{Origin:'https://example.com'}});assert.equal(blocked.status,403);
    const missing=await fetch(`${base}/api/render/${id}/video`);assert.equal(missing.status,404);
});

test('overlapping request bodies share one encoder and cancellation frees it', {timeout:10000}, async t => {
  let arrivals = 0;
  const both = Promise.withResolvers();
  const base = await renderServer(t, req => {
    if (req.headers['x-test-overlap'] && ++arrivals === 2) both.resolve();
  });
  const url = base + '/api/render';
  const input = JSON.stringify({width:64, height:64, fps:24, frames:2});
  const post = body => fetch(url, {method:'POST', body});
  assert.equal((await post('{')).status, 400);
  assert.equal((await post('{}')).status, 400);

  const pending = Array.from({length:2}, () => {
    const result = Promise.withResolvers();
    const req = request(url, {method:'POST', headers:{'x-test-overlap':'1'}}, res => {
      result.resolve(new Response(res, {status:res.statusCode}));
    });
    req.on('error', result.reject);
    req.write(input.slice(0,1));
    return {req, result:result.promise};
  });
  await both.promise;
  pending.forEach(({req}) => req.end(input.slice(1)));
  const responses = await Promise.all(pending.map(item => item.result));
  assert.deepEqual(responses.map(r => r.status).sort(), [200,409]);
  const {id} = await responses.find(r => r.ok).json();
  assert.equal((await (await fetch(url+'/status')).json()).busy, true);
  assert.equal((await fetch(url+'/'+id, {method:'DELETE'})).status, 200);
  assert.equal((await (await fetch(url+'/status')).json()).busy, false);
  const next = await post(input);
  assert.equal(next.status, 200);
  assert.equal((await fetch(url+'/'+(await next.json()).id,{method:'DELETE'})).status, 200);
});
