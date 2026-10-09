# Projects as Realms: audit (Session P1)

Audit only. No app code changed. Read at `feat/world-6-polish` (PR #35). The rules this audit feeds are in `PROJECT_REALMS.md`.

Flag used below: **flag on** means `EXPO_PUBLIC_PROJECT_REALMS` on (and `EXPO_PUBLIC_QUEST_ENABLED` on). **Flag off** must behave exactly as today.

## 1. Storage: no SQL migration, but one code change is required

Confirmed from `supabase/migrations/006_quest.sql`, `src/sync/questRows.ts` and `src/domain/items/types.ts`:

- `items.props` is `jsonb not null default '{}'`. `items.type` has no CHECK. RLS is per `user_id`. Nothing in `supabase/` needs to change.
- A realm's references already live in props: `quest.props.realmId` points at the realm, `result.props.questId` points at the quest. Adding `realm.props.projectId` is a new key inside an existing jsonb column. **No migration. Not stopping.**
- **The parser is a whitelist, so this is a code change, not zero code.** `parseProps('realm')` returns only `{ slot, icon }` (`items/types.ts:315`), and `parseItem` runs on every pull and every load. Until `RealmProps` and that case learn `projectId`, the key is stripped on every parse.
- **Old builds will strip it.** `itemToRow` writes the whole `props` object (`questRows.ts:11`), and `worldOps.renameRealm` rewrites `{ ...i, title }` from the parsed item. A build without the parser change that renames a realm pushes it back without `projectId`, and the server copy loses the link. Consequences are bounded by design (see `PROJECT_REALMS.md`, "Storage"): a project-derived realm's id encodes its project, so it heals. Only an attached legacy realm keeps its link nowhere else.
- The same applies to a quest: `QuestItemProps` stays `{ realmId, parentQuestId? }`. Quests need no `projectId`, because the realm id is stable (see the id decision).

## 2. Today's project model (item 3)

Source: `src/domain/types.ts`, `src/domain/projects.ts`, `src/store/StreakStore.tsx`, `src/overlays/ProjectSheet.tsx`, `src/screens/ProjectsScreen.tsx`, `src/domain/sync.ts`, `src/sync/rows.ts`.

`Project = { id, name, weeklyTarget, started?, archivedAt?, updatedAt?, color?, icon?: IconKey, scene? }`. `Habit.projectId` points at it. A session belongs to a habit, so a session's project is `habit.projectId`. `IconKey` is the same type realms use (`PROJECT_ICONS` already drives the ClaimSheet's icon row). `icon` is optional; `projectLook(p).icon` gives the default (`'target'`).

| Event | Where | What happens |
|---|---|---|
| **Create** | `openNewProject` → `ProjectSheet` → `saveProjectSheet` (`StreakStore.tsx:885`). Entry points: Projects "+", Today (`TodayScreen.tsx:89`), StartSheet's empty state. | Appends `{ id: 'g' + Date.now(), name, weeklyTarget, started: Date.now(), color, icon, scene }`. Name is trimmed and required. **No max length** on the input. The seed project is `g1`. Migrations and sync pulls also introduce projects without going through this action. |
| **Rename / restyle** | `openEditProject` → same sheet → `saveProjectSheet` | Maps the project with new name, target, color, icon, scene. Same id. |
| **Archive** | `ProjectSheet` archive button → `archiveProject` (`:941`) | Sets `archivedAt = now`. A running timer on one of its habits is saved through `sessionFromTimer` and cleared (this is not the normal stop flow: `useQuestAfterStop` does not run, so no result is asked and the timer-quest binding is not released). Archived projects leave Today, Projects, pace and targets (`activeProjects`, `activeHabits`); history still counts in Stats. |
| **Restore** | Projects "Archived" section → `unarchiveProject` (`:966`) | Sets `archivedAt = null`. Nothing else. |
| **Delete** | `ProjectSheet` → confirm "Its habits and all their history are removed." → `deleteProject` (`:919`) | Removes the project, its habits, their sessions and marks, and clears the active timer if it was theirs. Synced as a server soft delete (`deleted_at`) per record (`domain/sync.ts:108`). There is no undo and no restore. The same delete also arrives on another device through a pull. |
| **Cap** | none | Grep finds no cap: no `MAX_PROJECTS`, no `projects.length` guard. `nextProjectColor` and `nextScene` cycle. The only seven in the system is `MAX_REALMS`. |

Sync order matters: `PULL_ORDER` is `links, items, sessions, …, habits, projects` (`rows.ts:16`). On a fresh device, **realms (items) arrive before their projects**. Anything that treats "project missing" as meaningful must wait for sync to settle (`useSyncStatus().settled`, already used by the flag memory in `QuestScreen`).

## 3. Consumers of the claim path and the project/habit models

"Change" is what must change for project realms (flag on). Anything not listed under "Change" stays as is.

### Domain (pure)

| File | Reads / writes | Change |
|---|---|---|
| `src/domain/items/types.ts` | `RealmProps { slot, icon }`; `parseProps('realm')` whitelist; header table | Add `projectId?: string` and `manual?: boolean` to `RealmProps`; keep them in `parseProps`. Allow a missing slot (`null`). Update the header comment. Required before anything else: it is the parser change from §1. |
| `src/domain/world/types.ts` | `Realm {id, slot, name, icon}`; `realmIdFor(slot)` = `realm:<slot>`; `isSlot`; `worldOf` drops a realm with no valid slot, and drops the later of two realms that share a slot | `Realm` gains `projectId: string \| null` and `slot: number \| null`. Add `realmIdForProject(projectId)` = `realm:p:<projectId>` and `projectIdOf(item)`. `realmIdFor(slot)` stays for legacy ids. **`worldOf` must stop dropping**: a realm without a slot, or one that loses a slot tie, must stay in `realms`, or its quests drop out of `liveQuests` (see rules/select/target below). |
| `src/domain/world/ops.ts` | `claimSlot` (id `realm:<slot>`, replaces any item with that id), `renameRealm` (`{...i, title}`), `addQuest` (needs the realm to exist), `addPhase`, `recordResult`, `softDeleteQuest` | `claimSlot` stays for the flag-off path and manual realms. `claimSlot` must never replace an item with the same id when flag on (it is the reuse bug). New pure ops: create a project realm, attach a legacy realm, place/unplace, mirror the name/icon snapshot, and the reconcile as one pure function (QuestSlice + projects → QuestSlice). `renameRealm` stays for manual realms only. `addQuest` must reject a realm that is not placed (flag on). |
| `src/domain/world/rules.ts` | `availableSlots(realms)`, `liveQuests` (drops quests whose realm is missing), `isRealmConquered`, `worldCredits` | `availableSlots` must count only **placed** realms. `liveQuests`, `isCleared`, `heartsOf`, `worldCredits` keep seeing **all** realms, including resting ones, so earned credits and trophies survive (rules doc, "Exists vs placed"). Add a `placedRealms` rule. |
| `src/domain/world/select.ts` | `liveWorld(items)`, `slotsView`, `realmView`, `questById` | All need the project list (`slotsView(items, projects)`, …). `slotsView` and `realmView` show only placed realms. `questById` stays total (a sheet may open a quest in a resting realm only through the Scribe, which has no sheet: no change in behaviour). Name and icon come from the project (clamped to `REALM_NAME_MAX`), with the snapshot as fallback. |
| `src/domain/world/target.ts` | `targetOf` (finds the realm), `afterSession`, `worldMoments` (realms conquered), `effectOf`, `stageReactionOf` | `targetOf` returns null for a resting realm, so its session is free. `worldMoments` lists only placed realms, so a restore never replays a ceremony. `afterSession`, `effectOf`, `stageReactionOf` unchanged. |
| `src/domain/game/ceremonies.ts`, `src/game/ceremonies/marks.ts` | `marks.realms: string[]` of realm ids, once per id | No change. With ids derived from the project id these marks are stable for a project's life. With `realm:<slot>` they would not be (the reuse problem). |
| `src/domain/game/derive.ts:243` | `worldFrom = min(JOURNEY_HIDDEN_AT, …realms.map(createdAt))` from raw items | No change. `JOURNEY_HIDDEN_AT` (2026-10-02) is already earlier than any new realm, so project realms never move it. It reads raw items, so resting realms are unaffected. |
| `src/domain/game/balance.ts` | `MAX_REALMS = 7` | Unchanged. Now caps *placed* realms, not projects. |
| `src/domain/projects.ts`, `look.ts` | `isArchived`, `activeProjects`, `projectLook` | Reused: dormancy is `isArchived(project)` or a missing project; the icon is `projectLook(p).icon`. |
| `src/domain/sync.ts` | Outbox: projects and items are separate tables | No change. An atomic project + realm write is two rows pushed in `PUSH_ORDER` (`projects` before `items`), which is already the order. |

### Data layer and store

| File | Reads / writes | Change |
|---|---|---|
| `src/data/worldRepo.ts` | `useWorldWrites` (`claimSlot`, `renameRealm`, `addQuest`, …), `useSlots`, `useRealmView`, `useWorldQuest`, `useSessionTarget`; all read `useData().items` | Each read hook also needs `useData().projects` (memo dependency). New writes: `attachRealm(realmId, projectId \| null)` (null = keep as it is) and a reconcile hook. `claimSlot` / `renameRealm` stay, used only for manual realms. Writes still wait for `questTablesReady()`. Reconcile additionally waits for quest started, sync settled and the flag. |
| `src/store/StreakStore.tsx` | `saveProjectSheet`, `archiveProject`, `unarchiveProject`, `deleteProject`, `editQuest` (one `setData` over items + links) | **No change recommended.** The reconcile (rules doc) is the single writer of realm placement, so the four project actions stay as they are and flag-off is untouched. The reason is in the rules doc: creation by pull, seed, migration and old builds cannot go through `saveProjectSheet`. |
| `src/store/Watchers.tsx` | App-wide effects (`useSyncStatus`, `useReady`) | The mount point for the reconcile effect (it needs to run off the Quest tab, so a project created on Today gets its realm without the tab being open). |
| `src/game/enabled.ts` | `QUEST_ENABLED` / `questEnabledFrom` | Add `PROJECT_REALMS` the same way (static `process.env.EXPO_PUBLIC_PROJECT_REALMS`), **default off**, and only on when `QUEST_ENABLED` is on too. Add the line to `.env.example`. |
| `src/game/state/local.ts` | `QuestLocal.slot` (device-local hero slot, per account) | No change. `currentSlot()` already falls back when the stored slot has no realm, which covers a realm that went resting. |
| `src/sync/rows.ts`, `questRows.ts`, `questTables.ts` | Row mappers | No change (jsonb passes through). `questTablesReady()` gates the reconcile. |

### Screens and session flow

| File | Reads / writes | Change |
|---|---|---|
| `screens/Quest/overworld/ClaimSheet.tsx` | Name + icon sheet; `rename` mode (name only) | Flag on: not used to claim. Used only to rename a **manual** realm. A project realm is renamed in the project. |
| `screens/Quest/QuestScreen.tsx` | `useSlots`, `useRealmView`, `claimSlot` / `renameRealm` through `ClaimSheet.onDone`, `setLift(slot)`, `openRealm(slot)`, `addQuest`, `setTimerQuest` + `openStartSheet` (`:271`, `:407`, `:446`) | Flag on: `onClaim` of a clouded slot opens the **new project** sheet instead of ClaimSheet; the cloud-lift moment now plays when the reconcile places a new realm while the map is on screen (hook `lift` to "a realm appeared on a slot", not to the claim button); `onRename` of a project realm opens that project's edit sheet; the attach sheet mounts here. Start passes the realm's project to the start sheet (below). The `addQuest` input is unchanged: it already takes `realm.id`, and with a placed-only `view` it cannot target a resting realm. |
| `overworld/Overworld.tsx`, `OverworldMap.tsx` | Draws `slots[]`: `r.name`, `r.icon`, "+" on `nextClaimable`, long-press rename, a11y labels (`Overworld.tsx:233`) | Names must be clamped to 32 characters (project names have no limit). A11y label of a clouded slot changes from "claim it" to "no project here yet". Everything else reads `SlotView` and is unchanged. |
| `overworld/overworldModel.ts` | `nextClaimable`, `currentSlot` over `SlotView[]` | Unchanged: both already treat "no realm" as clouded, which is the right meaning for a free slot. |
| `overworld/flagMemory.ts`, `transitionModel.ts`, `CloudCurtain.tsx`, `useRealmTransition.ts` | Realm id (flags, in memory) or slot (transition) | No change. Flag memory keyed by realm id is exactly why the id must outlive a slot (see the id decision). |
| `realm/RealmMap.tsx`, `realmModel.ts` (`stageTargetOf` uses `realm.slot`) | Biome from `realm.slot` | `realm.slot` becomes nullable in the type; both only ever see placed realms. Guard with a non-null at the boundary. |
| `realm/QuestNodeSheet.tsx` | Start / Mark done / add phase | No change. The "addQuest" text field lives in `QuestScreen` (`:271`), covered above. |
| `src/overlays/StartSheet.tsx` | `activeProjects(data)`; `start(habitId)` → `bindTimerQuest(habitId)` + `startTimer`; `close` → `dropTimerQuest` | Today any habit of any project binds to any quest. Flag on, for a project realm: show only that project's habits, start directly when it has one timed habit, and refuse to bind a habit whose `projectId` differs from the realm's. Manual realms stay unscoped. |
| `src/game/state/timerQuest.ts` | In-memory `pending` / `bound` quest id by habit id | `setTimerQuest` / `bindTimerQuest` need the realm's project to validate (or the check lives in StartSheet). No storage change. |
| `src/game/state/useQuestAfterStop.ts`, `screens/Quest/session/ResultHost.tsx`, `ResultSheet.tsx`, `QuestFocus.tsx`, `TimerStage.tsx` | `boundQuest(habitId)` → `afterSession` → `targetOf` → result sheet; stage sprite uses `target.realm.slot` | No change beyond `targetOf` returning null for a resting realm (a session ending after an archive is then free). Note the existing edge: `archiveProject` bypasses `useQuestAfterStop`, so the binding is not released; a resting realm already makes it harmless. |
| `src/game/ceremonies/host.tsx` | `worldMoments(liveWorld(data.items))` | Pass `projects`; moments list only placed realms. |
| `screens/Quest/sheets/ScribeSheet.tsx:110` | Trophies: cleared top-level quests with the realm's name | Must read resting realms too (it uses `liveWorld`, which will keep them). A deleted project's realm name comes from the snapshot. |
| `screens/Quest/Hud.tsx`, `model.ts`, `useQuestModel.ts` | Credits (`worldCredits` through `deriveGameState`) | No change, provided `liveWorld` keeps resting realms. |
| `src/overlays/ProjectSheet.tsx`, `src/screens/ProjectsScreen.tsx` | Project create, edit, archive, delete UI | No change needed. Optional later: a quiet glyph on a project card that has a realm. Delete's confirm copy says history is removed; quest progress is not removed (see rules). Do not add a warning. |

### Checked and unaffected

Today, Stats, `planner`, `capacity`, `engine`, `weekView`, `recap`, `milestones`, `WelcomeFlow` (reads `activeProjects`, creates none), `mergeHabit`, `deleteHabit` (a habit change never affects a project realm, since realms point at projects). `seed.ts` creates project `g1`: it gets a realm through the reconcile like any other project.

## 4. Tests that will move

`src/domain/world/world.test.ts` (claim / availableSlots / duplicate-slot rules), `src/domain/world/target.test.ts` (`targetOf` for a resting realm), `src/screens/Quest/overworld/overworldModel.test.ts` and `realm/realmModel.test.ts` (nullable slot), `src/domain/items/ops.test.ts` or a parse test (`projectId` survives `parseProps`), plus new tests for the reconcile (see the rules doc). `src/sync/questRows.test.ts` should gain a `projectId` round trip.
