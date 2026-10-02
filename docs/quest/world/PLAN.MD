# Adet World Mode: Design + Claude Code Sessions

Save this file as `docs/quest/world/PLAN.md` and commit it before Session 1.
Every session prompt below tells Claude Code to read only its own section plus "Global rules", so no session has to load the whole file.

## How to run these

1. One session = one fresh `claude` run (or `/clear`). Don't chain sessions in one context.
2. Branch from whichever branch contains PR #29 (or from `main` once #21 and #29 are merged). Each session uses its own branch, stacked on the previous one.
3. Each session ends by writing `docs/quest/world/HANDOFF_N.md` (max 15 lines). The next session reads only that handoff plus its own section, not the previous session's chat.
4. Review each PR on GitHub before starting the next session. Run the migration in the Supabase SQL Editor (Session 2) before any build that uses it.

---

## Design (the contract)

**One sentence:** time earns you rewards for showing up; only a real result damages an enemy.

### Concepts (only these four)

- **Realm** = a goal area you name (Databases, Job hunt, Fitness). It lives on one of the 7 existing biome slots, which supply the art, palette, mobs and boss sprite. Max 7 realms. An unclaimed slot stays under cloud.
- **Quest** = one concrete thing to beat, with a title. A quest with no phases is a **mob**. A quest with 2 or more phases is a **boss**. A phase is itself a quest, so there's no separate objective type.
- **Hearts** = every quest has 3 hearts (fixed, not configurable).
- **Result** = what you tell the game after a session: **Done**, **Partly**, or **Not yet**.

### Damage rules (the whole combat system)

| Result | Effect |
|---|---|
| Done | Quest is cleared. |
| Partly | Remove 1 heart, but never the last one. Hearts floor at 1. |
| Not yet | Nothing happens. No penalty of any kind. |
| Mark done (no session) | Same as Done. Lets you log things you did away from the timer. |

- The last heart only falls to a Done. This is what makes it harder without making it punishing.
- A boss is defeated when all its phases are cleared. Phases can be cleared in any order.
- Enemies never heal. Results can be undone for 6 seconds (soft delete). Chests never expire.
- Time still earns the chest and credits as it does today (`MIN_SESSION_MIN`), win or lose. A Done adds a small credit bounty (a boss defeat adds a bigger one). All numbers live in one balance file, so bump `BALANCE_VERSION`.
- Hearts, cleared state and boss progress are derived from result rows. Nothing stores a counter.

### Three screens

1. **Overworld.** One vertical map with 7 biome slots, drawn from existing palettes. Tap a realm and the hero walks there (under 1 s, skippable), then clouds part and the camera zooms in. Tap an unclaimed slot to claim it by typing a name and picking an icon; the clouds lift. It's tap-to-travel, not free roam.
2. **Realm.** The existing path map. Mobs sit along the path, and the boss lair is at the top. The camp with the Sage, Merchant and Scribe stays at the start of the path. One **+** at the path's start: type a title and press enter, and that's a mob. An empty realm shows only a pulsing **+** with "What do you want to beat?".
3. **Timer.** The pixel timer from PR #29. The stage shows the targeted quest's enemy with its hearts above it.

Tapping a node opens a bottom sheet with the title, hearts, phases (boss), a big **Start**, a small **Mark done**, and an overflow menu for edit, add phases and delete.

### Cut on purpose (do not build)

Weak points, categories, tags, due dates, difficulty settings, stamina or energy currencies, grades or ranks, parry or twitch mechanics, free-roam walking, verification of results. Ranks are deferred because they can feel like judgment.

### Cuphead ideas kept (cheap ones)

Boss phases, a 1.5 s skippable boss intro card, and a KO banner on defeat.

---

## Global rules (apply to every session)

- Follow `CLAUDE.md`. No infrastructure outside Supabase. No new dependencies. Report bundle-size delta in each PR.
- Schema discipline: composite `(user_id, id)` keys, soft deletes via `deleted_at`, a `server_updated_at` trigger. Prefer the existing `items` and `links` tables from `006_quest.sql`. Add a migration only if they can't express the data.
- Don't change sync architecture. The only allowed sync change is a minimal, additive registration of a new row kind that follows the existing `items`/`links` pattern. Anything beyond that: stop and ask.
- Game state is derived, never stored. Forgiving rules are non-negotiable: no death, no guilt UI, no red warnings, bosses never heal.
- Existing credits, chests, level and inventory must survive untouched. Chests and credits only accrue from sessions after `quest_meta.startedAt`.
- Gate everything behind `EXPO_PUBLIC_QUEST_ENABLED`. With it off, the non-quest app must work unchanged.
- Platform differences go in `.web.ts` / `.native.ts`, not scattered `Platform.OS`. Ceremonies go through the single `ceremonyHost.evaluate()`.
- Minimal text, icon-first UI, calm tone.
- **Budget rule:** this session must stay under ~100K tokens. Don't read the whole repo. Grep first, open only the files you need, and don't paste large file contents into your own notes. If you've opened more than ~25 files or your diff passes ~1,500 lines, stop at the next clean commit and write the handoff.
- Make small commits, one concern each. Don't stop for minor questions: decide, then list the decision in the PR. Stop and ask only for sync changes, new dependencies, or destructive data changes.
- End with `HANDOFF_N.md`: what's done, what's left, files touched, decisions made, anything the next session must know.

---

## Session 1: Remove weak points (est. 40–60K)

Branch: `feat/world-1-no-weakpoints`

````markdown
Read docs/quest/world/PLAN.md sections "Global rules" and "Session 1" only.

GOAL: remove the "weak points" feature completely from the product, and nothing else.

1. Audit with grep, not by browsing: "weak point", "weakPoint", "weak_point", "seal", the sword chip/picker in the timer header, and everything that reads or writes them (damage calc, boss seals, chest reflection, quest board, session rows). Write a one-page docs/quest/world/S1_AUDIT.md listing each consumer.
2. Remove the UI: the weak-points picker, the sword chip in the timer header (header goes back to subject + mute + collapse), the Quest Board selection step, and any copy mentioning weak points.
3. Remove the logic: nothing may require or multiply by weak points. If boss seals were gated by weak points, make bosses simply vulnerable. Keep current time-based HP behaviour as a TEMPORARY rule, marked `// TEMP(world-2): replaced by results`, so the app stays playable until Session 4.
4. Data: do NOT drop columns or rewrite old rows. Stop reading and writing the fields, and keep old rows parsing without errors. List the dormant fields in the PR.
5. Keep the chest reflection if it doesn't depend on weak points. If it does, decouple it.
6. Update or delete affected tests. Typecheck, lint and tests must pass. No sync, StreakStore, rows or engine changes unless a type must be loosened; if so, keep it minimal and say so.

Deliver: PR, HANDOFF_1.md.
````

---

## Session 2: Data model + rules engine, no UI (est. 60–80K)

Branch: `feat/world-2-domain`

````markdown
Read docs/quest/world/PLAN.md sections "Design", "Global rules" and "Session 2", plus HANDOFF_1.md. Nothing else up front.

GOAL: the data layer and pure rules for Realms, Quests and Results. No screens.

1. Audit first (short): supabase/migrations/006_quest.sql, how `items` and `links` are defined, synced and mapped (grep for their row mappers and the sync registration). Decide whether Realm, Quest (with parent link for phases) and Result can be stored as `items` kinds linked via `links`. Prefer this. Only if it cannot express the data, write migration 007_world.sql following the schema discipline. Document the decision at the top of the migration or in the PR.
2. Create src/domain/world/ with:
   - types: Realm {id, slot 0-6, name, icon}, Quest {id, realmId, parentQuestId?, title}, Result {id, questId, sessionId?, kind: done|partly|not_yet, at}
   - pure functions: heartsOf(quest, results), isCleared, isBoss, bossProgress, isRealmConquered, availableSlots
   - the rules from the "Damage rules" table in PLAN.md. All derived from result rows. All balance numbers in one balance file; bump BALANCE_VERSION.
3. Repository layer on top of the existing store pattern: claimSlot, renameRealm, addQuest, addPhase, recordResult, markDone, undoResult (soft delete), softDeleteQuest, plus selectors for the Realm screen.
4. Any sync registration must be minimal and additive. If it needs more, stop and ask.
5. Tests for every rule: Partly floors at 1 heart, only Done clears, undo restores, boss defeat needs all phases, phases can clear in any order, a deleted quest drops out, Realm conquered, max 7 realms.
6. Remind me in the PR that the migration (if any) must be run manually in the SQL Editor before deploying a build using it.

Deliver: PR, HANDOFF_2.md including the exact public API of the repository layer.
````

---

## Session 3: Realm screen (est. 70–90K)

Branch: `feat/world-3-realm`

````markdown
Read docs/quest/world/PLAN.md sections "Design", "Global rules" and "Session 3", plus HANDOFF_2.md. Open only the files it lists, plus the current quest map screen.

GOAL: turn the existing linear path map into the Realm screen, driven by the world repository from Session 2.

1. Reuse the existing map screen (path, trees, camp with Sage/Merchant/Scribe). Replace the linear progression content with the realm's quests: uncleared mobs as nodes along the path, the boss lair at the top. Show at most 8 uncleared nodes; cleared quests count as trophies and also appear in the Scribe's chronicle.
2. Biome art: use the realm's slot biome for palette, mob sprites and the boss sprite. Reuse existing sprites only.
3. Add quest: one "+" at the path start opens a single text field. Enter creates a mob. No other fields. An empty realm shows only the pulsing "+" and the text "What do you want to beat?".
4. Node sheet (bottom sheet): title, 3 hearts, phases for a boss, a big Start, a small Mark done icon, and an overflow menu (edit title, add phase, delete). Adding a second phase turns a mob into a boss; render phases as pips on the lair.
5. Start navigates to the existing timer, passing questId as a param only. The timer need not use it yet. Mark done calls markDone and plays a tiny cleared animation (no clouds yet).
6. For now the realm screen opens from a temporary dev entry or from the existing Quest tab, with slot 0 auto-claimed as "My first realm" so it's reachable until Session 5. Mark this TEMP(world-5).
7. Veteran protection: legacy linear progress is not converted. Keep the old chronicle entries visible in the Scribe.
8. Test at iPhone SE and Pro Max sizes on web with screenshots in the PR. Keep it uncluttered: if the screen has more than one primary action visible, simplify.

Deliver: PR, HANDOFF_3.md.
````

---

## Session 4: Timer targets a quest + one-tap result (est. 70–90K)

Branch: `feat/world-4-result`

````markdown
Read docs/quest/world/PLAN.md sections "Design", "Global rules" and "Session 4", plus HANDOFF_2.md and HANDOFF_3.md. Open only the timer stage, the session-complete flow, ceremonyHost, and the rewards code.

GOAL: sessions target a quest, and the session result decides damage.

1. The timer reads questId. The stage shows the quest's enemy (mob or boss sprite from its biome) with its hearts anchored above it, replacing the old time-based HP bar. For a boss, show the current phase's hearts plus small phase pips. Remove the TEMP(world-2) time-based HP rule.
2. Result sheet on Done, replacing any old post-session prompt except the loot chest: three large icon buttons (check = Done, half = Partly, hourglass = Not yet). Never blocks: swiping it away counts as Not yet. After choosing, show a 6 s Undo toast that soft-deletes the result.
3. Apply the Damage rules. On Done the hero swings and the enemy is cleared. On Partly one heart pops and the enemy flashes. On Not yet, a calm "see you soon" with no negative visuals. Chest and credits still come from session time, and a Done adds the bounty from the balance file.
4. Double-tap guard on Done and on the result buttons, so a session can't finish or record twice. Keep the 800 ms victory timing from PR #29.
5. Sessions without a quest (started from the old project flow) stay free sessions: no enemy damage, no result sheet, rewards unchanged. The "Battle on the timer" setting still hides only the enemy.
6. Route any ceremony (boss defeated, realm conquered) through ceremonyHost.evaluate(). Placeholder visuals are fine; Session 6 polishes them.
7. Tests: result to damage mapping, double-tap guard, undo, free session unchanged.

Deliver: PR, HANDOFF_4.md.
````

---

## Session 5: Overworld (est. 60–80K)

Branch: `feat/world-5-overworld`

````markdown
Read docs/quest/world/PLAN.md sections "Design", "Global rules" and "Session 5", plus HANDOFF_2.md and HANDOFF_3.md. Open only the Quest tab root, navigation setup, and the biome palette files.

GOAL: the Overworld becomes the Quest tab's root and Realm opens from it.

1. One vertical scrolling map with 7 biome slots in the existing biome order, drawn with existing palettes and procedural pixel tiles. Reuse sprites only. Draw simple paths connecting the slots.
2. A claimed slot shows its realm name, icon and a tiny progress glance (e.g. quests cleared / total as pips, no numbers if it gets crowded). A conquered realm gets a small flag. An unclaimed slot is covered by static cloud sprites with a "+" claim affordance (Session 6 animates them).
3. Claim flow: tap an unclaimed slot, then a small sheet with a name field and an icon row, then the realm is claimed through claimSlot. Nothing else is asked.
4. Hero token sits on the current realm. Tapping another realm moves the token along the path (under 900 ms, tap to skip), then navigates to the Realm screen. Persist "current realm" locally per device, not synced.
5. Remove the TEMP(world-5) entry and auto-claimed first realm from Session 3. Existing users with the temp realm keep it, and it becomes their slot 0 realm (rename allowed).
6. Back from a Realm returns to the Overworld with the token still in place.
7. Keep everything behind EXPO_PUBLIC_QUEST_ENABLED and keep the layout calm: at most one primary action on screen.

Deliver: PR, HANDOFF_5.md.
````

---

## Session 6: Clouds, boss moments, polish (est. 60–80K)

Branch: `feat/world-6-polish`

````markdown
Read docs/quest/world/PLAN.md sections "Design", "Global rules" and "Session 6", plus HANDOFF_4.md and HANDOFF_5.md.

GOAL: the cloud transition and the two cheap Cuphead moments. No new features.

1. Cloud transition using Reanimated only. Zoom in: two or three layers of pixel cloud sprites slide apart in opposite directions while the map scales up toward the tapped slot (about 1.0 to 1.6) and crossfades into the Realm screen. Zoom out is the reverse. Total 600 to 800 ms, stepped easing so it feels pixel-y, driven on the UI thread. Reuse or draw procedural cloud sprites; log any placeholder art in the art inventory.
2. Claim moment: when a slot is claimed, its clouds lift and drift away.
3. Boss intro card: 1.5 s, skippable by tap, shown the first time you start a session on a boss in that app session. Boss name plus a pixel splash. KO banner when a boss's last phase is cleared, then the realm conquered flag raises on the Overworld.
4. Reduce Motion: replace all of this with a 150 ms crossfade and no card animation. Pause animation loops when the app is backgrounded.
5. Performance: no per-frame JS work, no layout thrash, test the transition on a long Overworld. Report the bundle delta.
6. Add a World Mode section to docs/quest/DEVICE_QA.md covering: transition smoothness on a real iPhone, safe-area insets on the Overworld and Realm screens, Reduce Motion, backgrounding mid-session then relaunch, claiming all 7 slots, undo of a Done on a boss's last phase, and Done on a quest that has been deleted meanwhile.
7. Update docs/quest/ART_INVENTORY (or the existing equivalent) with all new placeholders for the P9 pass.

Deliver: PR, final HANDOFF_6.md.
````