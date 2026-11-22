import { spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, stat, unlink } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { clipStore } from './clip-store.mjs';

const MIME = { json: 'application/json', mp4: 'video/mp4' };
async function body(req, limit) {
  const chunks = []; let bytes = 0;
  for await (const c of req) { bytes += c.length; if (bytes > limit) throw new Error('Payload terlalu besar.'); chunks.push(c); }
  return Buffer.concat(chunks);
}
export function renderAPI() {
  const jobs = new Map(); let root, ffmpeg, active, batches;
  function stopJob(job) {
    if (!job.done && !job.stopping) {
      job.stopping = true;
      // Close the pipe first: FFmpeg can otherwise remain blocked waiting for
      // the next PNG even after receiving SIGTERM.
      job.child.stdin.destroy(); job.child.kill('SIGTERM');
      const killTimer = setTimeout(() => { if (!job.done) job.child.kill('SIGKILL'); }, 1000);
      killTimer.unref(); job.complete.finally(() => clearTimeout(killTimer));
    }
    return job.complete;
  }
  const json = (res, status, value) => { res.statusCode = status; res.setHeader('Content-Type', MIME.json); res.end(JSON.stringify(value)); };
  async function setup(config) {
    root = config.root;
    try { ffmpeg = process.env.WARKAI_FFMPEG || (await readFile(path.join(root, '.local/ffmpeg-path'), 'utf8')).trim(); } catch { ffmpeg = 'ffmpeg'; }
    const check = spawnSync(ffmpeg, ['-version'], { encoding: 'utf8', timeout: 5000 });
    if (check.status !== 0) ffmpeg = null;
    batches = clipStore(root, ffmpeg);
    await mkdir(path.join(root, '.local/renders'), { recursive: true });
  }
  async function middleware(req, res, next) {
    if (!/^\/api\/(render|previz)(?:\/|\?|$)/.test(req.url)) return next();
    const url = new URL(req.url, 'http://localhost'), parts = url.pathname.split('/').filter(Boolean);
    // Same-origin local calls only. No user-selected paths or executable arguments.
    if (req.headers.origin && ![`http://${req.headers.host}`, `https://${req.headers.host}`].includes(req.headers.origin)) return json(res, 403, { error: 'Same-origin local requests only.' });
    if (req.headers['sec-fetch-site'] === 'cross-site') return json(res, 403, { error: 'Cross-site request rejected.' });
    try {
      if (parts[1] === 'previz') return await batches.handle(req,res,parts,body,json,jobs);
      if (req.method === 'GET' && parts[2] === 'status') {
        return json(res, 200, { available: !!ffmpeg, busy: !!active, progress: active ? { received: active.received, frames: active.frames } : null, mode: 'deterministic', format: 'mp4', fps: [24, 25, 30] });
      }
      if (!ffmpeg) return json(res, 503, { error: 'FFmpeg belum tersedia. Instal FFmpeg atau atur WARKAI_FFMPEG.' });
      if (req.method === 'POST' && parts.length === 2) {
        const input = JSON.parse((await body(req, 4096)).toString());
        const { width, height, fps, frames } = input;
        if (![width, height, frames].every(Number.isInteger) || width < 64 || height < 64 || width > 1920 || height > 1920 || width % 2 || height % 2 || ![24, 25, 30].includes(fps) || frames < 1 || frames > fps * 1800) throw new Error('Parameter render tidak valid.');
        const binding = input.batchId === undefined ? null : await batches.bind(input.batchId,input.clipId,input);
        // Admission and registration must stay synchronous after snapshot lookup.
        if (active) return json(res, 409, { error: 'Satu render sedang berjalan. Selesaikan atau batalkan dahulu.' });
        if (binding && [...jobs.values()].some(j => j.binding?.batchId === binding.batchId && j.binding.order === binding.order && !j.error && !j.published))
          return json(res,409,{error:'Klip ini sedang dirender atau diperiksa.'});
        const id = randomUUID(), file = path.join(root, '.local/renders', `${id}.mp4`);
        const child = spawn(ffmpeg, ['-hide_banner','-loglevel','error','-y','-f','image2pipe','-framerate',String(fps),'-vcodec','png','-i','pipe:0','-an','-c:v','libx264','-preset','veryfast','-crf','19','-pix_fmt','yuv420p','-frames:v',String(frames),'-movflags','+faststart',file], { stdio: ['pipe','ignore','pipe'] });
        const job = { id, file, child, binding, width, height, fps, frames, received: 0, done: false, error: null, stderr: '', lastActivity: Date.now(), accepting: false };
        active = job;
        job.complete = new Promise(resolve => child.once('close', code => { active = null; job.done = true; if (code !== 0) job.error ||= job.stderr.slice(-1500) || 'FFmpeg gagal.'; resolve(); }));
        child.on('error', e => { job.error = e.message; }); child.stdin.on('error', e => { job.error ||= e.message; });
        child.stderr.on('data', d => { job.stderr = (job.stderr + d.toString()).slice(-2000); });
        jobs.set(id, job); return json(res, 200, { id, width, height, fps, frames });
      }
      const job = jobs.get(parts[2]); if (!job) return json(res, 404, { error: 'Render tidak ditemukan.' }); job.lastActivity = Date.now();
      if (req.method === 'POST' && parts[3] === 'frame') {
        if (job.error) throw new Error(job.error);
        if (job.done || job.accepting || job.received >= job.frames) throw new Error('Render tidak menerima frame tambahan.');
        const index = Number(url.searchParams.get('index')); if (index !== job.received) throw new Error(`Frame harus berurutan; menunggu ${job.received}.`);
        job.accepting = true;
        try {
          const data = await body(req, 12 * 1024 * 1024);
          if (data.length < 24 || data.toString('hex',0,8) !== '89504e470d0a1a0a' || data.readUInt32BE(16) !== job.width || data.readUInt32BE(20) !== job.height) throw new Error('PNG/dimensi frame tidak cocok.');
          await new Promise((resolve, reject) => { job.child.stdin.write(data, e => e ? reject(e) : resolve()); });
          job.received++; return json(res, 200, { received: job.received });
        } finally { job.accepting = false; }
      }
      if (req.method === 'POST' && parts[3] === 'finish') {
        if (job.received !== job.frames) throw new Error(`Frame belum lengkap: ${job.received}/${job.frames}.`);
        job.child.stdin.end(); await job.complete; if (job.error) throw new Error(job.error);
        if (job.binding) {
          if (!job.publication) job.publication = batches.publish(job).then(result => {
            job.published = true; return result;
          }).catch(err => { job.error = err.message; throw err; });
          return json(res,200,await job.publication);
        }
        const info = await stat(job.file); return json(res, 200, { id: job.id, url: `/api/render/${job.id}/video`, bytes: info.size, frames: job.frames, duration: job.frames / job.fps, fps: job.fps });
      }
      if (req.method === 'GET' && parts[3] === 'video') {
        if (!job.done || job.error) throw new Error('Render belum selesai.');
        const info = await stat(job.file); res.setHeader('Content-Type', MIME.mp4); res.setHeader('Content-Length', info.size); res.setHeader('Content-Disposition','attachment; filename="warkai-previz.mp4"'); createReadStream(job.file).pipe(res); return;
      }
      if (req.method === 'DELETE' && parts.length === 3) { await stopJob(job); await job.publication?.catch(() => {}); await unlink(job.file).catch(() => {}); jobs.delete(job.id); return json(res, 200, { cancelled: true }); }
      return json(res, 404, { error: 'Endpoint tidak ditemukan.' });
    } catch (e) { if (!res.headersSent) json(res, e.status || 400, { error: e.message }); else res.end(); }
  }
  const cleanup = setInterval(() => { for (const [id, job] of jobs) if (Date.now() - job.lastActivity > 3_600_000) { stopJob(job).then(() => unlink(job.file).catch(() => {})); jobs.delete(id); } }, 60_000); cleanup.unref();
  return { name: 'warkai-local-render', async configResolved(config) { await setup(config); }, configureServer(server) { server.middlewares.use(middleware); }, configurePreviewServer(server) { server.middlewares.use(middleware); }, closeBundle() { for (const j of jobs.values()) stopJob(j); clearInterval(cleanup); } };
}
