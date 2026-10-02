# Session 1 audit: weak points and everything that reads or writes them

This audit was done by grep (`weak point`, `weakPoint`, `weak_point`, `seal`, `stagger`, `crit`, `task`, `completed_in`, `planned_for`, `Quest Board`) on `main` at dcb5459. A weak point is a `task` item; a session links to one through `planned_for` (picked) and `completed_in` (ticked at the chest).

## Writers

| Where | What it wrote | Now |
|---|---|---|
| `screens/Quest/session/WeakPointsRow.tsx`: the sword chip and picker in the timer header | local `plan` (task ids), `addTask` | deleted |
| `game/state/local.ts` (`pickWeakPoints`, `setActivePlan`, `planForSession`) | `plan` in `adet-quest-local-v1` | removed; an old `plan` key is ignored when parsed |
| `game/state/useQuestAfterStop.ts` | `planned_for` links on the saved session | removed |
| `screens/Quest/sheets/BoardSheet.tsx`: the Quest Board, reached from the camp prop and the screen-reader buttons | add, rename, reorder, done and delete tasks | deleted, with the camp prop, the `board` sheet id and its greeting |
| `screens/Quest/sheets/SageSheet.tsx`: "Pin" a suggestion | `addTask` / `reorderTasks` | the sheet shows only the insight line |
| `screens/Quest/session/LootSheet.tsx`: the tick list | `claimChest({ doneTaskIds })`, which set `completed_in` and marked tasks done | the tick list is gone; the chest opens with a line or an amount |
| `domain/items/ops.ts` | `addTask`, `renameTask`, `setTaskStatus`, `reorderTasks`, `deleteTask`, `planTasks`, `claimChest.doneTaskIds` | removed |
| `data/itemsRepo.ts` (`QuestWrites`) | wrappers for the above | removed |

## Readers (rules)

| Where | Rule | Now |
|---|---|---|
| `domain/game/derive.ts` | **crits:** +10 damage per completed weak point, at most 3 | removed |
| `derive.ts` | **XP:** +15 per completed weak point | removed |
| `derive.ts`, `balance.ts` | **boss seals:** Days and Depth, plus **Insight** (completed weak points, chronicle lines and quick logs); a boss at 0 HP without its seals was *staggered* | seals were gated by weak points, so all of them are removed: bosses fall at 0 HP |
| `derive.ts` (`activityRewards`) | +5 XP per weak point done outside a session (5 a day) | removed; quick logs keep their XP |
| `twists.ts`, `balance.ts` | **Desert:** ×1.5 with a completed weak point, ×0.75 without | removed; the desert deals plain time (`TEMP(world-2)`) |
| `domain/progress` (the Trail) | the "more weak points" reason and the weak-points row | removed |
| `game/ceremonies/index.ts` (boss report), `services/sage.ts`, `sageFallback.ts` | task counts in the recap; open tasks sent to the AI Sage; local suggestions | removed; the edge contract gets `taskCount: 0` and `openTasks: []` |
| `screens/Quest/sheets/ScribeSheet.tsx` | "N weak points done" for an entry with no text | removed (shows the text only) |
| `domain/game/whatIf.ts`, the QA panel | the `weakPoint` and `seals` overrides | removed |
| `domain/game/balanceSim.ts`, `scripts/balance-sim.ts` | `weakPointRate`, staggered days | removed |

## Seal and stagger presentation (it followed the rule)

| Where | What it showed | Now |
|---|---|---|
| `game/ui/SealPips.tsx` | the seal icons | deleted |
| `screens/Quest/map/BiomeLayer.tsx`, `JourneyMap.tsx` | seals over the gate, dazed stars | removed (the low-HP boss pose stays) |
| `screens/Quest/TapPanel.tsx`, `QuestScreen.tsx` | seal counts, "Staggered" in the boss panel | removed |
| `domain/game/stage.ts`, `screens/Quest/session/TimerStage.tsx` | the `stagger` scene and seal pips on the Stage | removed |

## Copy

- The onboarding line "tick a task, or write a line"
- Forest and desert lore lines about weak points
- The desert twist text
- `WORDS.task` ("Weak point")
- Assorted comments

## Data, untouched (dormant)

No column was dropped and no row was rewritten. Old rows still parse: `parseItem` keeps the `task` type, and links keep their kinds.

- `items` rows with `type = 'task'` (`props.status`, `order`, `doneAt`)
- `links` rows of kind `planned_for` and `completed_in`
- `adet-quest-local-v1.plan` (device-local)
- The Sage edge contract's `openTasks` / `taskCount` and its `suggestions` response
- The `crit` sound
