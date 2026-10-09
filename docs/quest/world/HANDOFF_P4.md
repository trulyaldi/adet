# Handoff P4: Projects as Realms, the Start flow

Branch `feat/project-realms-4-start` (worktree `../adet-p4`), cut from `origin/main` (d544a8c, #37 merged). Uses only the P2 domain API (`realmOfProject`, `openQuestsOf`, `liveWorld(items, projects)`, `worldOps.addQuest` through the existing `useWorldWrites().addQuest`). Nothing under `src/domain/world/`, `supabase/`, `QuestScreen.tsx`, `overworld/*`, `ResultSheet.tsx` or `target.ts` changed. No migration, no dependency, no sync change. **Not committed**: the tree is left for you to commit.

Checks: `tsc` clean. Lint 0 errors / 81 warnings (same as main). Tests 603/603 (576 + 27 new). The new test files also type-check (scratch tsconfig, since `tsconfig.json` excludes tests). Not run on a device or on web: §18 of `DEVICE_QA.md` is the checklist.

## What it does (flag `EXPO_PUBLIC_PROJECT_REALMS` on)

1. **Objective field** at the top of `StartSheet`: one `TextInput`, placeholder "Objective", the same `inputStyle` as the other sheets, `maxLength` = `QUEST_TITLE_MAX` (80), Done key. Typed text applies to whichever project card or habit chip is tapped next. On start: `addQuest(realm.id, title)` (the id is made before the write and returned at once), then `setTimerQuest(id)`, then `bindTimerQuest(habit.id)`, then the timer. If `addQuest` returns null (not written), the session is free.
2. **Chips:** under each project card whose realm is placed, up to 3 open quests (`openQuestsOf`, oldest first; a boss shows its next open phase) with a target icon. A tap starts the project's first non-check habit with that quest bound. Cleared quests never appear (they are not in `openQuestsOf`).
3. **No realm** (eighth project, resting realm, flag off, journey not started, quest tables not ready): no chips for that project, and a typed objective is ignored for it (a free session). If no listed project has a realm, the field is not shown, unless a Realm-screen quest is pending (then it shows that quest, disabled, whatever the realms are).
4. **Realm screen path:** a quest set pending by `setTimerQuest` shows in the field as the chosen objective, greyed and not editable; chips are hidden then. Any habit tapped binds it, exactly as before.
5. **Relaunch:** kept, cheaply. See below.
6. **Check habit:** unchanged. Nothing is created or bound, the pending quest is dropped, as before.

Flag off: the field, chips and persistence code never run. `start()` goes through the same calls in the same order as before (`closeStartSheet`, `dropTimerQuest`+`toggleCheck` for a check, else `bindTimerQuest` and the timer after `MODAL_GAP_MS`).

## Files

- `src/game/state/startFlow.ts` (+ test): pure. `cleanObjective`, `placedRealmOf` (`realmOfProject` and `slot >= 0`), `firstTimedHabit`, `chipsFor`, `planStart` (free / bind / create), `START_CHIPS_MAX = 3`.
- `src/game/state/timerQuest.ts` (+ test): the binding now carries `at`, has change listeners, `pendingTimerQuest()`, `parseBinding`, `adoptTimerQuest`. Same behaviour in memory as before.
- `src/game/state/useTimerQuestPersistence.ts`: the device copy (called from `QuestWatcher`, one line).
- `src/game/state/local.ts`: `QuestLocal.timerQuest` (the parser is a whitelist, so the field had to be added there).
- `src/game/enabled.ts` (+ test): `PROJECT_REALMS` / `projectRealmsFrom`.
- `src/overlays/StartSheet.tsx`, `docs/quest/DEVICE_QA.md` (§18, and a pointer in §17's relaunch line).

## Persistence (item 5)

Done, and cheap. The running timer survives a relaunch through `data.active`, which is synced (`active_timers`), so the binding must not go there. It is kept in the existing per-account device-local key `adet-quest-local-v1:<user>` (`QuestLocal.timerQuest`), never synced, no schema change. Rules:

- Restored once, after both the store and the local key have loaded, only if the stored habit equals `data.active.habitId` and the binding is not older than `SESSION_MAX_SEC` (16 h). Otherwise the stored copy is cleared.
- A `releaseTimerQuest()` that runs before the copy is restored (the focus view calls it whenever a habit runs with no bound quest) is a no-op, so it neither writes nor blocks the restore. A bind made here since launch wins over the stored copy.
- Another device resuming the timer runs a free session (the copy is this device's).
- With the flag off, nothing is read or written.

## Decisions not in the prompt

1. **The flag lives in `game/enabled.ts`**, next to `QUEST_ENABLED`: default off, requires `QUEST_ENABLED`, true only for `1/true/on/yes`. HANDOFF_P2 gave this file to Session 3, so **expect a trivial merge overlap**: keep one definition of `PROJECT_REALMS`.
2. **Precedence:** check, then the Realm screen's pending quest, then a tapped chip, then typed text. So a chip wins over typed text (the text is dropped, nothing is created), and a pending quest wins over everything.
3. **One field for the whole sheet**, not per project. Per-project "no field" means: typed text is ignored when the tapped project has no realm, silently (no dimming or message, to keep "nothing is shown about it"). The field is hidden when no listed project has a placed realm and a timed habit, unless a Realm-screen quest is pending.
4. **A project whose habits are all checks** gets no chips (nothing to start) and typed text does nothing for it.
5. **Gates for the new UI:** flag, sheet open, journey started (`useQuestStarted`), quest tables `available`. The realm lookup is project-aware (`liveWorld(items, projects)`) only once sync has settled, per HANDOFF_P2; before that it is project-blind, which is harmless here because only active projects are listed.
6. **Legacy hand-claimed realms** (no `projectId`, attach not done) give no chips and no field: `realmOfProject` finds no realm for any project. That is the attach session's job, not this one's.
7. **Realm screen path is not scoped to the quest's project.** A pending quest still binds to whichever habit is tapped, even another project's habit (the existing behaviour; P1 §9 says the Realm Start should be scoped to its project, which needs the Realm screen, out of bounds here).
8. **Text is cleared** when the sheet closes (close button, swipe, back) or a start happens. It survives only while the sheet is open.
9. **The binding stores `at`** and a 16 h cap (`SESSION_MAX_SEC`), which guards against a stale copy matching a later timer on the same habit after the old one was stopped elsewhere. A timer paused for longer than that and resumed becomes a free session.
10. **A typed objective that creates a quest stays when the session ends short or is discarded** (the mob remains in the realm, open, and shows as a chip next time). Nothing is deleted on a short session.
11. **Chip order:** quest chips go after the habit chips in the card; the target icon tells them apart. Title is truncated at 150 px.
12. **Keyboard:** no change to the shared `Sheet`. It already pads for the keyboard on iOS and lets a tap through while the keyboard is up (`keyboardShouldPersistTaps="handled"`). The field is one line at the top, so the first project's card and chips sit within the first screenful, and the Done key closes the keyboard. Not verified on a small iPhone: it is the first §18 item to check. If the sheet clips, the next step is a `keyboardDismissMode="on-drag"` prop on `Sheet`.
13. **`useWorldWrites()` is always called in `StartSheet`** (hooks can't be conditional): one ref and one effect on data change, with the flag off too. `StartSheet` already re-renders on every data change.
14. **Sound:** the quest chips are `quiet` (no tap sound or haptic). The project card (`Press`) makes none, the field makes none, and the start itself plays the existing `session_start` cue like any timer start. The old habit chips are untouched and keep their tap sound.
15. **Placeholder "Objective"** (one word, like "Note" in the log sheet).

## For the next sessions

- **Session 3** (wiring): this branch does nothing visible until the reconcile creates project realms, so QA needs #3 merged. Once `Watchers` passes `projects`, this sheet already does the same. If `useQuestAfterStop` (blind `liveWorld(items)`) becomes project-aware, nothing here changes.
- **Attach session:** with an attached realm, chips and the field start working for that project with no change here.
- `QuestFocus` still calls `releaseTimerQuest()` for a habit with no bound quest. With persistence on it is harmless (see above) but it is the reason the restore has to be "adopt if untouched".
