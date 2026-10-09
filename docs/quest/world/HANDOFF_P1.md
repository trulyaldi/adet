# Handoff P1: Projects as Realms, audit and design

Audit and design only. Two docs and this file, all under `docs/quest/world/`. No app code, no `supabase/`, no dependency changed. Session 2 not started.

- `PROJECT_REALMS_AUDIT.md`: every consumer of the claim path and of the project/habit models, with what must change; the project lifecycle today; the storage check.
- `PROJECT_REALMS.md`: the rules.

## Results

- **No migration needed.** Realm and quest references live in `items.props` (jsonb, no CHECK). **But it is not zero code:** `parseProps('realm')` is a whitelist and strips `projectId`; `RealmProps` and that parser case must change first (audit §1). A build without it drops `projectId` whenever it rewrites a realm.
- **No project cap exists.** `MAX_REALMS = 7` is the only seven.
- **Checks unchanged.** The diff is docs-only against HEAD (`feat/world-6-polish`, PR #35's branch): `tsc` clean; lint 0 errors / 81 warnings; tests 550/550, equal to the HANDOFF_6 numbers for this tree. This is not `main`: `origin/main` is #34 (543 tests in HANDOFF_5), and local `main` is stale at a128fad. The audit cites files that exist only in #35 (`flagMemory`, `CloudCurtain`, `transitionModel`, `useRealmTransition`), so **the design assumes #35 merges first**.
- **Nothing committed.** The three docs are untracked, next to the owner's untracked `PLAN.MD`, which I did not touch. Committing onto PR #35's branch seemed wrong; say which branch you want.

## Decisions I made that you did not specify

1. **The id: derive from the project.** New realms are `realm:p:<projectId>`. Legacy `realm:<slot>` ids are kept forever (changing them means rewriting every quest's `realmId`). A project's realm id encodes the project, so the link self-heals if `props.projectId` is ever stripped. Why not `realm:<slot>`: it hands an archived realm's quests to the next project on that slot, merges two projects when two devices allocate offline, and breaks the once-per-id ceremony marks. Table in `PROJECT_REALMS.md` §3.
2. **Exists vs placed.** A resting realm (project archived or deleted) stays in the derived world, so credits, trophies and hearts are untouched. Only placement code (Overworld, slot allocation, target, ceremonies) excludes it. This is what makes "never lose progress" true, because `liveQuests` drops quests whose realm is missing.
3. **Archive frees the slot.** Otherwise seven retired projects would use up the map. The realm and its quests rest.
4. **Delete keeps the realm and its quests, resting for good.** The delete dialog only promises habits and history. Credits earned from quests survive; the realm shows only as a trophy line under its snapshot name.
5. **Restore re-places the realm; it never evicts a project on the map.** It takes the lowest free slot, or waits for one.
6. **One reconcile instead of hooking `saveProjectSheet`.** A pure idempotent function with one app-wide effect is the only writer of placement. Projects also arrive by pull, seed, migration and flag-off builds, which a creation hook misses. No store action changes. Runs only with the flag, `QUEST_ENABLED`, quest tables ready, the journey started, and sync settled.
7. **The eighth project gets a realm later** (an interpretation of your rule "a project beyond the seventh has no realm", not a gap I filled): when a slot frees, the oldest project without one takes it, with no prompt. If you meant the eighth stays realmless until you act, say so and step 4 drops the "waiting" case.
8. **Placement is derived at once, persisted by the reconcile.** Hiding an archived project's realm needs no write (works offline, without the quest tables). The slot is cleared on the item afterwards so a later restore has no tie to settle.
9. **Slot ties** go to the older project (`started`, then id), and the other is unplaced. Only among placed candidates.
10. **Name and icon:** derived from the project, name clamped to 32 characters at display (the project sheet has no limit); a snapshot is also written into realms the reconcile creates, for the flag-off path, older builds and deleted projects. Attached legacy realms keep their own stored name and icon.
11. **A project realm is renamed in the project.** Long-press on it opens the project's edit sheet. A manual realm keeps today's rename.
12. **Attach:** a sheet per unattached realm (project list limited to projects with no realm, plus "Keep it as it is"). The answer is saved on the realm (`projectId`, or `manual: true`) so it is asked once across devices. The reconcile pauses exactly while the sheet has something to ask, including after a swipe-away: no "later". Attach changes one prop; the realm's own name and icon are kept.
12a. **A realm with no `projectId` is never resting.** Manual and unanswered legacy realms stay placed on their slot whatever the projects do. Their slot ties rank by realm `createdAt`; project realms by `started ?? 0`, then project id (the seed has `started: null`).
12b. **Exists-vs-placed is not behind the flag.** `worldOf` keeping slotless realms ships unconditionally; only the reconcile, attach and UI are flagged.
13. **A manual realm** keeps its slot and its rename. With seven manual realms no project gets a realm, silently.
14. **Start from a project realm is scoped to that project.** Its habits only, directly when it has one timed habit; a habit of another project is never bound to the quest. With no timed habit, Start is hidden and Mark done stays.
15. **The flag is default off**, copied from `QUEST_ENABLED` and also requires it.
16. **Resting realm ⇒ `targetOf` returns null**, so a session ending against one is free. This also neutralises the existing edge where `archiveProject` bypasses `useQuestAfterStop` and leaves the quest binding unreleased.
17. **No UI says anything** about a project lacking a realm, a resting realm or full slots.

## Open questions for you

1. **Default and rollout of the flag.** Off by default is my choice. When on, existing users meet the attach sheet on their next Overworld visit. OK?
2. **Attach with no matching project.** Should the sheet also offer "make a project from this realm"? That would create a project (and habits?) from the realm, the only place the design writes to the main app's data. Currently not offered.
3. **Deleted projects' realms.** They rest forever and are never revived. Would you rather a new project be able to adopt one ("bring this realm back")? Needs a decision on matching.
4. **Restore keeps its biome?** Now a restored project takes the lowest free slot, so its art may change. A `lastSlot` prop would prefer the old one when free. Worth the extra prop?
5. **Clouded slot "+" with the flag on:** I propose it opens the new-project sheet (the realm lands on the lowest free slot, not necessarily the tapped one). Alternatively no "+" at all and the clouds stay decorative. Which?
6. **Manual realms to project later.** Can a "kept as is" realm be linked afterwards (a long-press action), or is "keep" final?
7. **Old builds.** A build without the parser change strips `projectId` on rename. Project-derived realms heal from their id; an attached legacy realm does not (it would show the attach sheet again, with no data loss). Also: an old build's `worldOf` drops realms without a slot, so while a project is archived its realm and quests are hidden there and its credit total reads lower until that build updates. Nothing is lost. If you still use an old build next to a new one, I can mirror the id in the realm's `body` (survives the old build's spread). Do you?
8. **Project with no timed habit.** Start is hidden. Alternatively Start offers a one-tap "add a habit". Preference?
9. **Journey started as a gate.** The reconcile waits for `quest_meta` so non-Quest users get no quest rows. Fine, or should realms exist before the Quest tab is first opened?
10. **Realm for a project in a state "no habit yet".** A project with no habits still gets a realm (a realm has no use for habits until Start). OK?

## For Session 2 (my read, not decided)

Smallest first step with no behaviour change: the parser (`projectId`, `manual`, nullable slot, `worldOf` keeps unplaced realms), the three selectors taking `projects`, `realmIdForProject`/`projectIdOf`, and the pure reconcile with its tests, all unused behind the flag. Wiring (Watchers effect, attach sheet, Start scoping, "+" behaviour) after. Tests list is in `PROJECT_REALMS.md` §12.
