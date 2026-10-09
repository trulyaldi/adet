# Handoff P2: Projects as Realms, pure domain

Branch `feat/project-realms-2-domain`, cut from `origin/main` (7841912, #35 and #36 merged). Changed: `src/domain/world/{types,rules,ops,select,target}.ts`, `src/domain/items/types.ts`, new `src/domain/world/projectRealms.test.ts`. No store, screen, `supabase/`, dependency or item-type change. No migration. Nothing here is called by the app yet, except that `worldOf` now returns `resting` and `liveQuests` reads it (below).

Checks: `tsc` clean. Lint 0 errors / 81 warnings (same as main). Tests 576/576 (550 existing, untouched, plus 26 new). The new test file also type-checks (scratch tsconfig, like HANDOFF_1's note).

## Where this prompt and `PROJECT_REALMS.md` disagree (the doc won)

1. **`Realm.projectId` source.** Prompt: read `props.projectId`. Doc: the realm id `realm:p:<id>` encodes it too, so a stripped prop heals. Implemented as `projectIdOf(item) = props.projectId ?? id-suffix`.
2. **Racing for a slot.** Prompt: first claim wins. Doc: among project realms the **older project** (`started ?? 0`, then id) wins; a hand-claimed realm still ranks by its creation, so the old "first claim wins" test is unchanged. The loser rests with its quests (it is not dropped).
3. **`worldOf` dropping realms.** Doc: a tie loser or slotless realm must stay in the world. Existing tests require `worldOf(...).realms` to list only the winner. Both hold: `realms` is unchanged (placed only), and the others are in a new `resting` list.
4. **`Realm.slot` nullable (doc §2).** Not done: screens use `realm.slot` as a number and Session 2 may not touch them. Instead `slot` stays `number`, and `UNPLACED = -1` appears only on resting realms (`World.resting`). Placed ⇔ `slot >= 0` ⇔ in `World.realms`.
5. **"No slot free".** Prompt and doc §1/§8: no realm. Doc §5 step 3 says "or absent when none is free" (creates a slotless item). That sentence is a slip in the doc; I followed §1, §8 and the prompt: an eighth project gets **no item**, so no quest row is written for it. `PROJECT_REALMS.md` §5 step 3 should be corrected.
6. **Two stored values that could be computed** (the prompt says store nothing derivable). The doc decides both, so both are written:
   - `syncRealmLook` stores the project's name and icon in the realm item. Display is derived from the project; the snapshot is the only name the flag-off path, older builds and a deleted project's trophies have.
   - `reconcileRealms` stores `slot: -1` on a realm whose project is archived or missing. Derivation already hides it at once, but without a stored release a restore would tie with the project that took the slot meanwhile, and the older project would win and evict it (doc §5, §8).
7. **Archive/restore/delete** were not in the prompt's function list; the doc decides them through the reconcile, so `reconcileRealms` exists (it is what the tests for those cases call).

## Exported API (`src/domain/world`, re-exported by `index.ts`; ops under `worldOps`)

```ts
// types.ts
interface Realm { id; slot: number; name; icon: IconKey; projectId?: string; manual?: boolean }   // slot UNPLACED (-1) only in World.resting
const UNPLACED = -1; const PROJECT_REALM_PREFIX = 'realm:p:'
realmIdForProject(projectId: string): string                       // 'realm:p:<projectId>'
projectIdOf(r: { id; props: { projectId?: string } }): string | null // props, else the id; null for a hand-claimed realm
type ProjectRef = Pick<Project, 'id' | 'name' | 'icon' | 'started' | 'archivedAt'>
realmNameFrom(projectName: string): string                          // collapse spaces; >32 chars → 31 + '…'; '' if blank
projectsByAge<P extends { id; started? }>(projects: readonly P[]): P[]   // oldest first, started ?? 0, then id
interface WorldRecords { realms; resting; quests; results }
worldOf(items: readonly Item[], projects?: readonly ProjectRef[]): WorldRecords
// rules.ts
interface World { realms: Realm[]; resting?: Realm[]; quests; results }
realmOfProject(world, projectId: string): Realm | undefined         // placed or resting (check slot >= 0); undefined = no realm
projectsWithoutRealm(world, projectIds: readonly string[]): string[] // no realm at all, input order
unlinkedRealms(world): Realm[]                                      // placed, no projectId, not manual (attach unanswered)
attachPending(world, activeProjectIds: readonly string[]): boolean  // unlinkedRealms and a candidate project both exist
// select.ts (the new trailing param is optional: callers that don't pass it behave as before)
liveWorld(items, projects?): World & { resting: Realm[] }
slotsView(items, projects?): SlotView[]
realmView(items, realmId, projects?): RealmView | null
questById(items, questId, projects?)
// target.ts
openQuestsOf(world: World, realmId: string): Quest[]                // uncleared top-level quests oldest first; a boss is its next uncleared phase (parentQuestId = the boss); [] for a resting/unknown realm
// ops.ts (all QuestSlice → QuestSlice; unchanged slice = didn't apply)
claimSlotForProject(q, projectId, name, icon: string, now, projects?): QuestSlice
linkRealm(q, realmId, projectId): QuestSlice
keepRealm(q, realmId): QuestSlice                                   // attach answer "keep it as it is" (props.manual)
syncRealmLook(q, realmId, name, icon: string): QuestSlice           // snapshot title and props.icon from the project
reconcileRealms(q, projects: readonly ProjectRef[], now): QuestSlice
// items/types.ts
RealmProps { slot; icon; projectId?: string; manual?: boolean }     // parseProps keeps both
```

`claimSlot`, `renameRealm`, `ClaimSheet` work as before. One guard added: `claimSlot` never writes over a `realm:<slot>` item that is linked to a project (a resting attached realm keeps its quests).

## What the pure code does (so Session 3 can wire it, not rebuild it)

- **Placed vs resting** (`worldOf`): a realm is placed if its slot is valid, no better-ranked placed realm holds it, and (with `projects`) its project is active. Everything else rests, with `slot = UNPLACED`, and stays in `World.resting`. `liveQuests` counts resting realms, so credits (`worldCredits`, which `deriveGameState` calls through `liveWorld(items)`), trophies and hearts do not change when a project is archived or deleted. `targetOf` and `worldMoments` only see placed realms, so a resting realm gives free sessions and no ceremony.
- **Name and icon:** with `projects`, a linked realm's `name` is `realmNameFrom(project.name)` (stored title if blank) and `icon` is `projectLook(project).icon`. Without `projects`, stored values. An attached legacy realm keeps its own stored name and icon.
- **`reconcileRealms`:** pure and idempotent (a second run returns the same slice object). Waits (returns `q`) while `attachPending`. Steps: (1) a realm whose project is archived or missing gets `slot: -1`; (2–4) projects oldest first: no realm → `claimSlotForProject`; realm not placed (slot cleared, or lost a tie) → lowest free slot, or it waits; (5) a `realm:p:` realm follows the project's name and icon. Never deletes an item, never touches a quest or result, never touches a hand-claimed realm.
- **Writes on a resting realm:** `addQuest`, `addPhase`, `recordResult` and `markDone` are all rejected (the ops act on placed realms only, as they did for realms the old code dropped). `undoResult`, `renameQuest` and `softDeleteQuest` still work. So a result told after an archive is refused rather than kept; the session is free anyway (`targetOf` is null).
- **Caller's gates (not in the function):** flag on, `QUEST_ENABLED`, `questTablesReady()`, journey started, **sync settled**. With a partial project list a project not yet pulled reads as deleted and its realm is rested; do not call it earlier.

## Decisions not in the prompt or the doc

1. **`resting` list, not a nullable slot** (item 4 above).
2. **`liveWorld` returns `World & { resting }`**; `World.resting` stays optional so existing literals compile.
3. **A tie loser is re-slotted, not slot-cleared.** The reconcile gives it the lowest free slot or leaves its stored slot (it stays resting, and becomes placed again if the winner goes). Only archived/missing projects get `slot: -1`. A hand-claimed realm that loses a tie stays resting and is not moved.
4. **Extra realms for one project:** the first by `createdAt` owns it, any other rests and is left alone (kept slot, no write).
5. **Behaviour change with the flag off, anomalies only:** a legacy realm that lost a duplicate-slot tie or had an invalid slot used to be dropped, and its quests dropped with it. It now rests, and its quests count for credits. Normal data is unaffected; all 550 earlier tests pass.
6. **`linkRealm` does not check that the project is active.** The caller picks candidates with `projectsWithoutRealm(world, activeProjectIds)`.
7. **`attachPending` and `unlinkedRealms` look at placed realms only** (a resting legacy realm is never asked about).
8. **`claimSlotForProject` is for `reconcileRealms`.** Called alone with `projects`, it can put a new realm on the slot of an archived realm whose release is not stored yet; a later restore would then evict the newer project (the older project wins the tie). Session 3 should call `reconcileRealms`, not this, from the app.
9. **`BALANCE_VERSION` not bumped** (`balance.ts` is outside this session's files). Grep: it is only stamped into the derived state (`derive.ts:539`); nothing gates on it. Decision 5 changes derived credits only for the anomalies; Session 3 can bump it with its own changes.
10. **Icons:** `claimSlotForProject` takes the icon as a string and rejects an unknown one like `claimSlot`; the reconcile passes `projectLook(p).icon`.
11. **Name clamp:** over 32 characters becomes 31 plus `…`.
12. **Creation time:** a realm the reconcile creates takes `createdAt = now`; the order that matters (project order) does not read it.

## For Sessions 3, 4 and 5 (my read; adjust to your plan)

- **Session 3 (wiring + removing the claim path):** every project-blind caller that decides a map, a target or a ceremony must pass `projects` (once `useSyncStatus().settled`; before that pass nothing): the `worldRepo` read hooks, `game/ceremonies/host.tsx:54` (`worldMoments(liveWorld(...))`), `game/state/useQuestAfterStop.ts:30` (`afterSession` → `targetOf`), and `screens/Quest/sheets/ScribeSheet.tsx:109`. `domain/game/derive.ts:497` may stay blind: credits count resting realms either way. The others cannot stay blind: the reconcile pauses completely while an attach choice is pending, so an archived project's slot can stay unreleased for a long time, and a blind caller would keep targeting that realm and announcing its ceremonies. Also, blind mode ranks a project realm by its `createdAt` and project-aware mode by the project's `started`, so on a contested slot the map and the timer could pick different winners. An app-wide effect (`Watchers`) calls `reconcileRealms` through `editQuest` behind the flag and the gates above, so it needs no store action. Add `PROJECT_REALMS` in `game/enabled.ts`. Remove `claimSlot`, `ClaimSheet` claim mode and `claimSlot` in `worldRepo`. ScribeSheet's trophy label reads `w.realms` only, so a resting realm's trophies show no realm name until it also reads `w.resting`.
- **Session 4 (attach and Start):** the attach sheet reads `unlinkedRealms`, `projectsWithoutRealm` and `attachPending`, and writes `linkRealm` or `keepRealm` (add both to `useWorldWrites`). Start from a realm uses `realmOfProject(world, project.id)` and `openQuestsOf(world, realm.id)`; scope `StartSheet`/`bindTimerQuest` to the realm's project.
- **Session 5 (Overworld):** a clouded slot's "+" opens the new-project sheet; long-press on a project realm opens that project's edit sheet; hook the cloud-lift to a realm appearing on a slot. Device QA from `PROJECT_REALMS.md` §12.

## Open questions (new)

1. The slip in `PROJECT_REALMS.md` §5 step 3 (decision 5 above): fix the doc in Session 3's branch?
2. `reconcileRealms` writes `slot: -1` for a rested realm. An older build's `worldOf` drops a realm with no valid slot, so it hides that realm and its credits until updated (the doc's open question 7 already notes this). Acceptable?
