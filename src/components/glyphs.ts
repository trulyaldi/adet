// The Adet icon set: 24x24 stroke glyphs drawn to match the Adet checkmark
// (round caps and joins, one stroke weight). Pure data so a glyph can be
// rendered by <Glyph> or exported as a plain SVG for review.

/** The Adet checkmark path, in its own 100x100 space (see AdetMark). */
export const ADET_MARK =
  'M42.6 75.7C43 75.1 44.2 73.4 44.9 72.3C45.6 71.1 46.3 69.9 46.9 68.7C47.4 67.5 48 66.2 48.4 65C48.9 63.8 49.3 62.5 49.6 61.3C49.9 60 50.2 58.8 50.4 57.5C50.6 56.3 50.8 55 50.8 53.8C50.9 52.6 50.9 51.4 50.9 50.2C50.8 49 50.7 47.9 50.5 46.7C50.3 45.6 50.1 44.5 49.8 43.4C49.5 42.3 49.2 41.3 48.8 40.3C48.4 39.3 48 38.3 47.5 37.4C47 36.5 46.5 35.7 45.9 34.8C45.3 34 44.7 33.3 44 32.6C43.4 31.8 42.7 31.2 42 30.6C41.3 30 40.5 29.5 39.8 29C39 28.5 38.2 28.1 37.4 27.8C36.7 27.4 35.8 27.1 35 26.9C34.2 26.7 33.4 26.5 32.6 26.4C31.8 26.3 30.9 26.3 30.1 26.4C29.3 26.4 28.5 26.5 27.7 26.7C26.9 26.8 26.2 27.1 25.4 27.4C24.7 27.6 23.9 28 23.3 28.4C22.6 28.8 21.9 29.3 21.3 29.8C20.6 30.3 20 30.9 19.5 31.5C18.9 32.1 18.4 32.8 18 33.5C17.5 34.3 17.1 35 16.7 35.8C16.4 36.6 16.1 37.5 15.8 38.3C15.6 39.2 15.4 40.1 15.2 41C15.1 42 15 42.9 15 43.9C15 44.9 15 45.9 15.1 46.9C15.3 47.9 15.4 48.9 15.7 49.9C15.9 51 16.2 52 16.6 53C17 54 17.4 55.1 17.9 56.1C18.4 57.1 19 58.1 19.6 59.1C20.2 60 20.9 61 21.6 61.9C22.4 62.9 23.2 63.8 24.1 64.7L36.9 77.6A6.6 6.6 0 0 0 47 76.7L85 22.4';

/** The mark's stroke width in its own space; the glyph weight below matches it. */
export const ADET_MARK_STROKE = 8;

/** Stroke width of every glyph in the 24x24 space (the mark's 8/100 scaled by 1/4). */
export const GLYPH_STROKE = 2;

/** Places the mark in the 24x24 box: scale 1/4 makes its stroke exactly GLYPH_STROKE. */
export const MARK_TRANSFORM = 'translate(-0.5 -0.74) scale(0.25)';

export interface GlyphPart {
  d: string;
  /** Fill the shape with the glyph color (default: stroke only). */
  fill?: boolean;
  /** Draw no stroke (fill only). */
  noStroke?: boolean;
  /** Draw in the background color: used to hollow out a stroke. */
  knockout?: boolean;
  strokeWidth?: number;
  transform?: string;
}

const circle = (cx: number, cy: number, r: number) =>
  `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0z`;

const square = (x: number, y: number, s: number) =>
  `M${x + 1} ${y}h${s - 2}a1 1 0 0 1 1 1v${s - 2}a1 1 0 0 1-1 1h${-(s - 2)}a1 1 0 0 1-1-1v${-(s - 2)}a1 1 0 0 1 1-1z`;

const mark = (extra: Partial<GlyphPart> = {}): GlyphPart => ({
  d: ADET_MARK,
  transform: MARK_TRANSFORM,
  strokeWidth: ADET_MARK_STROKE,
  ...extra,
});

export const GLYPHS = {
  /** A full session (filled circle). */
  full: [{ d: circle(12, 12, 8), fill: true }],
  /** A minimum session (half-filled circle). */
  min: [{ d: circle(12, 12, 8) }, { d: 'M12 4a8 8 0 0 0 0 16z', fill: true }],
  /** Done: the Adet checkmark. */
  done: [mark()],
  /** Done at the minimum: the checkmark as a hollow outline. */
  doneMin: [mark({ strokeWidth: ADET_MARK_STROKE * 1.5 }), mark({ strokeWidth: ADET_MARK_STROKE * 0.6, knockout: true })],
  /** A rest day (crescent moon). */
  rest: [{ d: 'M19.5 14.6A7.9 7.9 0 1 1 9.4 4.5a6.3 6.3 0 0 0 10.1 10.1z' }],
  /** Bonus (plus in a circle). */
  bonus: [{ d: circle(12, 12, 8) }, { d: 'M12 8.6v6.8M8.6 12h6.8' }],
  /** Time / budget (clock). */
  clock: [{ d: circle(12, 12, 8.5) }, { d: 'M12 7.6V12l3 1.9' }],
  /** Frequency (calendar). */
  calendar: [{ d: 'M6.5 5h11A2.5 2.5 0 0 1 20 7.5v10a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5v-10A2.5 2.5 0 0 1 6.5 5zM8 3v3.5M16 3v3.5M4 10h16' }],
  /** Weekly progress (dots: two done, one to go). */
  dots: [
    { d: circle(4.8, 12, 2.4), fill: true, noStroke: true },
    { d: circle(12, 12, 2.4), fill: true, noStroke: true },
    { d: circle(19.2, 12, 1.9), strokeWidth: 1.4 },
  ],
  /** Swap (two curved arrows). */
  swap: [{ d: 'M5 10.5A7.2 7.2 0 0 1 17.8 7.2M18.5 3.6v4.2h-4.2M19 13.5a7.2 7.2 0 0 1-12.8 3.3M5.5 20.4v-4.2h4.2' }],
  /** Remove (small x). */
  remove: [{ d: 'M8 8l8 8M16 8l-8 8' }],
  /** Close a sheet (larger x). */
  close: [{ d: 'M6.5 6.5l11 11M17.5 6.5l-11 11' }],
  /** Settings (gear). */
  gear: [
    { d: circle(12, 12, 3) },
    {
      d: 'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
      strokeWidth: 1.8,
    },
  ],
  /** Week view (seven squares). */
  week: [
    { d: square(1.6, 6.4, 4.2), fill: true, noStroke: true },
    { d: square(7.1, 6.4, 4.2), fill: true, noStroke: true },
    { d: square(12.6, 6.4, 4.2), fill: true, noStroke: true },
    { d: square(18.1, 6.4, 4.2), fill: true, noStroke: true },
    { d: square(1.6, 13.4, 4.2), fill: true, noStroke: true },
    { d: square(7.1, 13.4, 4.2), fill: true, noStroke: true },
    { d: square(12.6, 13.4, 4.2), fill: true, noStroke: true },
  ],
  /** Day streak (flame). */
  flame: [{ d: 'M12 21c3.9 0 6.5-2.4 6.5-6 0-2.5-1.4-4.7-3-6.5-.3 1-.8 1.9-1.7 2.5C13.6 8.6 13 5.5 10 3c.3 2.5-.7 4.4-2.1 6C6.6 10.6 5.5 12.4 5.5 15c0 3.6 2.6 6 6.5 6z' }],
  /** Week streak (chain links). */
  chain: [{ d: 'M10.6 13.4a3.6 3.6 0 0 0 5.1 0l3-3a3.6 3.6 0 0 0-5.1-5.1l-1.1 1.1M13.4 10.6a3.6 3.6 0 0 0-5.1 0l-3 3a3.6 3.6 0 0 0 5.1 5.1l1.1-1.1' }],
  /** Timer controls. */
  play: [{ d: 'M8 5.5v13l10-6.5z', fill: true }],
  pause: [{ d: 'M9 6v12M15 6v12' }],
  /** Add (plus). */
  plus: [{ d: 'M12 5v14M5 12h14' }],
  minus: [{ d: 'M5 12h14' }],
  /** Edit (pencil). */
  pencil: [{ d: 'M12 20h8M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z' }],
  /** Delete (bin). */
  trash: [{ d: 'M4 7h16M9.5 7V4.5h5V7M6.5 7l.9 12.2a1.5 1.5 0 0 0 1.5 1.3h6.2a1.5 1.5 0 0 0 1.5-1.3L17.5 7M10 11v5.5M14 11v5.5' }],
  /** Archive (box). */
  archive: [{ d: 'M3.5 4.5h17v4h-17zM5 8.5v9.5a1.5 1.5 0 0 0 1.5 1.5h11a1.5 1.5 0 0 0 1.5-1.5V8.5M10 12.5h4' }],
  /** Unarchive (box with an up arrow). */
  unarchive: [{ d: 'M3.5 4.5h17v4h-17zM5 8.5v9.5a1.5 1.5 0 0 0 1.5 1.5h11a1.5 1.5 0 0 0 1.5-1.5V8.5M12 17v-5.5M9.5 14l2.5-2.5 2.5 2.5' }],
  /** Merge (two lines joining). */
  merge: [{ d: 'M6.5 3.5v4a5 5 0 0 0 5 5M17.5 3.5v4a5 5 0 0 1-5 5H12v8M8.8 17.6l3.2 3.2 3.2-3.2' }],
  /** Reminder (bell). */
  bell: [{ d: 'M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15zM10 20.5a2 2 0 0 0 4 0' }],
  /** Sign out (door with an arrow). */
  signOut: [{ d: 'M10 4H6.5A2.5 2.5 0 0 0 4 6.5v11A2.5 2.5 0 0 0 6.5 20H10M14.5 8l4 4-4 4M18.5 12H9' }],
  /** Synced (cloud with a tick). */
  cloud: [{ d: 'M7 18.5h10a4 4 0 0 0 .6-8A6 6 0 0 0 6.2 9.6 4.5 4.5 0 0 0 7 18.5z' }, { d: 'M9.5 14l1.8 1.8 3.2-3.3' }],
  /** Syncing (cloud with dots). */
  cloudSync: [{ d: 'M7 18.5h10a4 4 0 0 0 .6-8A6 6 0 0 0 6.2 9.6 4.5 4.5 0 0 0 7 18.5z' }, { d: 'M9 14.5h.01M12 14.5h.01M15 14.5h.01' }],
  /** Offline (cloud struck through). */
  cloudOff: [{ d: 'M7 18.5h10a4 4 0 0 0 .6-8A6 6 0 0 0 6.2 9.6 4.5 4.5 0 0 0 7 18.5z' }, { d: 'M4 4l16 16' }],
  /** Undo (curved arrow back). */
  undo: [{ d: 'M9 14.5L4.5 10 9 5.5M4.5 10h10a5 5 0 0 1 0 10H11' }],
  /** History list. */
  list: [{ d: 'M9 6.5h11M9 12h11M9 17.5h11M4.5 6.5h.01M4.5 12h.01M4.5 17.5h.01' }],
  /** Overview (bars). */
  bars: [{ d: 'M5 20V12M12 20V4M19 20v-6' }],
  /** Chevrons. */
  chevronRight: [{ d: 'M9 6l6 6-6 6' }],
  chevronLeft: [{ d: 'M15 6l-6 6 6 6' }],
  chevronDown: [{ d: 'M6 9l6 6 6-6' }],
  chevronUp: [{ d: 'M6 15l6-6 6 6' }],
  /** Info (i in a circle). */
  info: [{ d: circle(12, 12, 8.5) }, { d: 'M12 11v5M12 8h.01' }],
  /** Tabs. */
  today: [{ d: 'M6.5 4h11A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5v-11A2.5 2.5 0 0 1 6.5 4zM8 2.5V5M16 2.5V5M4 8.5h16M9 13.5l2 2 4-4' }],
  target: [{ d: circle(12, 12, 9) }, { d: circle(12, 12, 5) }, { d: circle(12, 12, 1.2) }],
} satisfies Record<string, GlyphPart[]>;

export type GlyphName = keyof typeof GLYPHS;

/** A glyph as a standalone SVG document (for previews and tests). */
export function glyphSvg(name: GlyphName, color = '#17181A', bg = '#FFFFFF', size = 24): string {
  const parts = (GLYPHS[name] as GlyphPart[])
    .map((p) => {
      const c = p.knockout ? bg : color;
      return `<path d="${p.d}"${p.transform ? ` transform="${p.transform}"` : ''} fill="${p.fill ? c : 'none'}" stroke="${
        p.noStroke ? 'none' : c
      }" stroke-width="${p.strokeWidth ?? GLYPH_STROKE}" stroke-linecap="round" stroke-linejoin="round"/>`;
    })
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" style="background:${bg}">${parts}</svg>`;
}
