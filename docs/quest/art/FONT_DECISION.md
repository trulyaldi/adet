# Pixel font decision (v2 N2)

**Decision: Tiny5 for all pixel text, words and numbers.** No second numeral font and no
`PixelNumber` component are needed.

The owner reported that in Pixelify Sans a "5" reads as "S" ("50" looked like "S0") and a
bold "C" reads as "O". The sample sheets confirm it, and show a worse problem: Pixelify's
"fi" ligature draws "first" as "Arst".

## Sheets

- `font-sheet-1x.png`: every candidate at 10 / 12 / 14 / 16 / 20 pt, 1×.
  Text: `0123456789 SCO5S 8B XP LV +50 -12`.
- `font-sheet-3x.png`: the shortlist at 10 / 12 / 16 pt, 3× (how an iPhone rasterises
  them), with digits, a sentence and a stats line.

Rendered with Pillow from the `@expo-google-fonts` files (the same files the app loads).

| Font | 5 vs S | 0 vs O | C vs O | 8 vs B | Words at 12 pt | Verdict |
|---|---|---|---|---|---|---|
| Pixelify Sans (was) | fails | weak | fails (bold) | ok | "fi" ligature bug | no |
| Silkscreen | ok | ok | ok | ok | capitals only, wide | no (all caps) |
| Press Start 2P | ok | ok | ok | ok | very wide, breaks layouts | no |
| VT323 | ok | ok | ok | ok | thin, small x-height | no |
| Jersey 10 / 15 | close at 12 pt | ok | ok | ok | good | runner-up |
| Tiny5 | **clear** (square top on 5) | **clear** (0 narrower) | **clear** | **clear** | good, chunky | **chosen** |
| DotGothic16 | clear | clear | clear | clear | thin, dot-matrix look | numeral fallback if ever needed |
| Micro 5, Handjet | ok | ok | ok | 0 vs 8 close (Handjet) | too condensed | no |

## Details

- **Grid:** Tiny5 is drawn with one font pixel = 1/8 em (caps are 5 font pixels), so
  multiples of 8 pt are perfectly crisp. The size scale keeps the old steps (sm 14,
  md 16, lg 20, xl 28) because at 3× the off-grid sizes read cleanly on the sheet.
  `tiny` went from 10 to **12**, so the smallest text stays unambiguous, and `hero`
  from 44 to 48 (on the grid).
- **Weight:** one weight only. `bold` pixel text uses the same face; emphasis comes from
  size and colour.
- **Glyphs:** Tiny5 covers every character the app writes, including `+ − × / %`,
  `· … – —`, arrows and the Kazakh letters in NPC names, with one exception: `✓`.
  Check marks are now drawn by `PixelCheck` (a 7×5 pixel grid). `fonts.test.ts`
  reads the font's `cmap` and fails if a new string uses a missing glyph.
- **Removed:** `@expo-google-fonts/pixelify-sans` and `@expo-google-fonts/silkscreen`.
  Credits now list Tiny5 (SIL OFL 1.1).
