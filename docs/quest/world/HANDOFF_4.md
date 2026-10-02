# Handoff 4: the timer targets a quest, and one tap tells the result

Branch `feat/world-4-result`, stacked on `feat/world-3-realm` (#32). No migration.

## Done
- **Binding** (`game/state/timerQuest.ts`): Realm Start sets the quest pending. The start sheet binds it to the habit it starts, and drops it when it closes without starting. The binding is in memory only, so a relaunch mid-session gives a free session.
- **Target** (`domain/world/target.ts`): `targetOf(world, questId)` gives a mob, or a boss's oldest uncleared phase, with its hearts and phase pips. It returns null if the quest was cleared or deleted, and the session is then free. `effectOf(kind, hearts)` maps a result to damage. `afterSession()` gives the chest from time and the result to ask. `worldMoments()` lists fallen bosses and conquered realms.
- **Stage** (`TimerStage.tsx`): the target's enemy (the boss sprite for a boss's phase) with 3 hearts above it and gold phase pips. The time-based HP bar and per-minute swings are gone. Free sessions show no enemy. The `battleStrip` setting hides the enemy only on the timer.
- **Result sheet** (`ResultHost.tsx` shell, lazy `ResultSheet.tsx`): it opens after the focus view, then the chest follows if the session ran ≥ `MIN_SESSION_MIN`.
  - Buttons: ✓ / ½ heart / hourglass. Swipe, a tap outside, or Back all count as Not yet.
  - The result plays on the same Stage. Done: a swing and a dissolve; on a boss's earlier phase, a flash and its next pip lights, and the boss stands (`stageReactionOf`). Partly: a swing, a tint flash and one heart pops (at 1 heart, the flash only). Not yet: "See you soon". 6 s Undo, then OK.
  - Ceremonies are held from stop until the sheet has gone.
- **Guards:** `createLatch()` covers the timer's Done (`focusShell`) and the result buttons. `recordResult` rejects a second live result for the same `sessionId` (undo frees it). The 800 ms `VICTORY_MS` is unchanged.
- **TEMP(world-2) removed** (`derive.ts`): sessions ending after the first realm's `createdAt` deal no journey damage. Earlier history derives exactly as before; a veteran fixture test proves level, credits, defeats and position are identical. XP, credits and chests still come from time, and the Done bounty is still only `worldCredits`.
- **Ceremonies:** new `world_boss` and `realm_conquered` events go through `ceremonyHost`, shown as placeholder `WorldMoment` banners ("KO", "Conquered"). Marks gain optional `worldBosses` and `realms`. Marks saved before world-4 seed them silently. A realm plays once per id. Realm Mark done holds ceremonies through its undo chip.
- **Checks:** tsc clean. Lint 0 errors, 81 warnings (same as #32). Tests 537/537. Bundle (iOS Hermes) 5,075.2 → 5,097.3 KB (+22.1 KB, +0.44%), within budget.

## Left / must know
- **Not run on web or a device:** no screenshots, no device QA. The Stage hearts layout and the result sheet are unverified visually.
- **Session 5:** the Overworld replaces the `TEMP(world-5)` auto-claim. Legacy journey pieces (`JourneyMap`, `planReveal`, `encounterOf`) are frozen but still feed the Stage's free-session scenery and the QA panel.
- **Session 6:** polish `WorldMoment` (boss intro card, KO banner art) and the result reactions.
- **Decisions:**
  1. Edit-times-after-stop skips the sheet (Mark done is on the Realm).
  2. The sheet shows the enemy even with `battleStrip` off.
  3. A rejected result (the quest fell on another device) plays as "none".
  4. Any boss on the timer uses its biome's boss sprite, even if the map draws it as a mob.
- `docs/quest/world/PLAN.MD` is still untracked (and named `.MD`, while the prompts say `PLAN.md`). Committing it is the owner's call.
