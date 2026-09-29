// The game-pixel grid without Skia: RN pixel UI (panels, text) sizes itself
// with these, so it can load at app start, before Skia or CanvasKit.

/** Narrowest the world is ever shown, in game pixels. */
export const MIN_WORLD_W = 112;

/** The largest integer scale that still shows MIN_WORLD_W game pixels across `width` points. */
export function pixelScale(width: number, minWorld = MIN_WORLD_W): number {
  return Math.max(2, Math.min(8, Math.floor(width / minWorld)));
}

/** Snap to the game-pixel grid. */
export const snap = (v: number) => Math.round(v);
