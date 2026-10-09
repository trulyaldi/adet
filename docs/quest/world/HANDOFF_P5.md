# Handoff P5: Projects as Realms, naming a session

Branch `feat/project-realms-5-naming` (worktree `../adet-p5`), cut from `feat/project-realms-2-domain` (b12aff6). Not committed, no PR. No migration, no `supabase/`, no dependency.

Checks: `tsc` clean. Lint 0 errors / 81 warnings (same as the base). Tests 588/588 (576 before, plus 11 naming tests and 1 flag test; every earlier assertion untouched, including the `deepEqual(afterSession(...), { lootFor, target })` ones, which is the flag-off proof). Web run of the real `ResultSheet` + `NamingStep` in Playwright (temporary harness, reverted, nothing committed): chip then Done, text then Partly (the result carried the session id and landed on the picked/new quest), Skip, and backdrop tap left the items unchanged. **The harness called `afterSession` and `openResult` directly with `lootFor: null`, so this was not end to end:** the env var, the habit-to-project lookup, the settled gate in `useQuestAfterStop`, `handOffAfterStop` and the chest after Skip were never run (units cover the rules only). The `ResultHost` fallback was not run at all. **Not device-tested**; §18 of `DEVICE_QA.md` is the list.

## Where the prompt and the code disagree (read first)

- **"The chest still opens first, then the result flow, in today's order."** Today's order is the reverse: `handOffAfterStop` asks the result first and the chest opens from `closeResult` after it (`result.ts`, `loot.ts`; the existing `result.test.ts` pins it). I kept the code's order for named sessions too, because "today's order" and "flag off unchanged" both point at the code. If you want the chest first for named sessions only, it is a change in `handOffAfterStop`'s `ask` path (`loot.ts`, not touched).

## What changed

- `src/domain/world/target.ts`: `afterSession(saved, questId, world, editAfter, projectId?)` returns `{ lootFor, target, naming? }`. New types `NamingStep { realm, quests }` and `AfterSession`. `openQuestsOf` supplies the chips.
- `src/screens/Quest/session/NamingStep.tsx` (new, plain RN, no Skia): the step, and `useNamedTarget(req, world)`, which both sheets use.
- `ResultSheet.tsx`: one Modal, two steps. `ResultHost.tsx`: the plain fallback does the same (it must not import Skia: `startup.test.ts` caught it once).
- `game/state/result.ts`: `ResultRequest.target` is nullable and gains `naming?`. `game/state/useQuestAfterStop.ts`: passes the session's project and (flag on, sync settled) the projects.
- `game/enabled.ts`: `PROJECT_REALMS` (see Merge risk). `src/domain/world/namingStep.test.ts` (new), `game/enabled.test.ts`.

## The naming rule (pure, `afterSession`)

Offered when all hold: `projectId` was passed (the caller passes it only with the flag on), `questId` is null, `saved.duration / 60 >= MIN_SESSION_MIN`, `editAfter` is false, and a **placed** realm of that project exists (`world.realms`, so a resting realm and a project with no realm get none). `target` is null whenever `naming` is set; `naming` is absent (not null) otherwise, so old shapes compare equal.

## Decisions not in the prompt

1. **`questId === null`, not `target === null`.** A session whose bound quest was since deleted or cleared stays a free session with no naming step (DEVICE_QA §17's last item still holds).
2. **The threshold is the chest's** (`>= MIN_SESSION_MIN`, inclusive). A session under it is never named, though a session with a quest is still asked its result at any length, as today.
3. **Flag handling:** the pure function never reads the flag. `useQuestAfterStop` passes no project when the flag is off.
4. **Placed realms only.** Needs the caller to pass `projects` for an archived project's realm to read as resting. The hook does so once `useSyncStatus().settled`; before that it passes none (the project is then taken as live).
5. **Empty realm:** still offered (no chips, the field and Skip), because typing is the only way in.
6. **Chips:** `openQuestsOf`'s quests, oldest first, the title only. A boss shows as its next uncleared phase (the phase's own title, no boss name). A phase title alone may read oddly; kept for minimal wording. The row scrolls past 132 pt.
7. **Wording:** the realm's name, "What was it for?", placeholder "Something new", buttons "Add" and "Skip". The field is capped at `QUEST_TITLE_MAX` (80); the ops trim and reject blanks.
8. **No autofocus.** The keyboard opens only on a tap, so the chips are the quiet default.
9. **Skip, swipe down, backdrop tap, Back** in the naming step all do the same: close, record nothing, add nothing (typed text that was never added is dropped). The chest then opens as usual.
10. **After a pick or an Add, the normal rules apply:** swiping away before answering records Not yet on that quest (as the result sheet does today). Not yet is no penalty.
11. **A failed Add** (`addQuest` returned null: tables not ready, realm gone) behaves as Skip.
12. **The target is frozen once.** It is set the first render in which the picked or new quest shows in the world, and then kept, so a Done (which clears the quest) cannot pull the Stage out mid-swing. Set during render, not in an effect (the lint rule for effects forbids it).
13. **Chips are a snapshot taken at stop time**: a quest added elsewhere afterwards is not listed. A chip whose quest has gone (cleared or deleted on another device) does nothing when tapped, and the other chips still work. **One choice per sheet** (a latch), so a double tap cannot make two quests or pick twice.
14. **`KeyboardAvoidingView` is always in the tree** of `ResultSheet` and the fallback (it was not there), but `enabled` only while the naming step shows, so every sheet that has a target (all of flag off) gets the same layout as before, one inert wrapper view aside.
15. **The result sheet and the Skia gate:** the naming step lives inside `ResultSheet`, which loads lazily, so it appears when the sheet does (as the result step does today).
16. **The existing Mark done on the Realm and the Start-from-Realm path are untouched.** A session started from a realm has a quest, so it never gets a naming step.
17. **Flag name and shape:** `EXPO_PUBLIC_PROJECT_REALMS`, default off, counts only with `QUEST_ENABLED`. True-like values: 1, true, on, yes.
18. **Tests live in a new file** (`namingStep.test.ts`) rather than `target.test.ts`, to stay out of anyone's way.

## Merge risk (files outside my list that other sessions may also touch)

- `src/game/enabled.ts` and `enabled.test.ts`: **HANDOFF_P2 assigned `PROJECT_REALMS` to Session 3**; Session 4 reported the same overlap. Mine is the same name. Keep whichever lands first and drop the other (the export should be `PROJECT_REALMS`).
- `src/game/state/useQuestAfterStop.ts`: HANDOFF_P2 gave Session 3 the `liveWorld(items, projects)` line here. Mine does the same with the flag and settled gates; reconcile by keeping one `liveWorld` call and my `projectId`/`afterSession` lines.
- `src/game/state/result.ts` (type only) and `ResultHost.tsx` (fallback): no known overlap.
- I did not touch StartSheet, timerQuest, QuestScreen, overworld/*, the rest of `domain/world/*`, or `supabase/`.

## Open questions

1. Chest before the result for named sessions (see the top)?
2. Should a boss chip show its boss's name too?
3. Should an Add that creates a quest also offer a way to remove it, if it was a mistake? Today it lives on the Realm like any quest (softDelete from its sheet).
