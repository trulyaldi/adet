// The sprite registry: every generated sprite with its logical id, atlas and
// animation. build-atlases packs whatever is registered here (and raw pack
// art that overrides an id).

import { Color, Px } from '../pixel/px';

export interface SpriteDef {
  id: string;
  /** 'shared' or a biome id. */
  atlas: string;
  frames: Px[];
  fps?: number;
  loop?: boolean;
  /** Anchor in pixels from the frame's top-left (default: bottom centre). */
  anchor?: [number, number];
  /** Also emit a mirrored copy as `<id>@flip`. */
  flip?: boolean;
  /** Also emit a white silhouette as `<id>@flash` (hit flash). */
  flash?: boolean;
  /** Colours drawn additively (light sprites). */
  additive?: boolean;
}

export class Registry {
  readonly sprites = new Map<string, SpriteDef>();

  add(def: SpriteDef): void {
    if (this.sprites.has(def.id)) throw new Error(`duplicate sprite id ${def.id}`);
    const { w, h } = def.frames[0];
    for (const f of def.frames) if (f.w !== w || f.h !== h) throw new Error(`${def.id}: frames differ in size`);
    this.sprites.set(def.id, def);
  }
}

export type Ramp = [Color, Color, Color];
