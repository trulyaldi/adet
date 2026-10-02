# Handoff 2: World data model and rules (no UI)

Branch `feat/world-2-domain`, cut from `main` at 4c57f67. No screens use any of this yet.

## Storage decision: items, no migration

Realm, Quest and Result are three new `items` types: `realm`, `quest` and `result`. `items.type` and `links.kind` have no CHECK constraint in `006_quest.sql`. The row mappers (`sync/questRows.ts`, called from `rows.ts`) pass any type that `parseItem` knows, so registering a type is the whole sync change. It is additive: `ITEM_TYPES` plus three `parseProps` cases in `src/domain/items/types.ts`. `rows.ts`, `questRows.ts`, the sync code and `StreakStore` are unchanged, and **there is no migration to run**.

References live in `props`, not in `links`. Each row is self-contained (one write per action), a phase moves with a single row, and links are create-only with derived ids, which suits these records less well.

| type | title | props | id |
|---|---|---|---|
| `realm` | the name (≤32) | `{ slot: 0–6, icon: IconKey }` | `realm:<slot>` (one per slot; if two devices claim the same slot, the first by `createdAt` wins) |
| `quest` | what to beat (≤80) | `{ realmId, parentQuestId? }` (with a parent it's a phase) | `w…` |
| `result` | '' | `{ questId, sessionId?, kind: 'done' \| 'partly' \| 'not_yet', at: ISO }` | `r…` |

Soft delete means removing the item from the list. The store's diff syncs that as `deleted_at`, and putting the item back resurrects it with a newer `updatedAt`. Older builds skip these types; unknown types were already skipped. An unknown result kind reads as `not_yet`, which is harmless.

## Rules (all derived from result rows; `src/domain/world/rules.ts`)

- **Hearts:** 3 per quest.
  - Partly takes 1 and floors at 1.
  - Only Done clears.
  - Not yet does nothing.
  - Mark done is a Done with no `sessionId`.
- **Bosses:**
  - 2 or more live phases make a boss. A quest with exactly 1 phase is still a mob.
  - A boss takes no results of its own. It falls when all its phases are cleared, in any order, and shows full hearts until then.
  - Phases don't nest.
- **Never heal:**
  - A cleared quest takes no further results.
  - A cleared mob can't get phases (it would turn into an unbeaten boss).
  - Only undo gives a heart back.
- **Undo:** soft-deletes the result, allowed within `RESULT_UNDO_MS` (6 s) of its `at`.
- **Deleting a quest:** soft-deletes it and its phases. Their results stay as unread history, and a deleted quest drops out of everything.
- **Realm conquered:** it has at least one quest and every top-level quest is cleared. Adding a quest opens it again.
- **Credits:** on top of time's existing chests and credits. `CLEAR_CREDITS` (5) for each mob or phase cleared and `BOSS_DEFEAT_CREDITS` (25) for each boss that fell, counted only when the clear happened on or after `quest_meta.startedAt`. Wired into `deriveGameState`'s `credits.earned`.
- **Balance:** all numbers are in `src/domain/game/balance.ts` (`MAX_REALMS`, `QUEST_HEARTS`, `BOSS_MIN_PHASES`, `RESULT_UNDO_MS`, `CLEAR_CREDITS`, `BOSS_DEFEAT_CREDITS`). `BALANCE_VERSION` is now **4**.
- **Time-based journey HP:** still runs (`TEMP(world-2)` markers in `derive.ts` and `twists.ts`). Session 4 replaces it when the timer targets a quest.

## Public API

### Repository: `src/data/worldRepo.ts`

```ts
export interface WorldWrites {
  claimSlot(slot: number, name: string, icon: string): string | null;   // realm id, or null if not claimable
  renameRealm(realmId: string, name: string): void;
  addQuest(realmId: string, title: string): string | null;              // new mob's id
  addPhase(parentQuestId: string, title: string): string | null;        // new phase's id
  renameQuest(questId: string, title: string): void;
  recordResult(questId: string, kind: ResultKind, sessionId?: string): string | null; // result id (for undo)
  markDone(questId: string): string | null;                             // result id (for undo)
  undoResult(resultId: string): void;                                   // within 6 s
  softDeleteQuest(questId: string): void;                               // the quest and its phases
}
export function useWorldWrites(): WorldWrites;                           // stable identity
export function useSlots(): SlotView[];                                  // the Overworld's 7 slots
export function useRealmView(realmId: string | null): RealmView | null;
export function useWorldQuest(questId: string | null): { quest: Quest; realm: Realm; view: QuestView } | null;
```

Writes do nothing while the quest tables are unavailable (`questTablesReady()`), like every Quest write. Each write is checked against the slice as of the last write or commit, so a returned id means it was written. Two writes in one handler see each other, for example `addQuest` then `addPhase` on the new id.

### Domain: `src/domain/world` (`index.ts` re-exports these; the writes are under `worldOps`)

```ts
// types.ts
interface Realm { id; slot; name; icon: IconKey }
interface Quest { id; realmId; parentQuestId?; title; createdAt }
interface Result { id; questId; sessionId?; kind: ResultKind; at /* ms */ }
REALM_NAME_MAX = 32; QUEST_TITLE_MAX = 80; realmIdFor(slot); isSlot(v); worldOf(items) → { realms, quests, results }

// rules.ts
interface World { realms; quests; results }
liveQuests(world); resultsFor(questId, results); phasesOf(quest, quests); isBoss(quest, quests)
isCleared(quest, results, quests = []); heartsOf(quest, results, quests = [])
bossProgress(quest, quests, results) → { cleared, total, defeated }
isRealmConquered(realm, quests, results); availableSlots(realms) → number[]
clearedAt(quest, results, quests) → ms | null; worldCredits(world, startedAt) → number

// ops.ts (pure, QuestSlice → QuestSlice; unchanged slice = didn't apply)
claimSlot(q, slot, name, icon, now); renameRealm(q, realmId, name); addQuest(q, realmId, title, now, id?)
addPhase(q, parentQuestId, title, now, id?); renameQuest(q, questId, title)
recordResult(q, questId, kind, now, sessionId?, id?); markDone(q, questId, now, id?)
undoResult(q, resultId, now); softDeleteQuest(q, questId)

// select.ts
liveWorld(items) → World
realmView(items, realmId) → RealmView | null   // { realm, path: (MobView | BossView)[], empty, conquered, cleared, total }
slotsView(items) → SlotView[]                  // { slot, realm | null, conquered } × 7
questById(items, questId)
QuestView { quest, hearts, cleared, lastResult }; MobView adds { kind: 'mob', phases }; BossView adds { kind: 'boss', phases, progress }
```

Pass `quests` (live ones) to `isCleared` and `heartsOf` whenever a quest might be a boss. Without them a boss is judged as a mob.

## Checks

- `tsc` is clean.
- Lint: 0 errors, 83 warnings, the same as main.
- Tests: 515/515 pass, 19 of them new (`src/domain/world/world.test.ts`).
- Type-checking the tests separately gives 54 errors, all pre-existing and the same as main.
- Bundle (iOS Hermes): 5,166,238 → 5,178,205 bytes (+11,967 B, +0.23%), within budget.

## Decisions

1. **Items with props, not links, and no migration** (above).
2. **A realm's id is deterministic** (`realm:<slot>`), so two devices can't create two realms on one slot.
3. **A quest with one phase stays a mob** (the plan says 2 or more). Its single phase can be fought, and the parent can still take results until a second phase makes it a boss.
4. **Bosses take no results of their own**, and their hearts read full until they fall. The screen shows phase progress instead.
5. **Results are rejected** on bosses, on cleared quests and on deleted quests. `addPhase` is rejected on phases and on cleared mobs.
6. **"Conquered" means every top-level quest is cleared.** It isn't sticky: a new quest reopens the realm. If the overworld needs a lasting trophy, record an achievement in Session 5.
7. **Undo enforces the 6 s window in the domain**, not only in the UI.
8. **Deleting a quest keeps its results** as dormant rows.
9. **Credits from results** are counted from `startedAt`, like chests. A deleted quest's bounty disappears, the same way a deleted session's credits do.

## Must know

- Session 3 builds the Realm screen on `useRealmView`, `useWorldWrites` and `useSlots`. Nothing in the app imports `worldRepo` yet, so it isn't in the bundle until a screen does.
- The Realm screen's empty state is `RealmView.empty`. A node sheet's undo uses the returned result id, or `QuestView.lastResult`.
- Gate the screens behind `EXPO_PUBLIC_QUEST_ENABLED`. The domain itself needs no gate: with no realm items, nothing changes.
