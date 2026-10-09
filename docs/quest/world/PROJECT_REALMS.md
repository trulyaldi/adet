# Projects as Realms: the rules (Session P1)

Design only. Per-consumer detail is in `PROJECT_REALMS_AUDIT.md`. Calm rules still hold: no guilt UI, nothing expires, enemies never heal. Every decision below that you did not specify is also listed in `HANDOFF_P1.md`.

**One sentence:** a project owns exactly one realm for as long as it lives; the realm keeps its quests and results through archive, restore and delete, and only its place on the map comes and goes.

## 1. Contract

- A **realm is a project**, one to one. The realm item carries `props.projectId`. The project is the source of the realm's **name** and **icon**.
- A realm has a **slot** (a biome, 0–6) only while it is placed. **Placed** means: its project is active and the realm holds a slot. The Overworld, the slot allocator, the ceremonies and the timer's target only see placed realms.
- The lowest free slot goes to a project when it gets its realm, behind `EXPO_PUBLIC_PROJECT_REALMS`.
- A project with no free slot has no realm. Its sessions stay free sessions. Nothing is shown about it.
- Existing hand-claimed realms are linked once by an attach choice. Nothing is deleted.
- `MAX_REALMS = 7` is unchanged. It now caps placed realms, never projects (there is no project cap).

## 2. Storage: no migration, one code change

- `items` already stores `realm`, `quest` and `result` rows with references in `props`. `projectId` is a new key in the existing jsonb. **Nothing in `supabase/` changes.**
- `parseProps('realm')` is a whitelist and would strip `projectId`. `RealmProps` and that parser case must learn `projectId?: string` and `manual?: boolean` first. Anything running without that change rewrites the realm without `projectId` (`renameRealm` spreads the parsed item). Mitigation: a project-derived realm's **id encodes the project**, so `projectIdOf(item) = props.projectId ?? (id starts with 'realm:p:' ? the rest : null)`. Only an attached legacy realm has no second copy.
- `props.slot` may be absent or `-1` for an unplaced realm. `worldOf` must keep such a realm in `realms` (it drops it today).

Realm props after this work: `{ slot?, icon, projectId?, manual? }`. `title` stays the realm's stored name (see "Name and icon").

## 3. The id decision: derive the realm id from the project id

The problem: today the id is `realm:<slot>`. A slot is a place on the map, not an identity. Once slots can free up, reusing one reuses the id. The concrete failures, all verified in the code:

1. `claimSlot` writes `items.filter(i => i.id !== realm.id)` then appends. A new project on a reused slot **replaces the old realm item**, and every quest with `realmId: 'realm:2'` instantly belongs to the new project. Archived progress is silently handed over.
2. Two devices that each pick "the lowest free slot" for different projects write the **same id**. Last-write-wins keeps one project's realm and its quests now point at the other project.
3. Ceremony marks (`marks.realms`, once per id) and the flag memory key on the realm id. A new project in a reused slot would never get its "Conquered" moment, and an old one could replay.
4. Restoring a project onto a different slot would need every quest's `realmId` rewritten.

| | Keep `realm:<slot>` | Derive from the project id |
|---|---|---|
| Archived progress survives a slot being reused | No (1) | Yes, ids never collide |
| Two offline devices allocating | Corrupts (2) | Harmless: same project, same id |
| Slot moves (restore, bump) | Quest rewrite (4) | One prop changes, quests untouched |
| Ceremony marks and flags | Wrong after reuse (3) | Stable for the project's life |
| Cost | none | New id scheme; legacy realms keep their id |

**Decision: derive it.** New project realms get `realm:p:<projectId>` (`realmIdForProject`). The `p:` prefix can never parse as a slot number, so the two schemes cannot collide. **Legacy `realm:<slot>` realms keep their id forever**, because changing it is failure 4. An attached legacy realm keeps `realm:<slot>` and gains `projectId`. `realmIdFor(slot)` stays for those and for the flag-off path.

Consequence worth stating: **quests and results never change.** `quest.props.realmId` and `result.props.questId` stay as they are through every lifecycle event below.

## 4. Exists vs placed

This is the rule that keeps progress. Two different questions, two different answers:

- **Exists** (the derived `World.realms`): every realm item, placed or not, linked to a live project or not. **This is not behind the flag:** `worldOf` keeping realms that have no slot ships unconditionally, so that with the flag off an archived project's realm (slot cleared) cannot drop out and take its quests and credits with it. `liveQuests`, `isCleared`, `heartsOf`, `clearedAt` and **`worldCredits` read this**. Trophies in the Scribe read this. Archiving or deleting a project therefore does not change credits or trophies. (`liveQuests` drops a quest whose realm is not in the list, so if resting realms were removed from `realms`, earned credits would vanish.)
- **Placed**: the realm holds a slot that no other placed realm holds, **and** either it has a linked project that is active (not archived, not missing), or it has no linked project at all (a manual realm, or a legacy realm whose attach is still unanswered; see §7). A realm with no `projectId` is never resting: rest is a project event. **`slotsView`, `realmView`, `availableSlots`, `nextClaimable`, `currentSlot`, `targetOf`, `worldMoments` and the quest "+" read this.**

A realm whose project is archived or deleted is **resting**. A resting realm:
- is not on the Overworld, and its slot counts as free;
- cannot be targeted, so a session that ends against it is a free session (no damage, no result sheet);
- never fires a ceremony;
- keeps every quest and result, unchanged and unread.

Slot ties are resolved among **placed candidates only**, never among all realms. A candidate's rank is its project's `started ?? 0` (the seed project has `started: null`), then project id; a realm with no linked project ranks by its own `createdAt` instead. Lower rank keeps the slot, and the other becomes unplaced (a project realm then takes the next free slot; a manual realm stays unplaced until a slot is free, with its quests intact).

A project counts as **missing** only once sync has settled, because `PULL_ORDER` delivers items before projects (a fresh device would otherwise show every realm as resting for a few seconds).

## 5. Where realms come from: one reconcile

A project can come into being by `saveProjectSheet`, by a sync pull from another device, by `seed` (`g1`), by a migration, or on a build where the flag or the quest tables were off. A hook in `saveProjectSheet` would miss all but one. So there is **one idempotent reconcile**, a pure function (`items`, `projects`, `now` → the next `items`) driven by a single effect mounted app-wide (`Watchers`), which is the only writer of realm placement. Project actions are not touched; with the flag off the code path does not exist.

It runs only when **all** hold: `PROJECT_REALMS` and `QUEST_ENABLED` on; `questTablesReady()`; the journey has started (`quest_meta` exists, so a user who never opened Quest Mode gets no quest rows); sync has settled; and the attach sheet (§7) has nothing to ask. In order:

The steps apply only to realms that have a `projectId` (or a project-derived id), except step 2, which also ranks manual realms. A realm with no `projectId` is never touched by 1, 4 or 5.

1. **Rest:** a realm whose project is archived or missing and whose slot is set → clear its slot (frees it). Nothing else about it changes.
2. **Resolve ties:** two placed realms on one slot → the loser's slot is cleared.
3. **Create:** an active project with no realm → create `realm:p:<projectId>` with `props { projectId, icon, slot }`, `title` = the project name. `slot` is the lowest free slot, or absent when none is free.
4. **Place:** an active project whose realm has no slot, in order of project `started ?? 0` then id → the lowest free slot, if any. (A restored project's old slot is not remembered; it gets the lowest free one. See open question 4 in `HANDOFF_P1.md`.)
5. **Mirror:** for a realm the reconcile created (id `realm:p:…`), refresh `title` and `icon` from the project when they differ (the snapshot, §6). Not for an attached legacy realm.

Order of allocation when several need a slot: oldest project first (`started ?? 0`, then id), so two devices running the reconcile agree. Where two devices still write different slots, step 2 settles it on the next run and no data is lost: ids are equal for the same project, so two writes are one realm.

Creation happens within a render of the project being saved. "Assigned when a project is created" holds in effect, and it also covers the projects the creation hook would miss.

## 6. Name and icon

- Name shown = the project's name, clamped to `REALM_NAME_MAX` (32) with an ellipsis. The project sheet has no limit, so the clamp is required at display time.
- Icon shown = `project.icon ?? projectLook(project).icon`.
- **Snapshot:** for a realm the reconcile created, it also writes the name and icon into the realm item (`title`, `props.icon`). The project stays the truth. **It never overwrites an attached legacy realm**: that realm keeps the name and icon its owner gave it (display comes from the project anyway), so nothing is lost and flag-off still shows the original. The snapshot is the only name available with the flag off, on older builds, and for a realm whose project was deleted (its trophies still read "in <name>").
- Renaming happens in the project. There is no realm rename for a project realm; long-press on one opens that project's edit sheet. A **manual** realm (attach choice "keep as it is", or flag off) keeps today's rename.

## 7. Existing realms: the attach choice

Applies to a realm with neither `projectId` nor `manual`: every realm hand-claimed before this work.

- Shown when the flag is on, the Overworld opens, sync has settled, such a realm exists **and at least one candidate project exists**. One sheet per realm, one at a time: its name and icon, a list of **active projects that have no realm**, and **Keep it as it is**. No "later", and no way to dismiss it into a skipped state: swiping the sheet away leaves the choice unanswered and the reconcile paused, so asking again next time is the only outcome. Implementers must not add a "later".
- **Link to project P:** set `props.projectId = P`. The realm keeps its id (`realm:<slot>`), slot, quests and results. Its name and icon from then on are **displayed** from P; its stored title and icon are left as they were (the snapshot step skips it, §6), so the attach changes exactly one prop and deletes or overwrites nothing.
- **Keep it as it is:** set `props.manual = true`. The realm stays a hand-claimed realm, with rename, forever. It is saved on the item, so it is asked once across all devices.
- Both answers are written to the realm item, so "once" is synced, not per device.
- **Sequencing:** the reconcile is paused exactly while the attach sheet has something to ask (an unanswered realm and a candidate project). Otherwise it could give a project an auto-created realm and then the user attaches an old one to it too. With no candidate projects there is nothing to ask and nothing for the reconcile to create, so nothing waits. A project created later raises the sheet again for any realm still unanswered. Candidates are only projects with no realm, so a project can never end up with two.
- A manual realm occupies its slot like any other, so with seven manual realms no project gets a realm. That is the user's choice and the Overworld says nothing about it.
- An archived project is never an attach candidate.

If two realms nevertheless end up linked to one project (an attach race), the older one by `createdAt` is the project's realm and the other rests (it exists and keeps its progress, it is not placed).

## 8. The lifecycle, one row per event

Realm items are **never deleted or soft-deleted by any project action**. Only `props.slot` and the snapshot change.

| Project event | Realm and quests | Why |
|---|---|---|
| **Create** | Reconcile creates `realm:p:<id>` on the lowest free slot. None free: no realm, free sessions. | One-to-one. Clouds on the map mean "no project here yet". |
| **Rename / new icon** | Name and icon follow at once (derived). Snapshot refreshed by the reconcile. No quest changes. | Project is the source. |
| **Archive** | Realm rests: leaves the Overworld, slot freed (cleared by reconcile step 1, hidden at once by derivation). Quests, results, hearts, credits, trophies untouched. A timer on it ends as a free session. | Progress is data, a slot is a place. Archive is how people retire projects, and it must not permanently use up one of seven places. |
| **Restore** | Project is active, so the realm is eligible. It gets the lowest free slot (step 4), which may be a different biome from before. No free slot: the realm waits, placed the moment one frees, oldest project first. Hearts and cleared quests are exactly as they were: enemies never healed while it rested. | Ids never changed, so nothing to rewrite. A restore never evicts a project that is on the map. |
| **Delete** (here or on another device) | The realm rests permanently with its **snapshot name**. Quests, results, credits and trophies stay. Not an attach candidate, never revived automatically. | The delete dialog promises that the project's *habits and history* go. It says nothing about quests, and quest progress is the one thing the user cannot rebuild. The rows are small. Losing credits earned by clearing quests because a project was deleted would be silent loss. |
| **Seven realms are placed, an eighth project exists** | The eighth has no realm. When a slot frees (archive or delete of another), the reconcile gives it to the oldest project without one. | Simple, deterministic, and no one is asked anything. |
| **Project not yet pulled** (fresh device) | Nothing rests and nothing is written until sync settles. | Items arrive before projects. |
| **Flag turned off afterwards** | Project realms show as ordinary realms with their snapshot names and keep working. No data change. | The snapshot and a real slot make them valid hand-claimed realms for any build. |

## 9. Sessions

- A session belongs to a project through its habit. Only a session **started from a realm** targets a quest, as today (a binding in memory from Realm Start). A session started from Today or anywhere else is a free session, whether or not the project has a realm.
- **Start from a project realm** opens the start sheet for that project only: its habits, or starts directly when it has exactly one timed habit. A habit of another project is never bound to this realm's quest. Manual realms stay unscoped, as today.
- A project with no timed habit: Start is hidden on its quests. Mark done stays. No message.
- A project with no realm (the eighth): no Realm, no quests, free sessions only. Its sessions, streaks and stats are untouched.
- Archiving mid-session saves the session and clears the timer without the normal stop flow, so the quest binding is not released. Harmless because the realm is resting (target = none, free session).

## 10. The flag

`EXPO_PUBLIC_PROJECT_REALMS`, read in `src/game/enabled.ts` in the same static `process.env` style as `QUEST_ENABLED`. **Default off.** It counts only when `QUEST_ENABLED` is on. Off: manual claiming, `ClaimSheet`, `realm:<slot>` and every screen behave exactly as today, and no reconcile runs. On: manual claiming is replaced by projects (a clouded slot's "+" opens the new-project sheet), the reconcile runs, and the attach choice appears.

## 11. Calm rules, checked

- **No guilt UI:** nothing tells the user a project lacks a realm, a realm is resting, or slots are full. No counters, no warnings, no red.
- **Nothing expires:** a resting realm waits indefinitely; an archive does not age or decay it.
- **Enemies never heal:** hearts derive from result rows, and no project event writes or removes a result. Restoring a project cannot change a heart. Only the existing 6-second undo gives one back.
- **Credits and chests:** unchanged for everything already earned; the credit derivation keeps resting realms.

## 12. Tests the implementing sessions must add

Reconcile: creates the lowest free slot; is idempotent (a second run changes nothing); two devices' writes converge; the eighth project gets none; archive frees a slot and a new project takes it **without touching the archived realm's quests**; restore with the slot taken gets another; delete keeps quests, results and credits; no run before sync settles; no run before the journey starts. Plus `projectId` surviving `parseProps` and a row round trip, name clamping, `targetOf` null for a resting realm, `worldMoments` excluding one, and a flag-off test that nothing changes.
