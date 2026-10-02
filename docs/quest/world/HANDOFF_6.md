# Handoff 6: clouds, boss moments, polish (final)

Branch `feat/world-6-polish`, stacked on `feat/world-5-overworld` (#34). No migration, no sync change, no new dependency. Screenshots: `media/s6-*.png`.

- **Done:**
  - **Cloud transition** (`overworld/transitionModel.ts` (pure, tested), `CloudCurtain.tsx`, `useRealmTransition.ts`). One `t` runs 0 (map) → 1 (realm) on the UI thread: 720 ms, cut into 14 steps. The map scales 1 → 1.6 about the tapped slot (computed from its camera), three cloud walls close, the screens swap under full cover, and the walls part. The zoom out is the same run in reverse. With reduced motion it's a 150 ms crossfade. Both screens are mounted only while it runs; taps and Back are blocked meanwhile.
  - **Claim:** the slot's clouds lift and drift apart (560 ms), then the zoom.
  - **Boss intro card** (`session/BossIntro.tsx`): 1.5 s, tap to skip. It shows once per boss per app session (`game/state/bossIntro.ts`, in memory).
  - **KO banner:** a pixel splash, stamped in three steps (`WorldMoment`, `game/ui/PixelSplash.tsx`).
  - **Flag raise:** a newly conquered realm's flag rises on the Overworld after the zoom out (`overworld/flagMemory.ts`). An undo, then a re-conquer, raises it again.
- **Fix:** the ceremony host still waited on the legacy reveal's `local.seen`, which nothing has written since world-3. On a new device that blocked every ceremony on the Quest tab, including KO. It now waits only for `local.loaded`.
- **Decisions:**
  1. The boss card is a focus-screen overlay, not a `ceremonyHost` event, because the host never plays while a timer runs.
  2. The hero moves to a newly claimed slot when the zoom lands.
  3. New loops: none. The one-shots are timings, and the world clock already pauses in the background (`useWorldRunning`).
- **Checks:** tsc clean. Lint 0 errors, 81 warnings (unchanged). Tests 550/550 (7 new). Bundle (iOS Hermes) 5,123.5 → 5,146.6 KB (+23.2 KB, +0.45%).
- **Web QA (375×667):** zoom in/out on slot 6 at max scroll (slowed 10× to inspect), claim lift, boss card, KO → Conquered → flag. Reduce Motion: no clouds or transform. **Device QA not done:** see DEVICE_QA §17. Placeholders are listed in `art/INVENTORY.md` (World Mode).
- **Must know:** the zoom scales the Skia view, so it smooths mid-zoom (mostly hidden under cloud). The QA harness is the HANDOFF_5 recipe plus `drag:` and `RM=1` (reduced motion) in `ow.mjs`. The realm lair sits off-screen above the camp, so drag down twice to reach it.
