# Handoff P3: Projects as Realms, store wiring and Overworld

Branch `feat/project-realms-3-wiring`, in the worktree `../adet-p3` (cut from `origin/main` d544a8c, #37 merged; `node_modules` is a symlink to the main checkout's, `.env` copied, both ignored). Behind `EXPO_PUBLIC_PROJECT_REALMS` (new, default **off**, needs Quest Mode on; in `.env.example`). No migration, no sync change, no new dependency, nothing in `src/domain/world/`, `StartSheet`, `timerQuest`, `ResultSheet`, `target.ts` or `supabase/` touched. **No missing domain API** (HANDOFF_P2's was enough).

Checks: `tsc` clean. Lint 0 errors / 81 warnings (same as main). Tests 584/584 (576 + 8 new). No bundle delta measured. **Device QA not done** (list: `DEVICE_QA.md` §18).

**Web QA done** (Chromium 375×667, Metro web, supabase blocked, a fake offline session, `adet-quest-tables-v1 = available`; the harness is in the scratchpad, not committed):
- **Flag on, fresh account:** create a project, open Quest, Begin the onboarding: the first island shows "Guitar practice" with the hero, the other six stay under cloud with no "+" and nothing to tap. `settled` does turn true with the backend unreachable, so the gates open offline.
- **Archive → new project → restore:** the realm leaves the map; a new project ("Reading") takes island 0; unarchiving the first puts it on island 1. Both realm items exist at the end (`realm:p:<id>`, slots 0 and 1); nothing deleted.
- **Attach:** a hand-claimed realm named "GUITAR   practice" is linked silently (it keeps that stored title and shows the project's name). A realm named "Databases" shows the sheet (the project, and Skip). Skip → `manual: true` and the project then gets its own realm on island 1; picking the project → `projectId` set on `realm:0`, title kept, no second realm.
- **Flag off:** the same flow gives seven "claim it" islands, no automatic realm, and the manual claim writes `realm:0` as before.
- **Not covered on web:** two real devices (only the pure convergence tests), the Reduce Motion paths, delete, and the eighth project in the UI (pure tests only).

## What it does

- **One effect drives everything** (`data/projectRealms.ts`, `useProjectRealms`, mounted in `QuestWatcher`): on any change to the items or the projects it runs `linkByName` then `reconcileRealms` through `editQuest`. Creating, renaming, restyling, archiving, restoring or deleting a project, a sync pull, a project from an older build, and the first backfill all take the same path. No store action changed. A fresh account's project gets its realm the moment the journey has started (after the Quest onboarding's Begin) and sync has settled, with no claim tap.
- **Gates** (all must hold, else it does nothing): flag on, store ready, sync settled, quest tables available, journey started. Flag off: no effect, no hook result changes.
- **Project-aware reads** (`useWorldProjects`: `projects` once settled and flag on, else `undefined`, the project-blind world as before): `useSlots`, `useRealmView`, `useWorldQuest`, `useSessionTarget`, `useQuestAfterStop`, the ceremony host, `ScribeSheet` (also reads `w.resting`, so a resting realm's trophies keep its name). `derive.ts` stays blind (credits count resting realms either way).
- **Pure parts, tested** (`data/projectRealmsModel.ts`): `linkByName(q, projects)` and `attachChoiceOf(items, projects)`.
- **Silent attach:** a hand-claimed realm whose name equals exactly one realm-less active project (ignoring case and spaces) is linked, once.
- **Attach sheet** (`overworld/AttachSheet.tsx`, shown on the Overworld only): one question at a time, lowest slot first; the realm's name as the title, a tap-to-link row per realm-less project (oldest first), and **Skip** (small). Pick → `linkRealm`; Skip → `keepRealm`; closing answers nothing and the sheet stays closed for the rest of the app run (module memory, `game/state/attachAsked.ts`, so it survives tab switches), then asks again next launch. The reconcile waits while a question is open (P2), so projects get realms right after the last answer.
- **Overworld:** with the flag on a free slot stays under its static clouds, with no "+" and no tap (`claimable={false}`, a neutral a11y label "Land under cloud"). Long-press (and the screen-reader action) on a project's realm opens **that project's edit sheet**; on a hand-claimed realm it still opens ClaimSheet's rename.
- **QuestScreen's `addQuest` input is unchanged.**

## Where this prompt and the design/handoffs disagree (the doc won)

1. **No hook in the project actions.** The prompt says creating a project calls `claimSlotForProject`, renaming syncs the realm, and so on. `PROJECT_REALMS.md` §5 puts all of it in one reconcile (projects arrive by pull, seed, migration, older builds). The reconcile does call `claimSlotForProject`/`syncRealmLook`.
2. **"Backfill once per device."** Not a once-flag: the reconcile is idempotent and runs on every change, which also covers projects created later by older builds or other devices. Convergence is by derived ids and the older-project tie rule (tested: two devices doing the same backfill, and two creating at once).
3. **ClaimSheet and `claimSlot` are not removed.** HANDOFF_P2 suggested removing the claim path in this session, but "flag off = byte for byte" needs it. The claim path is unreachable with the flag on; remove it when the flag is permanent. Rename mode stays: the doc says a hand-claimed realm renames itself, a project's realm in its project.
4. **"Skip" = `keepRealm`** (permanent, synced), the doc's "Keep it as it is". Only closing the sheet leaves a question open.

## Decisions not in the prompt or the docs

1. HANDOFF_P1 open question 5 is answered by the prompt: no "+" on a free slot; the clouds stay (static).
2. The attach sheet shows only on the Overworld (not mid-walk, mid-zoom, mid-claim-lift, or with the claim sheet or any camp sheet open).
3. The silent link needs exactly one matching project; two same-named projects go to the sheet. Two realms with one name: the lower slot links, the other is asked.
4. `linkByName` and `attachChoiceOf` live in `src/data/` because `src/domain/world/` was off limits; they could move into the domain.
5. Long-press on a project's realm is "edit the project" (the screen-reader action keeps its generic "Rename" label).
6. Gating on the journey having started (P1 open question 9) means a fresh account's realm appears when the Quest onboarding ends, not at project creation.
7. A free slot with the flag on is not pressable at all (it was a claim target).
8. Because the flag-off path reads exactly as before, `ScribeSheet` is the only flag-off difference: it also names resting realms, which exist only in the P2 anomaly cases.

## Known gaps (for Session 4 and after)

- **Start is not scoped to the project yet** (`StartSheet`/`timerQuest` were off limits): from a project's realm any habit still binds to the quest. That is Session 4.
- **No cloud-lift when a realm appears** on a visible map; it just appears (P2's Session 5 note).
- **Restore may change the biome** (lowest free slot); open question 4 of P1 is unchanged.
- **Older builds** drop a realm whose slot is cleared (archived project) until updated; open question 7 of P1.
- **Offline first launch on a new device** can report `settled` with nothing pulled; then no project is missing and nothing rests, and it corrects itself on the next pull.
- Effect cost: every change to the items or the projects runs the reconcile (a few array passes). Not profiled.

## Ceremonies and flags (found in review)

- **Seeding includes resting realms.** The ceremony host seeds and back-fills its marks from `worldMoments` over placed and resting realms (`history`), and detects over placed ones only. Otherwise a new device, or "Forget marks", would not record an archived project's old KO or Conquered, and restoring the project would play them. Normal play already had those marks.
- **The map's flag memory** (in memory only, seeded after sync settles) does raise a restored conquered realm's flag once, like a newly conquered one. Left as is: it is quiet and arguably right.

## Merge overlap with Session 4

`../adet-p4` (uncommitted when I looked) also defines `PROJECT_REALMS` in `src/game/enabled.ts` (plus its test) and edits `QuestWatcher.tsx`. I copied its `projectRealmsFrom(raw, questOn)` and `PROJECT_REALMS` definition and test verbatim, so those hunks are identical on both branches; the `QuestWatcher.tsx` edits are different lines (mine adds `useProjectRealms()`, theirs `useTimerQuestPersistence()`). Merge them by keeping both. Session 4's QA depends on this session's reconcile: nothing creates a project's realm before it.
