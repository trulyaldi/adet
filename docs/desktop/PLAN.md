# Adet Desktop: shared plan

One codebase. The Expo web build gets a desktop layout for wide windows (target 1920×1080, also 1366×768). Phones and the native iOS app do not change. Wave 0 (this branch) is the foundation; waves 1 and 2 build on it. Read [HANDOFF_0.md](HANDOFF_0.md) for the API.

Calm rules stay: no guilt UI, nothing flashes, no sound during focus. No new features and no new dependencies without asking.

## Tiers

| Tier | When | Layout |
|---|---|---|
| phone | native always; web below 1024 wide; or `EXPO_PUBLIC_DESKTOP=false` | unchanged: tab bar at the bottom |
| desktop | web, 1024 to 1599 wide | sidebar + main area |
| wide | web, 1600 and up | same shell, more room |

`useLayout()` (src/theme/useLayout.ts) returns `{ tier, isDesktop, width, height, sidebarW, railW, gutter }`.

## The grid

The shell is a sidebar (240) and a main area. Inside the main area a screen pads by the gutter (32), then splits into a main pane and an optional right rail (360, a gutter between). A rail sits beside the main pane from 1280 wide; narrower, it stacks under it.

| Window | Tier | Main area | Content (minus 2 gutters) | Main pane with a rail | Height of content |
|---|---|---|---|---|---|
| 1920 × 1080 | wide | 1680 | 1616 | 1224 (rail 360 beside) | 1016 |
| 1366 × 768 | desktop | 1126 | 1062 | 670 (rail 360 beside) | 704 |
| 1024 × 768 | desktop | 784 | 720 | rail stacks under | 704 |
| 2560 × 1440 | wide | 2320 | 2256 | 1864 | 1376 |

`Grid` is 12 columns with the gutter between columns and rows. Column width is fractional by design (1616 content at 1920 gives about 105.3 px per column); only pixel art snaps to whole numbers. A `Col` span is a number, or `{ desktop, wide }`; on phone every `Col` is the full row.

```
1920 × 1080                                1366 × 768
+-------+---------------------------+      +-------+--------------------+
|       |  32                       |      |       | 32                 |
| side  |  +--------------+ +-----+ |      | side  | +-------+ +-----+  |
| bar   |  | main 1224    | |rail | |      | bar   | | main  | |rail |  |
| 240   |  |              | |360  | |      | 240   | | 670   | |360  |  |
|       |  +--------------+ +-----+ |      |       | +-------+ +-----+  |
+-------+---------------------------+      +-------+--------------------+
```

Beyond 1920 the content should stop growing: a track centers its content at the 1920 content width (1616) instead of stretching to 2560. This is a recommendation for wave 1 to confirm; wave 0 does not cap.

## Tokens

| Token | Value | Where |
|---|---|---|
| `DESKTOP_MIN` | 1024 | src/theme/layout.ts |
| `WIDE_MIN` | 1600 | layout.ts |
| `RAIL_MIN` | 1280 | layout.ts |
| `SIDEBAR_W` / `sidebarW` | 240 | layout.ts |
| `RAIL_W` / `railW` | 360 | layout.ts |
| `GUTTER` / `gutter` | 32 | layout.ts |
| `GRID_COLUMNS` | 12 | layout.ts |
| `PHONE_COLUMN_W` | 480 | components/desktop/DesktopShell.tsx |
| spacing `space` | 4, 6, 10, 14, 18, 24, 32 | src/theme/theme.ts (unchanged) |
| corners `radius` | 2, 3, 4, 4, 6, 6 (pixel look) | theme.ts (unchanged) |
| type | display 34, title 28, heading 18, body 15.5, small 13, caption 11.5 | theme.ts (unchanged) |
| colors | the existing light and dark sets | theme.ts (unchanged) |

Desktop adds no colors, radii or fonts. A screen that needs a bigger type size on desktop asks in its handoff; it does not invent one.

## Pixel scaling: integers only

Pixel art (the Quest world, the pixel timer, glyphs, mascot) is drawn at a whole-number multiple of its source pixels, never a fraction. The existing helper is `pixelScale(width)` in `src/game/render/grid.ts` (largest integer scale that still shows 112 game pixels across, clamped 2 to 8). Rules for desktop:

- Feed it the width of the pane the art lives in, not the window. Today `useUiUnit()` (src/game/ui/theme.ts) reads `useWindowDimensions()`, which on desktop is 1920 even when the art sits in a 480 px column. `PixelStage` itself takes `width` as a prop, so each caller decides where that width comes from. Track C1 fixes the ones it owns; the others are listed in HANDOFF_0.
- At 1920 the quest pane is 1680 wide, so `pixelScale` gives 8 (the clamp). At 1366 it gives 8. A 480 px column gives 4.
- Size the canvas to a whole multiple of the scale so nothing is resampled. While the desktop shell is mounted the page sets `image-rendering: pixelated` on every canvas (scoped to `html[data-adet-desktop]`).
- Vector UI (rings, bars, text) is not snapped; only pixel art is.

## Targets per track

**A: Today and Projects.** Today becomes a two-pane screen. Left, the day: the ring and the plan list, in a comfortable reading width (not stretched to 1900). Right rail (360): a calm summary: streak, what is left, capacity. The screen's own header duplicates the sidebar (logo, sync, settings), so it drops those and keeps only what the sidebar lacks (streak pill, Week). Projects is a list on the left and the selected project's detail (habits, weekly target, sessions) in the rail, instead of rows that expand across the window. No new data, no new actions.

**B: Stats (Almanac).** The dashboard becomes a grid: on desktop the four summary tiles sit in one row, the week chart takes about two thirds of the width beside the projects progress, and the hour heatmap and streak calendar share a row below. At 1366 it drops to two columns; at 1024 to one. Charts keep their calm look: no animation beyond what exists, no guilt colors.

**C1: Quest (map and world).** The Quest tab fills the whole main area (`useDesktopFill()`), world and realm maps scaled by an integer from the pane width, centered, with the HUD panel at pane width. No dead band at the bottom and no off-center map: the scene is composed for the pane, and the pixel UI unit follows the pane, not the window. The Sage, Scribe and character panels live in `Quest/sheets/` (Track D); C1 only leaves room for them and requests any change in its handoff.

**C2: Focus, celebrations, session.** Focus view fills the window with the timer centered at an integer pixel scale and generous empty space; nothing flashes, no sound. Celebrations and ceremonies are centered cards at a capped width (about 480 to 560), not full-window scrims with stretched art; confetti and burst use the window. Quest session screens (result, loot, ceremonies) use the same centered width.

**D: Sheets and overlays.** On desktop a sheet is a centered dialog (width 480 to 640, max 80% of the window height), not a bottom sheet; the drag handle goes, a backdrop click closes it, and so does Escape for the sheets and dialogs D owns (wave 2 E adds the app-wide shortcuts and focus order, not per-dialog Escape). Forms inside keep their phone arrangement. The welcome flow is a centered card with its pager and button at card width. Sign-in is a centered card. Date and time fields use a web-appropriate control. Phones keep the bottom sheet exactly.

**F: shell, packaging and build.** The Tauri wrapper (src-tauri/), Cloudflare/wrangler config, CI, and web scripts. Not part of the UI; it must not require UI changes. The web export is the artifact it wraps.

**G: platform services.** Feedback, notifications and platform shims for desktop: web audio unlock, no haptics, the Notification API instead of the mobile scheduler, and the `src/platform/*` seams. No visual changes.

## Files each track owns

```
A: src/screens/TodayScreen.tsx, src/screens/ProjectsScreen.tsx, src/components/today/*, MiniDayRing, CapacityIndicator, Flame
B: src/screens/StatsScreen.tsx, src/components/stats/*
C1: src/screens/Quest/ except session/, ceremonies/ and sheets/; src/game/ui/theme.ts; src/game/render/Transitions.tsx
C2: src/overlays/FocusView.tsx, src/overlays/focusShell.tsx, src/overlays/CelebrationHost.tsx, src/components/celebrate/*, src/screens/Quest/session/*, src/screens/Quest/ceremonies/*
D: src/components/Sheet.tsx, every other file in src/overlays/, src/screens/Quest/sheets/*, src/screens/SignInScreen.tsx, src/components/DateTimeField.tsx
F: src-tauri/, wrangler config, .github/, scripts/web-*, src/game/render/SkiaGate.web.tsx, and the scripts section of package.json
G: src/feedback/*, src/notifications/*, src/game/feedback/*, src/platform/*
Wave 2 (E keyboard and pointer, H audit): any file, but only after wave 1 is merged.
Anything outside a track's list is changed only by a request in its handoff file.
```

## Foundation files

Wave 0 owns App.tsx, src/theme/layout.ts, src/theme/useLayout.ts, src/components/desktop/*, and the export-only edits to TabBar.tsx and QuestBadge.tsx. After wave 0 merges these are changed only by a handoff request, like any file outside a track's list.
