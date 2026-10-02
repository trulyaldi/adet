# Quest Mode: device checklist (iPhone, Expo Go)

Tick each box. Where it says **Playground**, open it by **long-pressing the HUD
portrait** (top left of the Quest map). It exists only in development builds,
which is what Expo Go runs. Its **QA** tab changes nothing real: what-if sessions
live in memory only, and ceremony previews never touch your real progress.

Before starting: migration 006 has been run (`docs/quest/MIGRATIONS.md`), and you
are signed in.

## 1. Launch
- [ ] The app opens on Today, and Today, Projects and Stats behave as before.
- [ ] A fourth tab (a game controller) shows a small dot.

## 2. Onboarding
- [ ] Open the Quest tab: three panels (waking by the campfire, Aqyl's line, the rank).
- [ ] Panel 3's rank matches your real history (e.g. "Your past focus already made you a Knight."), or "Every focused minute counts." if you're new.
- [ ] After Begin: the map, no pile of old ceremonies, no stack of old chests, and 50 credits (top right).
- [ ] The tab's dot is gone.

## 3. The ten QA scenarios

| # | Do | Expect | QA shortcut |
|---|---|---|---|
| 1 | Fresh user: onboarding, a 12-minute session, then the chest: tick a task, write a line, Open | Crit hits, XP and credits count up, then the map reveal plays | QA → +25m then Show JSON: how XP, level and the enemy's HP would move (the real chest still needs a real session) |
| 2 | Veteran account | Real rank on onboarding, no replayed ceremonies, no old chests, only the 50 welcome credits | — |
| 3 | A session under 10 minutes | No chest; it ends exactly as before Quest | — |
| 4 | Tap **Later** on a chest | It sits at camp (and in the Scribe → Chests); it can still be opened the next day | — |
| 5 | A session that drops a boss by base damage, then **Later** | The boss ceremony plays after the Loot sheet closes | QA → boss 10% shows the boss nearly down (view only) |
| 6 | Sign in on a second device (or delete and reinstall Expo Go data) | No ceremony replays | QA → Forget marks, then reopen: nothing replays |
| 7 | AI Sage off: the Sage still suggests. On, with no server: still suggests (local) | No errors, no spinner that never ends | — |
| 8 | iOS Settings → Accessibility → Motion → Reduce Motion **on** | Ceremonies are a still frame and a fade; no shake, no particles; the map doesn't walk | QA → preview each ceremony |
| 9 | Start a timer, then pause it | No sound, no haptics, no ceremony, even when one is due | — |
| 10 | (Only on a test project) before running 006 | A calm "almost ready" note on the Quest tab, and the rest of the app syncs | — |

## 4. Visual pass
- [ ] Every Quest screen (map, HUD, four NPC sheets, character sheet, Loot sheet, ceremonies) in **light and dark** iOS appearance.
- [ ] Pixels are crisp: no blur or smearing on sprites or pixel text.
- [ ] No clipped text in panels or buttons. Try a long habit name on the Quest Board.
- [ ] Nothing sits under the notch, the Dynamic Island or the home indicator.
- [ ] Aqyl's hint on a new map reads "…strike your **first** foe", not "Arst" (a broken
      ligature in the font, turned off; checked on web only).
- [ ] **Readability of the pixel font:** credits, XP and level numbers. In Pixelify Sans a
      "5" can look like an "S", and a bold "C" like an "O" (the welcome "50" may read
      "S0"). Note whether that bothers you: swapping the font is a design choice.

## 5. Art review
Playground → **Art**. Open each section in turn (one is open at a time), at the
scale that matches your phone (3× on most iPhones).
- [ ] Every sprite is recognisable as what its label says.
- [ ] Sizes look right next to each other (mobs vs. the avatar vs. bosses).
- [ ] No stray pixels, cut-off frames or jittering feet in animations.
- [ ] Each biome's colours hang together.
- [ ] The new ground and path (Kenney, recoloured) look at home in every biome. The
      astral citadel's ground and the iron kingdom's path are plainer than before:
      keep, or ask for the old ones back?
- [ ] The chest (Kenney) looks right in the Loot sheet, including its hop-in.
Write down anything off by its **logical id** (the label under the sprite).

## 6. VoiceOver
- [ ] Map: tap a mob, the boss (its line is read out), a villager (their tip), a critter.
- [ ] The HUD, each NPC, the Quest Board, a chest at camp.
- [ ] Character sheet: its summary ("Level 8 Knight, 3 of 7 bosses defeated").
- [ ] A level-up is announced.

## 7. Reduce motion
- [ ] With Reduce Motion on (or Scribe → Settings → Reduce motion: On): the map doesn't
      animate, ceremonies are still frames with a fade, the Loot sheet shows totals at
      once.

## 8. Performance
- [ ] Scroll the whole map top to bottom: smooth?
- [ ] The reveal after a session, and a ceremony: smooth?
- [ ] If anything stutters, note the **device model**, the **biome**, and what was on screen.

## 9. Persistence
- [ ] Buy and equip a cosmetic (Merchant, then the character sheet). Force-quit and reopen: still worn.
- [ ] Sign in on a second device: the same gear is worn there.

## 10. Timer calm
- [ ] During a running timer, and while it's paused: no sound, no haptics, no ceremony.

## 11. Audio
Scribe → Settings → Sound effects on. With the ringer on:
- [ ] Tap a button in the Quest tab (`ui_tap`), open a chest (`chest_open`, then `crit` on
      ticked tasks), buy something (`purchase`).
- [ ] QA → preview a level-up (`level_up`), a rank-up (`rank_up`), a boss defeat
      (`boss_defeat`, then `gate_open`).
- [ ] Each one is short, soft, and sounds like what it's for. Note any that are too
      loud, too quiet, shrill, or sad.
- [ ] Music is off by default. Turned on, it stays silent (no music ships yet).
- [ ] Play your own music or a podcast, then use Quest: it keeps playing.
- [ ] With the silent switch on: no Quest sounds.

## 12. Kill switch
- [ ] Set `EXPO_PUBLIC_QUEST_ENABLED=false` in `.env`, restart Expo: no Quest tab, no weak points or battle strip on the timer, no chest after a session.
- [ ] Your data still syncs, and freezes you bought still protect your streak.
- [ ] Set it back to `true`.

## 13. Web (optional)
- [ ] On the web build, the Quest tab loads after a short "Finding the path…" and works
      like on the phone (it needs internet once, to fetch the graphics engine).
- [ ] Scribe → Settings → AI Sage asks with a browser dialog ("Chronicle entries are
      sent to generate suggestions."); Cancel leaves it off.

## 14. Dev-server drops (v2 N1)
The red screen "Cannot read property 'reload' of undefined" came from Metro's HMR client
when a lazily loaded Quest screen was first fetched after the dev connection had dropped.
- [ ] Start a timer, lock the phone for 10+ minutes, unlock, finish the session: no red
      screen, the Loot sheet opens.
- [ ] Start a timer, stop Metro (Ctrl-C) mid-session, finish the session: the Loot sheet
      still opens and the chest can be opened or sent to camp. Restart Metro afterwards.

## 15. The pixel focus screen (timer redesign)
Four zones: a slim header, the clock plate, the Stage, Pause / Done. Check on an iPhone SE
and a Pro Max.
- [ ] Header: habit icon and name; the sword chip with a count (after the journey starts);
      the dim button after 2 min; sound; minimize. Tap the sword: the weak-points list drops
      down over the plate; picks and quick add work; tap again to close.
- [ ] Clock plate: the count-up in the pixel font (no "S0": a 5 is a 5); the digits don't
      jitter as they tick; under it a pixel clock and the target (`35m`, or `1h 10m / 1h 45m`
      after an earlier session today; a sparkle once past the target).
- [ ] The Stage takes about half the screen. No ring, no separate HP bar under it, no thin
      bar or sprout behind the buttons.
- [ ] Sun Arc (default): the sun rises from the left over the session, is highest at half the
      target and sets on the right at the target; the sky warms at dawn and dusk and never
      goes dark. Past the target, a few soft stars.
- [ ] Settings → Timer skin: four pixel previews. Campfire: a fire between you and the enemy
      that stays lit, a warmer glow and more embers with time, stars coming out. Hourglass:
      the top drains, the bottom fills, a few grains falling. Trail: the far hills scroll and
      the biome's landmark comes in from the right, arriving at the target.
- [ ] Before choosing a skin, each project shows its old scene's match (orbit → Sun Arc,
      constellation → Campfire, fill → Hourglass, plant → Trail).
- [ ] With the journey started: the enemy on the right, its HP as a pink segmented bar above
      it (seal icons top right for a boss). Once a focused minute, your character swings and
      the enemy loses its share; it never heals. No red, no white flash, no sound.
- [ ] A beaten enemy dissolves into warm petals and the next walks in; a boss without its
      seals kneels, dazed. Tap the Stage: the enemy's name for a moment.
- [ ] Pause: your character sits and rests with a "z"; the world dims and stands still.
      Resume: it gets up and stretches.
- [ ] Reaching the target: a small cheer. Done: a short victory hop, then the Loot sheet.
- [ ] Twenty minutes into a session, the Sage flies across the sky once.
- [ ] Background the app for a few minutes and return: the sun, sand and landmark sit where
      the time says (nothing replays or jumps back).
- [ ] Reduce Motion on: a still scene; the sun (sand, landmark) moves once a minute.
- [ ] Quest settings → "Battle on the timer" off: the skin and your character, no enemy.
- [ ] `EXPO_PUBLIC_QUEST_ENABLED=false`: the old focus screen (ring, project scene, your
      character in a corner) works as before.
- [ ] QA panel → Timer Stage: each scene state, each skin, at 0 / 35 / 70 / 100 / 120%.

## 16. v2: seals, the Trail, the pixel look
- [ ] Against a boss: its seal icons (calendar, sword, quill) sit under its HP bar on the map,
      in the boss panel (tap the gate: counts like `2/3`) and on the Stage. A boss at 0 HP with
      a seal missing kneels with dazed stars; it doesn't heal; the ceremony plays only once the
      seals fill.
- [ ] Scribe → Trail: a row per skill with a neutral mark (stairs, a level line, a moon), four
      small bars and reasons. Tap a row: this week against last week; add a measure (Pages).
- [ ] The quill (bottom right of the map, and at the top of the Scribe): pick a skill, a line
      and/or an amount, Save. A small "+3 XP" chip floats up.
- [ ] With a measure, the Loot sheet shows − / amount / +. Skipping it changes nothing.
- [ ] Almanac (the Stats tab): the title reads Almanac; the bars button opens the Trail.
- [ ] Every screen, light and dark, at the phone's size: the pixel font everywhere, small square
      corners, hard 2 px shadows, pixel icons in the tab bar and on buttons. Nothing clipped or
      blurry; long habit names still fit.
- [ ] Legibility at the smallest sizes: `50`, `5`, `S`, `0`, `O`, `C` are never confused (the
      welcome credits read 50).
- [ ] Reduce Motion on: the Stage is still, loading dots don't step, chips only fade.
- [ ] During a running or paused timer: no Quest sound and no Quest vibration at all.

## 17. World Mode (Overworld, realms, results)
- [ ] **Transition smoothness (real iPhone):** tap a realm. The hero walks, then the map scales toward
      it while three cloud layers close and part on the Realm (about 0.7 s, in visible pixel steps,
      no stutter or white flash). Back (chevron) runs it in reverse. Do it for slot 0 and for the top
      slot with the map scrolled all the way up (the long Overworld). The map zooms toward the slot
      you tapped, not toward the middle.
- [ ] **Claim:** tap a cloud, name it, Claim. That island's clouds rise and drift apart, then the
      zoom opens the new realm.
- [ ] **Safe areas:** on a notched iPhone and on an SE, the Overworld's labels, the "+" and the
      HUD clear the notch and the home indicator; the Realm's Back and quill buttons sit above the
      home indicator; the clouds cover the whole screen edge to edge.
- [ ] **Reduce Motion on:** no walk, no clouds, no zoom; realms open and close with a short
      crossfade. The claim opens the realm straight away. The boss card and the KO banner appear
      and go without moving. A newly conquered realm's flag simply stands.
- [ ] **Background mid-session, then relaunch:** start a session on a quest, background the app
      for a minute (the map and Stage stop animating; nothing plays on return), come back and Done.
      Then start another, force-quit and relaunch: the session is free (no enemy, no result
      sheet), and nothing breaks.
- [ ] **All 7 slots:** claim every slot, one at a time. Each lifts its clouds and opens. Then
      no "+" is left, every realm can be opened and renamed (long-press), and the map scrolls end to end.
- [ ] **Boss moments:** start a session on a boss. The "BOSS" card shows its name over the splash
      for 1.5 s, and a tap skips it. Minimize and reopen the timer: no card. Start the same boss again
      in the same app session: no card. After a relaunch it shows once more.
- [ ] **Undo of a Done on a boss's last phase:** Mark done the last phase, then tap Undo within
      6 s. No KO plays, the boss is back with that phase, and the realm is not conquered. Done it
      again and let the undo lapse: KO, then "Conquered", then Back. The realm's flag rises out of
      its island once.
- [ ] **Done on a quest deleted meanwhile:** start a session on a quest, delete that quest on
      another device (or from the Realm while the timer is minimized), then Done. The result
      sheet doesn't ask about it (a free session), the chest still comes from time, and nothing errors.

## If something's wrong, send back
- a screenshot or screen recording;
- the iPhone model and iOS version;
- the steps to get there;
- for art, the **logical id** from the Art gallery;
- for sound, which one and what felt off.
