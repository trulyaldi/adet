# Timer screen audit

This audit covers the active-session (focus) screen as it is on `main` at 47e7ca5, before the pixel redesign. Nothing was edited to write it.

## What renders

The screen is `src/overlays/FocusView.tsx`. It opens as a `Modal` from `FocusView` and holds `FocusContent`. Here is what it draws, from top to bottom:

| On screen | Component | Source | Carries state? |
|---|---|---|---|
| Stepped background wash in the project tint | `Svg` + `Rect` bands (`WASH_STEPS`) | FocusView.tsx | No (decor) |
| The project's focus scene (full-screen, behind everything) | `Scene` → `PlantScene` / `OrbitScene` / `FillScene` / `ConstellationScene` | `src/scenes/*` | No. It draws `progress`; `payoff` (= `ui.targetHits`) plays a one-shot pulse. |
| Header: habit icon tile + name | inline `View` / `Icon` / `Text` | FocusView.tsx | No |
| Dim button (appears after 2 min) | `IconButton` "dim" | FocusView.tsx | Local UI state (`dimOffer`, `dimmed`) |
| Mute | `IconButton` soundOn/soundOff | FocusView.tsx | **Yes**: toggles `devicePrefs.sound` |
| Collapse (minimize) | `IconButton` chevronDown → `actions.closeTimer` | FocusView.tsx | Closes the modal; the timer keeps running |
| Sword chip "⚔ 0 ⌄" | `QuestFocusRow` → `WeakPointsRow` | `src/screens/Quest/session/QuestFocus.tsx`, `WeakPointsRow.tsx` | **Yes**: see below |
| Big ring + count-up + "🕐 35m" | `ProgressRing` + `RingLabel` (`SessionClock`, `Glyph clock/sparkle`) | `src/components/motion/ProgressRing.tsx`, FocusView.tsx | Display only, but it is **the screen's main progress signal and accessibility label** |
| Battle scene + HP bar + seal pips | `QuestFocusStage` → `SkiaGate(loadStage)` → `Stage` (`Backdrop`, `StageAvatar`, `Enemy`, `HPBar`, `SealPips`) | `src/screens/Quest/session/Stage.tsx`, `src/game/ui/HPBar.tsx`, `SealPips.tsx` | Presentation of derived game state (see HP below) |
| Character portrait (when the Stage is off) | `Character` | `src/components/character` | No |
| Toast | `MessageToast` | `src/components/UndoToast.tsx` | Shows store messages |
| Pause / Resume | `Button` secondary → `actions.togglePause` | FocusView.tsx | **Yes** (timer) |
| Done | `Button` → Burst, then `useStopTimer()` after 520 ms, with a `finishing` retry guard | FocusView.tsx, `src/store/useStopTimer.ts` | **Yes**: saves the session, and the loot chest flow follows |
| Dim overlay | `Pressable` + `SessionClock` | FocusView.tsx | Local UI state |

The behaviours that live in `FocusContent` and must survive any redesign:

- `useKeepAwake`
- swipe down to minimize
- the dim offer and overlay
- the cheer window (`ui.cheerUntil`), which sets the portrait's mood
- the Burst, the 520 ms stop delay and the `finishing` guard on Done

The blue gear button floating on screen is the Expo Go developer menu, not part of the app. It is ignored here.

## The "4 timer animations"

The four animations are **not a device preference, and there is no in-session picker.** Each one is a per-project field:

- `Project.scene: SceneKind = 'plant' | 'orbit' | 'fill' | 'constellation'` in `src/domain/types.ts:38,58`
- `SCENES`, `isScene`, the hash fallback in `projectLook`, and `nextScene` (round-robin at creation) in `src/domain/look.ts`
- **Synced:** written and read in `src/sync/rows.ts:59` and `:168` (the `scene` column on projects)
- **Picker:** the "Scene" row in `src/overlays/ProjectSheet.tsx:116-137`, which uses `ScenePreview` and `SCENE_NAMES`
- **Previews:** `src/components/ScenePreview.tsx`, also used by `src/overlays/WelcomeFlow.tsx:126-162`
- **Renderers:** `src/scenes/Scene.tsx` (switch), `PlantScene.tsx`, `OrbitScene.tsx`, `FillScene.tsx`, `ConstellationScene.tsx`, and shared hooks in `common.ts` (`useSceneProgress`, `useLoop`, `usePulse`)
- **Props** (`SceneProps`): `width`, `height`, `cx`, `cy`, `ringR`, `progress`, `sessionSec`, `swatch`, `payoff`, `moving`, `reduced`, `dark`

Every project gets a scene when it's created, so for most users the animation they see was assigned automatically, not chosen.

**Consequence for the redesign:** writing or migrating `project.scene` would touch sync, which the task rules out. The new skin is therefore a local device preference, and the "migration" is a read-only mapping from the project's scene when no skin has been chosen. The four scenes, `ScenePreview`, the ProjectSheet picker and the WelcomeFlow previews all stay alive on the non-Quest path, which keeps its current screen. They are **not dead code** while `EXPO_PUBLIC_QUEST_ENABLED=false` is supported.

## What the thin vertical bar is

It is **not a duration or progress control**, and it isn't interactive. The purple stroke behind the controls, with its lavender oval, is the **PlantScene sprout** at its minimum growth. The stem is drawn from `baseY = height - 70` with `grow = max(0.04, progress)`, and the oval is its soil ellipse. The screenshot's "Coding" project uses the `plant` scene. For a `fill` project, the equivalent thin bar on the left is FillScene's glass glint (`x0 + 22`). Either way it is a second, partial picture of the same "today vs target" progress the ring shows. It's decoration, so it can go.

## Redundancy

- The **ring**, the **scene** and the **HP bar** all answer "how far along am I", but they measure different things:
  - The ring and the scene show **today's time against the habit's target** (`p.sec / p.targetSec`). That includes earlier sessions today, can exceed 1 (bonus colour, sparkle), and `RingLabel` shows `sec / target` once earlier sessions exist.
  - The HP bar shows **the current enemy's health**. It comes from the game engine's live preview (`previewGame`), not from elapsed/target. An enemy can fall mid-session and the next one walks in, and a boss at 0 HP waits for its seals.

  Faking HP from elapsed/target would contradict the loot chest. The redesign keeps both signals but gives each one a single picture: the skin (the world) shows target progress, and the HP pips show the enemy.
- `targetHits` (the store counts target crossings) drives the scene's payoff pulse. It must become a one-shot moment in the new scene.

## What carries state

- **`WeakPointsRow` (the sword chip) is not a kill counter.** It picks up to three of the habit's open weak points for this session (`pickWeakPoints` → local quest state) and can add a new task (`writes.addTask`). Those weak points feed the saved session's outcome. It is load-bearing, so it has to stay reachable from the timer screen.
- Mute (`devicePrefs.sound`), Pause and Done (timer), dim (local).
- The Quest setting `battleStrip` (shown as "Scene on the timer", synced in `quest_meta.settings`) decides whether the battle shows.

## Stage facts that matter for the redesign

- The Stage is loaded lazily through `loadStage` in `src/game/render/screens.ts` (native `require`) and `screens.web.ts` (`import()`, which CanvasKit needs), behind `SkiaGate`. `noDynamicImport.test.ts` guards this. Never import Skia statically into `FocusView`, because that was the Expo Go HMR crash.
- `stageSize` caps the Stage at 28% of the screen height and gives screens under 700 pt (including the iPhone SE) a 72 pt slim strip.
- The hero swings every 4–6 s (`attackGap`) whatever the damage, while damage itself moves once per focused minute.
- The atlas has no sun, moon, campfire or hourglass sprites. `decor.<biome>.landmark`, `icon.star`, `npc.sage.idle`, `fx.zzz`, the critters and the biome parallax all exist.
- The name "Trail" is already used in the Scribe (`src/screens/Quest/sheets/Trail.tsx`, per-habit progress).
