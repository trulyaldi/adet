# Wave 0 handoff: desktop foundation

Branch `feat/desktop-0`. No migration. Phones and native are unchanged (verified, see the end). Plan: [PLAN.md](PLAN.md).

## API

```ts
// src/theme/layout.ts  (pure, node-testable)
layoutFor(width, platform, height = 0, enabled = DESKTOP_ENABLED): Layout
desktopEnabledFrom(raw): boolean            // EXPO_PUBLIC_DESKTOP, on unless false/0/off/no
colSpan(span: Span, tier): number           // 1..12; phone is always 12
DESKTOP_MIN 1024, WIDE_MIN 1600, RAIL_MIN 1280, SIDEBAR_W 240, RAIL_W 360, GUTTER 32, GRID_COLUMNS 12

// src/theme/useLayout.ts
useLayout(): { tier: 'phone'|'desktop'|'wide', isDesktop, width, height, sidebarW, railW, gutter }  // memoized

// src/components/desktop  (barrel: index.ts)
<DesktopShell active onChange onOpenSettings toasts>{screen}</DesktopShell>   // App.tsx only
<TwoPane rail={...} flush?>{main}</TwoPane>   // beside from RAIL_MIN, stacked under it, phone: children alone
<Grid><Col span={6}/><Col span={{ desktop: 6, wide: 4 }}/></Grid>
useDesktopFill()   // call in a screen: it gets the whole main area instead of the phone column
PHONE_COLUMN_W = 480

// src/components/TabBar.tsx
export const TABS                 // the filtered list (Quest kill switch applies)
export function useQuestTab()     // { label, badge } for the Quest destination
// src/components/QuestBadge.tsx: <QuestBadge style?> (style overrides position)
```

Desktop means `Platform.OS === 'web'` and width >= 1024. `isDesktop` is false on every native build, iPads included (`supportsTablet` is true). Kill switch: `EXPO_PUBLIC_DESKTOP=false` (in `.env.example`); restart Metro after changing it, Expo inlines it.

Use `useLayout()` for decisions that differ by tier. Use `Platform.OS` only for the web-vs-native question, never for width.

## Decisions not in the brief

1. **`layoutFor` and the hook are in two files.** `layout.ts` can't import react-native because node tests load it (same split as `motion.ts` and `useMotion.ts`). The hook is in `useLayout.ts`. `layoutFor` takes two optional extra arguments, `height` and `enabled`, so the kill switch is testable.
2. **No resize remounts.** App.tsx swaps one slot (the whole chrome: spacer + screen + TabBar, or DesktopShell) so the overlays and hosts after it keep their position in the tree. Crossing 1024 does remount the screen itself (its parent changes), so local screen state resets; overlays, sheets and ceremonies keep theirs.
3. **Phone column.** Until a screen opts out with `useDesktopFill()`, the shell puts it in a 480 px column centered in the main area. That is what "still phone-shaped inside" looks like. The opt-out lives in the screen's own file, so no track needs to edit the shell. Opt-out lasts while the screen is mounted (layout effect, no flash).
4. **Rail breakpoint 1280**, a window width, not a pane width. Below it the rail stacks under the main pane. `TwoPane` never scrolls; each pane brings its own ScrollView. On phone `TwoPane` renders only its children and drops the rail, so a screen must decide what the rail's content does on phone.
5. **Page setup is injected at runtime**, not in a `web/index.html`. `useDesktopPage` (components/desktop/webPage.ts) adds a `<style>` and a `data-adet-desktop` attribute on `<html>` while the shell is mounted, and removes both on unmount. Rules: `html/body` full height, overflow hidden, no overscroll; `canvas { image-rendering: pixelated }`. Scoping it this way keeps phone web and the kill switch exactly as before (a global canvas rule would change Skia output at 390). Expo's own template already has `body { overflow: hidden }` and the title `Adet`, so no template was needed.
6. **Window title** is `<Screen> · Adet` (for example `Almanac · Adet`) while on desktop, and the original title returns on unmount.
7. **Text selection.** Only the sidebar has `userSelect: 'none'`. Screen content stays selectable.
8. **Sidebar names.** It shows the game word (`Almanac`); the accessibility label is the tab's spoken one (`Almanac, stats`; Quest says `Quest, a chest is waiting` when it does). Items use `accessibilityRole="tab"` like the tab bar, so role-based scripts work on both. Settings is a `button`.
9. **Toasts** sit at the bottom center of the main area, max 480 wide, 16 above the edge, in a `pointerEvents: 'box-none'` wrapper so they never block clicks around them.
10. **Sync indicator** in the sidebar is the existing `SyncIndicator`; its tooltip still opens on touch only (hover is wave 2).
11. **No pixel helper added.** The existing `pixelScale` in `src/game/render/grid.ts` is the integer scaler; see PLAN.
12. **Capture script.** `docs/desktop/capture.cjs` is not wired into package.json and needs Playwright from outside the repo (see below). No dependency was added.

## Baseline at 1920×1080: what breaks (docs/desktop/media/baseline-*.png)

- Today: ring centered, rows stretch to about 1890 px, the play button is 1800 px from the habit name; the header lockup, streak, sync, Week and Settings sit at the far edges.
- Projects: one 1890 px card; the rest of the window is empty.
- Almanac: tiles, chart and bars stretch to full width; the bottom is cut by the tab bar, content scrolls.
- Quest: the map canvas fills the window but the scene is off-center (island at x about 800 of 1920) with a dead band at the bottom; HUD is a full-width bar.
- Tab bar: four icons spread across 1920.
- Welcome flow (baseline-1920-welcome.png): the pager footer clips against the card edge and the continue button is full width. Track D.
- Bottom sheets are full width (Sheet.tsx). Track D.
- Page: no body scroll even at baseline (Expo's reset), title is `Adet`.

## After wave 0 (docs/desktop/media/shell-*.png at 1024, 1366, 1920, 2560)

The sidebar, a phone column for Today, Projects and Almanac, and the Quest map in the column. Today's own header still shows the lockup, streak, sync, Week and Settings: duplicated with the sidebar until Track A trims it.

## For later tracks

Code that sizes itself from the window, not its container (on desktop the window is far wider than the column or pane):

- **C1:** `src/game/ui/theme.ts` `useUiUnit()` (window width, so the HUD unit is based on 1920 inside a 480 column); `src/game/render/Transitions.tsx`; `src/screens/Quest/Playground.tsx`, `qa/*` (dev panels).
- **C2:** `src/overlays/FocusView.tsx`; `src/components/celebrate/Confetti.tsx`; `src/screens/Quest/ceremonies/Stage.tsx`, `WorldMoment.tsx`; `session/QuestFocus.tsx`, `LootSheet.tsx`, `ResultSheet.tsx`.
- **D:** `src/overlays/WelcomeFlow.tsx` (pager width = window width); `src/screens/Quest/sheets/common.tsx`, `MerchantSheet.tsx`, `CharacterSheet.tsx`; `src/components/DateTimeField.tsx`; `Sheet.tsx`.
- `PixelStage` and `game/render/grid.ts` `pixelScale` take a width; give them the pane width (not owned by a track: ask in a handoff).

Other things to know:

- Every overlay is a react-native-web `Modal`, which portals to `document.body`, outside the shell and covering the sidebar. That is right for ceremonies and sheets, and it is why they look the same at any width until D and C2 change them.
- Modals use `role="dialog"`; scripts can dismiss celebrations by clicking the last button in `[role="dialog"]`.
- Hosts, watchers, `FocusView`, the Quest hosts and every sheet stay mounted in App.tsx exactly as before.
- Wave 2 (E) still needs: hover and focus rings for `NavItem` and every Pressable, keyboard shortcuts, tab order in the sidebar, Escape for overlays.
- Lint: 0 errors, 81 warnings, same as `main`.

## Verification done

- `tsc --noEmit`: clean. `npm run lint`: 0 errors, 81 warnings (unchanged). `npm test`: all pass, plus 7 new tests in `src/theme/layout.test.ts` (1023 vs 1024, 1599 vs 1600, native stays phone at 1024 to 1920, kill switch, env parsing, tokens, column spans).
- `npx expo export --platform web` succeeds.
- Phone is unchanged: the `#root` DOM at 390×844 and at 1023×768 (Today, Projects, Almanac, Quest), taken from `main` and from this branch, differs only in idle-animation frames (mascot transforms). With `EXPO_PUBLIC_DESKTOP=false` the 1920×1080 DOM matches `main` the same way.
- Native was not run on a device or simulator; unchanged by construction (`Platform.OS` gate, `layoutFor` returns phone for ios/android), but device QA of the phone path is still open.

## Web QA recipe (what the screenshots used)

No capture script existed in `scripts/`, and Playwright is not a dependency. I used a Playwright install from the npx cache (`~/.npm/_npx/*/node_modules/playwright`, with Chromium in `~/.cache/ms-playwright`). Run:

```
npx expo start --web --port 8123        # do not set CI=1 (it stops Metro watching)
PW=~/.npm/_npx/<hash>/node_modules/playwright node docs/desktop/capture.cjs http://localhost:8123 1920 1080 out/shot Today Projects Almanac Quest
```

The script routes `supabase.co` to abort and seeds four localStorage keys before load: the Supabase session `sb-<project-ref>-auth-token` (far-future expiry, user `qa-user`; the ref is hard-coded for this project), `streak-settings-v1` (`welcomeSeen`, no daily prompt), `streak-sync-v1` (`ownerId: 'qa-user'`, which keeps the built-in sample data instead of dropping it) and `adet-quest-tables-v1 = available`. Celebrations appear about 8 to 14 s after load, so it waits 14 s and then clicks through every `[role="dialog"]`. Run one capture at a time: four at once starved the CPU and caught a Quest ceremony mid-scene.

Open question for the owner: add a `scripts/web-capture` (that is Track F's area) and Playwright as a devDependency, or keep this out-of-repo recipe.
