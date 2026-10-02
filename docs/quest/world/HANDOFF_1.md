# Handoff 1: weak points removed

Branch `feat/world-1-no-weakpoints`, cut from `main` at dcb5459. The consumer list is in `S1_AUDIT.md`.

## Done

- **UI**
  - The timer header no longer has the sword chip or the weak-points picker. It holds the subject, sound and collapse, plus the dim button, which appears after 2 minutes as before.
  - The Quest Board is gone: the sheet, the camp prop, the screen-reader button and its greeting.
  - The Loot sheet has no tick list or crit display; a chest opens with a line, or with an amount when the habit has a measure.
  - The Sage shows its insight line only (no suggestions or pins).
  - The Trail lost its weak-points row and reason.
  - The Scribe shows only an entry's text.
  - Onboarding and lore copy no longer mention weak points.
- **Rules**
  - No crits, no task XP, no XP for weak points done outside a session.
  - The desert twist is neutral.
  - Seals and stagger are removed entirely: bosses fall at 0 HP. Seals were gated partly by weak points (Insight).
  - Damage is still time-based, marked `// TEMP(world-2): replaced by results` in `derive.ts` and `twists.ts`.
  - `BALANCE_VERSION` is now 3. Stored boss achievements still keep progress from going back.
- **Data:** nothing dropped or rewritten; old rows parse unchanged. The dormant fields are listed at the end of `S1_AUDIT.md`.
- **Checks**
  - `tsc` is clean.
  - Lint: 0 errors, 83 warnings (main has 84).
  - Tests: 496/496 pass. Weak-point and seal tests were deleted; claim, preview, desert, Trail and stage tests were rewritten; a new test covers bosses falling at 0 HP.
  - Type-checking the tests separately gives 54 errors, the same as main and all pre-existing (engine, insights, recap, sync and rows tests).
- **Bundle (iOS Hermes):** 5,207,487 → 5,166,238 bytes (−41,249 B, −0.79%), within budget.

## Left for the next sessions

- **Docs still describing weak points and seals:** `docs/quest/README.md` (rules tables R3/R4 and the desert row), `docs/quest/PLAN.md`, `docs/quest/DEVICE_QA.md` (§ on seals and the Board), and `docs/quest/spec/*`. I skipped these for budget; rewrite them alongside World Mode's rules.
- **Dormant pieces, removable once the edge function changes** (that is server code, so not touched here):
  - the `crit` sound
  - the boss `.low` pose: still used by the defeat ceremony and the low-HP map, so keep it
  - `prop.board` and `fx.dazed` sprites, still in the atlas
  - `SageAdvice.suggestions`
- **Device check:** the Loot sheet with and without a measure, the camp without the Board, and a boss falling at 0 HP on the map and the Stage.

## Decisions (listed in the PR)

1. **Seals are removed completely**, not just their Insight part: bosses are simply vulnerable, with no stagger state and no seal UI.
2. **The desert twist is neutral (×1)** instead of being replaced by something new.
3. **The Quest Board is deleted outright**, since it existed only for weak points.
4. **The Sage keeps only its insight line.** Its suggestions were weak points.
5. **The Sage edge function's request still includes** `taskCount: 0` and `openTasks: []`, because its zod schema requires them; the function itself is unchanged.
6. **The dim button stays in the timer header.** It predates the chip.
7. **`BALANCE_VERSION` went from 2 to 3**, since derived results change.
8. **Two commits:** the audit, then the removal as one change. The rules and the UI depend on each other, so a split would leave a commit that doesn't compile.
9. **No sync, StreakStore, `rows.ts` or `engine.ts` changes**, and no type loosened. Nothing in `supabase/` was touched.

## Must know

- `docs/quest/world/PLAN.MD` is untracked in the owner's tree (uppercase `.MD`). The prompt calls it `PLAN.md`.
- `tsconfig` excludes tests, so to catch stale references in tests run them, or type-check them with a scratch tsconfig that includes `src/**/*.ts`.
- A session's chest claim now writes only the `chest_claim` item, plus a `log` item when there's a line or an amount.
