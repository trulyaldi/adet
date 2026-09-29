// The licensed-pack registry: one committed JSON per pack in
// assets/game/packs/ (source page, pinned download, checksum, license, and
// what the game maps from it). The packs' own files live in
// assets/game/raw/<name>/ (gitignored); `npm run game:fetch` downloads them.

import fs from 'node:fs';
import path from 'node:path';

export const ROOT = path.resolve(__dirname, '..');
export const RAW = path.join(ROOT, 'assets/game/raw');
export const REGISTRY = path.join(ROOT, 'assets/game/packs');
export const LICENSES = path.join(ROOT, 'assets/game/licenses');

export interface PackSprite {
  file: string;
  /** Frames as [x, y, w, h] in the file. */
  rects: [number, number, number, number][];
  fps?: number;
  loop?: boolean;
  anchor?: [number, number];
  atlas?: string;
  /** How it was made from the pack (for INVENTORY/MAPPING): pack | recolor | composed. */
  source?: 'pack' | 'recolor' | 'composed';
  /** Recolour to this biome's palette (nearest colour). */
  palette?: string;
}

export interface PackSound {
  file: string;
  /** Extra gain in dB after loudness normalisation (usually negative: quieter). */
  gain?: number;
  why?: string;
}

export interface Pack {
  name: string;
  title: string;
  author: string;
  license: string;
  licenseUrl: string;
  /** The pack's official page. */
  url: string;
  /** A direct, non-interactive download (Kenney), or null when a browser is needed (itch.io). */
  download: string | null;
  sha256: string | null;
  downloaded: string | null;
  /** Pixel density; sprites are used only from 16 px packs. */
  tileSize?: number;
  sprites?: Record<string, PackSprite>;
  sounds?: Record<string, PackSound>;
}

/** Allowed for a bundled app (the P9 license gate): CC0, CC-BY, or explicitly permissive. */
export const PERMISSIVE = /^(cc0|cc-by(-\d(\.\d)?)?|public domain|mit|ofl|apache-2\.0)$/i;

export function loadRegistry(): Pack[] {
  if (!fs.existsSync(REGISTRY)) return [];
  return fs
    .readdirSync(REGISTRY)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => JSON.parse(fs.readFileSync(path.join(REGISTRY, f), 'utf8')) as Pack);
}

export const packDir = (p: Pack) => path.join(RAW, p.name);

/** A mapped pack must be present: building without it would silently lose real assets. */
export function requirePack(p: Pack): string {
  const dir = packDir(p);
  if (!fs.existsSync(dir)) {
    throw new Error(
      `Pack "${p.name}" is mapped but missing from assets/game/raw/${p.name}/. ` +
        (p.download ? 'Run `npm run game:fetch` first.' : `Download it from ${p.url} (see docs/quest/OWNER_ACTIONS.md).`)
    );
  }
  return dir;
}
