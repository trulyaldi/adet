// Size budgets for the iOS build (scripts/size-budgets.json): the JS bundle,
// Quest's images and Quest's audio. Runs `expo export` (or reads an existing
// export with --dir) and prints a table; exits 1 when a budget is exceeded.
//
//   npm run check:size            # export, then check
//   npm run check:size -- --dir <export-dir>
//
// Raise a budget only with a written reason in docs/quest/PLAN.md; shrink the
// assets first.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..');

interface Budgets {
  baselineJsBytes: number;
  jsGrowthBytes: number;
  gameImagesBytes: number;
  maxAtlasBytes: number;
  gameAudioBytes: number;
}

interface AssetEntry {
  files: string[];
}

/** What the export contains, classified by source path. Pure, for tests. */
export function measure(exportDir: string, assetmap: Record<string, AssetEntry>, root = ROOT) {
  const hbc = findFiles(path.join(exportDir, '_expo'), /\.(hbc|js)$/);
  const js = hbc.reduce((a, f) => a + fs.statSync(f).size, 0);
  const images: { file: string; bytes: number }[] = [];
  const audio: { file: string; bytes: number }[] = [];
  for (const entry of Object.values(assetmap)) {
    for (const file of entry.files ?? []) {
      const rel = path.relative(root, file);
      const bytes = fs.existsSync(file) ? fs.statSync(file).size : 0;
      if (/^src\/game\/assets\/atlases\/.*\.png$/.test(rel) || /^assets\/game\/.*\.(png|webp)$/.test(rel)) images.push({ file: rel, bytes });
      if (/^assets\/game\/(audio|music)\/.*\.(m4a|mp3|aac)$/.test(rel)) audio.push({ file: rel, bytes });
    }
  }
  return { js, images, audio };
}

export function check(m: ReturnType<typeof measure>, b: Budgets) {
  const rows: { what: string; bytes: number; budget: number }[] = [
    { what: 'JS bundle (Hermes)', bytes: m.js, budget: b.baselineJsBytes + b.jsGrowthBytes },
    { what: 'Game images (all)', bytes: m.images.reduce((a, i) => a + i.bytes, 0), budget: b.gameImagesBytes },
    ...m.images.map((i) => ({ what: `  ${path.basename(i.file)}`, bytes: i.bytes, budget: b.maxAtlasBytes })),
    { what: 'Game audio (SFX + music)', bytes: m.audio.reduce((a, i) => a + i.bytes, 0), budget: b.gameAudioBytes },
  ];
  return { rows, ok: rows.every((r) => r.bytes <= r.budget) };
}

function findFiles(dir: string, re: RegExp): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? findFiles(path.join(dir, e.name), re) : re.test(e.name) ? [path.join(dir, e.name)] : []));
}

const kb = (n: number) => `${(n / 1024).toFixed(1)} KB`.padStart(12);

function main() {
  const budgets = JSON.parse(fs.readFileSync(path.join(__dirname, 'size-budgets.json'), 'utf8')) as Budgets;
  const i = process.argv.indexOf('--dir');
  let dir = i > 0 ? process.argv[i + 1] : '';
  if (!dir) {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'adet-size-'));
    console.log(`Exporting iOS to ${dir}…`);
    execFileSync('npx', ['expo', 'export', '--platform', 'ios', '--dump-assetmap', '--output-dir', dir], { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'], env: { ...process.env, CI: '1' } });
  }
  const assetmap = JSON.parse(fs.readFileSync(path.join(dir, 'assetmap.json'), 'utf8')) as Record<string, AssetEntry>;
  const { rows, ok } = check(measure(dir, assetmap), budgets);
  console.log(`\n${'What'.padEnd(34)}${'Size'.padStart(12)}${'Budget'.padStart(12)}`);
  for (const r of rows) console.log(`${(r.bytes > r.budget ? '✖ ' : '  ') + r.what.padEnd(32)}${kb(r.bytes)}${kb(r.budget)}`);
  console.log(ok ? '\nWithin budget.' : '\nOver budget: shrink the assets first (see scripts/size-budgets.json).');
  if (!ok) process.exit(1);
}

if (require.main === module) main();
