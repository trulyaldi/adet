# Handoff 6: clouds, boss moments, polish (final)

Branch `feat/world-6-polish` (PR #35, on main after #34 merged). No migration, no sync change, no new dependency. Screenshots: `media/s6-*.png`.

- **Transition** (`overworld/transitionModel.ts` pure + tested, `CloudCurtain.tsx`, `useRealmTransition.ts`): one UI-thread `t`, 720 ms in 14 steps. The map scales 1 → 1.6 about the tapped slot while three cloud walls close; the screens swap under full cover, then the walls part. The zoom out is the reverse. Reduced motion: a 150 ms crossfade. Taps and Back are blocked while it runs.
- **Moments:** a claimed slot's clouds lift and drift (560 ms), then the zoom. The boss intro card (`session/BossIntro.tsx`) lasts 1.5 s, tap to skip, once per boss per app session (`game/state/bossIntro.ts`). KO is a stamped pixel splash (`WorldMoment`, `game/ui/PixelSplash.tsx`). Then a newly conquered realm's flag rises on the map (`overworld/flagMemory.ts`, seeded after sync settles; undo + re-conquer raises it again).
- **Decisions:**
  1. The boss card is a focus-screen overlay, not a `ceremonyHost` event: the host never plays while a timer runs.
  2. The hero moves to a claimed slot when the zoom lands.
  3. No new loops: one-shots only, and the world clock already pauses in the background.
  4. **Fix:** the host waited on the legacy reveal's `local.seen` (unwritten since world-3), which held every ceremony on the Quest tab on a new device. It now waits on `local.loaded` only.
- **Checks:** tsc clean. Lint 0 errors / 81 warnings. Tests 550/550 (7 new). Bundle (iOS Hermes) 5,123.5 → 5,146.6 KB (+23.2 KB, +0.45%).
- **QA:** web 375×667 covered zoom in/out on slot 6 at max scroll (slowed 10×), the claim lift, the boss card, KO → Conquered → flag, and Reduce Motion. **Device QA is open (DEVICE_QA §17).** The scaled Skia view smooths mid-zoom, mostly under cloud. Placeholders are in `art/INVENTORY.md` (World Mode).
