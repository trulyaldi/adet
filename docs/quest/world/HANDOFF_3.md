# Handoff 3: the Realm screen

Branch `feat/world-3-realm`, cut from `main` at 6aaa806. Screenshots are in `docs/quest/world/media/s3-*.png`.

## Done

- **The Quest tab is now the Realm screen** (`src/screens/Quest/QuestScreen.tsx`). It shows one realm's path in its slot's biome, with the slot's palette, mob sprites and boss sprite, and existing sprites only.
  - **Path:** the uncleared quests, oldest first, 8 at most, the lair counting as one. The oldest uncleared boss sits in the lair at the top, with phase pips (gold when cleared).
  - **Camp:** the Sage, Merchant and Scribe at the path's start, with the "+" just above it.
  - **Cleared quests** leave the path and are listed as **Trophies** at the top of the Scribe's chronicle. The old chronicle entries stay below, untouched.
- **New files in `src/screens/Quest/realm/`**
  - `realmModel.ts` (pure, tested): `realmLayout(map, view)`, `mobSprite(biome, questId)`, `MAX_NODES = 8`.
  - `RealmMap.tsx` (Skia): one biome, with vertical pan limited to the island plus a little sky. The sky of the biomes above and below fills the ends.
  - `QuestNodeSheet.tsx`: title, 3 hearts (or "Phases n/m" and a row per phase), one big **Start**, a small **Mark done** (✓), and **⋯** for Edit / + Phase / Delete. Delete asks to confirm.
- **Add a quest:** tap "+", type into one field, press Enter, and it's a mob. An empty realm shows only the pulsing "+" and "What do you want to beat?" under the HUD.
- **Mark done:** calls `markDone` and plays sparkles on the node. A 6 s **Undo** chip follows (`undoResult`).
- **Start:** `setTimerQuest(questId)` (`src/game/state/timerQuest.ts`, a param only), then the existing start sheet opens. The timer doesn't read it yet; `takeTimerQuest()` is there for world-4.
- **`TEMP(world-5)`:** slot 0 is auto-claimed as "My first realm" once the journey has started and the quest tables are available. The screen shows the first claimed slot.
- **Veteran protection:**
  - The legacy linear journey isn't converted, shown or touched.
  - The HUD still shows level, rank and credits.
  - The chronicle stays.
  - The time-based journey still derives (`TEMP(world-2)`) until world-4.
- **Checks**
  - `tsc` is clean.
  - Lint: 0 errors, 81 warnings (main has 83).
  - Tests: 520/520 pass, 5 of them new (`realm/realmModel.test.ts`).
  - Bundle (iOS Hermes): 5,178,205 → 5,197,053 bytes (+18,848 B, +0.36%), within budget.
- **Web QA** at 375×667 and 430×932: empty realm, path, node sheet, lair with pips, and another biome (iron, slot 4). Device QA is not done yet.

## Left

- **world-4:** the timer reads `takeTimerQuest()`, shows the quest's enemy with its hearts, and asks for the result after the session (`recordResult`). It also replaces the time-based journey HP (`TEMP(world-2)`).
- **world-5:** the Overworld. Claiming slots replaces the auto-claim, tapping a realm opens this screen for that realm, and the clouds come in.
- **Dead or legacy pieces kept for the dev QA panel** (it still previews the old journey): `map/JourneyMap.tsx`, `map/BiomeLayer.tsx`, `planReveal`, `cameraFor`, `spotFor` and `useQuestModel().at`. Remove them with the legacy journey in world-4 or world-5.
- **Hidden quests:** past 8 they're counted (`layout.hidden`) but not shown or hinted at. Consider a small "+N" by the lair.
- **Bosses only fall through their phases:** the sheet offers Mark done per phase, not for the boss.

## Decisions

1. **The Realm screen replaced the journey map** on the Quest tab instead of adding a second screen. Onboarding, the HUD, sheets, quick log and ceremonies are kept.
2. **Only the oldest uncleared boss** takes the lair. Other bosses stand on the path with a mob sprite, and their sheet shows the phases.
3. **Trophies are a Scribe list, not graves on the map.** This keeps the path uncluttered.
4. **Start opens the existing start sheet** (the habit picker), because a timer needs a habit.
5. **The "+" is a pixel plate drawn in code.** The atlas has no plus sprite.
6. **Mark done gets a 6 s undo chip.** The plan's undo rule needed a way in, and it costs one small chip.
7. **Clutter check:** the map shows one primary action (the "+"); the quill (quick log) stays as a small secondary icon. Inside the sheet, Start is the only big button.

## Must know

- **Web QA harness** (scratchpad, not committed): seed `streak-v3` with `ops.startQuest` and the `worldOps` writes, and set `adet-quest-tables-v1 = available` and `badgesPrimed = true`. Block `supabase.co`, open the tab labelled "Quest", and dismiss any "Continue" celebrations.
- **Lint:** Quest code must lint with zero errors. Write to shared values with `.set()` in gesture handlers; the compiler lint rejects `.value =` on props.
