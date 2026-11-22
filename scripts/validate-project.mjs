import { readFile } from 'node:fs/promises';
import { parse } from 'yaml';
import { validateProject, totalDuration, shotManifest } from '../src/model.js';
import { ARAGI_PLAN_SCHEMA,projectFromAragiPlan } from '../src/aragi-plan.js';
try {
  const file = process.argv[2];
  if (!file) throw new Error('Pemakaian: npm run validate -- path/proyek.json [--manifest]');
  const text = await readFile(file, 'utf8');
  const source=/\.json$/i.test(file) ? JSON.parse(text) : parse(text, { maxAliasCount: 50 });
  const p=source?.schema===ARAGI_PLAN_SCHEMA ? projectFromAragiPlan(source) : validateProject(source);
  if (process.argv.includes('--manifest')) console.log(JSON.stringify(shotManifest(p), null, 2));
  else console.log(JSON.stringify({ valid: true, schema: p.schema, name: p.name, fps: p.fps, aspect: p.aspect, objects: p.actors.length, shots: p.shots.length, raw_seconds: totalDuration(p), frames: Math.round(totalDuration(p) * p.fps) }, null, 2));
} catch (e) { console.error(e.message); process.exitCode = 1; }
