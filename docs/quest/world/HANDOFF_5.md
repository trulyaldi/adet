# Handoff 5: the Overworld

Branch `feat/world-5-overworld`, cut from `feat/world-3-realm` at 6623d5f (that branch has #33 merged in; main does not). No migration, no sync change. Screenshots: `media/s5-*.png`.

- **Done:** `QuestScreen` opens on `overworld/Overworld.tsx`.
  - Layout: 7 slots in biome order, slot 0 at the bottom. The layout model is `overworldModel.ts` (pure, tested); the canvas is `OverworldMap.tsx` (Skia). Islands are procedural 2 px tiles in each palette. The sky is banded and the path dotted. A transparent ScrollView on top moves the camera and takes the taps.
  - Claimed slot: name, icon, pips for top-level quests cleared out of all (scaled to 8, never a number), and `prop.<biome>.flag` once conquered. Unclaimed slot: static `parallax.<biome>.cloud` sprites. Only the lowest unclaimed slot shows the gold "+", but any cloud can be tapped to claim.
  - Claim: `ClaimSheet` (name and icon, then `claimSlot`) opens the new realm. Long-press a realm, or use the screen-reader action, to rename it (name only).
  - Travel: the token walks the route, at most 850 ms (`travelMs`); any tap skips, and the walk scrolls the camera. Then the Realm opens. With reduced motion it opens directly.
  - Current slot: `QuestLocal.slot` (AsyncStorage, per account, not synced), with `currentSlot()` as the fallback. Back (a chevron button, or Android back) returns to the map with the token in place.
- **Removed `TEMP(world-5)`.** A Session 3 "My first realm" is simply the slot 0 realm, and it can be renamed.
- **Domain:** `SlotView` gains `cleared` and `total`. Removing the auto-claim reopened time damage on the hidden legacy journey, so `derive.ts` now cuts it at `min(JOURNEY_HIDDEN_AT = 2026-10-02 14:00 UTC, first realm)`. `BALANCE_VERSION` is 5.
- **Checks:** tsc clean. Lint 0 errors, 81 warnings (same as before). Tests 543/543 (6 new). Bundle (iOS Hermes) 5,097.8 → 5,123.5 KB (+25.7 KB, +0.50%).
- **Session 6:** animate the clouds lifting on claim (`ClaimSheet` → `openRealm` in `QuestScreen` is where to hook it), and the zoom into a realm. Labels are RN views over the canvas, so the walking token passes under them. Icons can't be changed after claiming (no API).
- **Device QA not done.** Web QA covered the claim, rename, walk, skip and back flows at 375×667. The pips in `s5-se-realms.png` predate the contrast tweak. The harness is `seed.ts` + `ow.mjs` from the HANDOFF_3 recipe; add `adet-quest-local-v1:<uid>` to seed the slot, and restart Metro after edits (`CI=1` doesn't watch files).
