# Quest Mode

Quest Mode gives focused time a purpose. It lives in the **Quest** tab, and its
one loop runs inside the existing session flow. `PLAN.md` holds the
architecture, file map and every assumption; the spec is in `spec/`.

## The loop

1. **Choose.** On the focus view, an optional, collapsed weak-points row picks up
   to 3 open tasks for this session. Starting a timer is still one tap.
2. **Fight.** The **Stage** under the timer ring (at most 28% of the screen; a
   slim 72 pt strip on short screens) shows your character gently swinging at
   the current enemy every 4–6 s, its HP draining with effective minutes. Pause
   and your character naps; resume and it wakes. A beaten enemy dissolves into
   warm petals and the next walks in; a boss without its seals kneels, dazed.
   No sound, no haptics, nothing flashes. It's a live preview through the same
   rules (`domain/game/stage.ts`); real values come from the saved session.
3. **Loot.** A session of 10+ minutes ends with the Loot sheet. Tick finished
   weak points and/or write one line, then **Open**, or tap **Later** and the
   chest waits at camp. It never expires.

Nothing in Quest Mode is active until onboarding (the first Quest-tab visit)
writes `quest_meta.startedAt`. Before that, sessions end exactly as before.

Everything lives in the world: the **Quest Board** (tasks), **Saudager** the
merchant (shop), **Hatshy** the scribe (chronicle, chests, settings, credits)
and **Aqyl** the sage (suggestions). Hatshy also keeps the **Trail** (is each
skill rising?) and the **quick log** (the camp's quill).

## State

Game state is **derived**, never stored: `deriveGameState()` in
`src/domain/game/derive.ts` is a pure function of sessions, habits, items and
links. Only user actions are stored as `items` (migration 006): tasks,
chronicle entries (`log`), chest claims, purchases, `quest_meta`, and
`boss_defeated` achievements (append-only, deterministic ids, so they floor
progress across balance changes and merge across devices).

Device-local only: the map position last shown (for the reveal), the weak
points picked for the running timer, ceremony marks, the AI cache, and the
SFX, music, haptics and motion toggles.

## Balance

Every number is in `src/domain/game/balance.ts`. Bump `BALANCE_VERSION` when a
change alters derived results.

| Rule | Value |
|---|---|
| Qualifying session | ≥ 10 focused minutes; shorter sessions do nothing |
| Burnout guard (per local day) | first 240 min at 100%, 240–360 at 50%, beyond at 0% |
| Damage | 1 per effective minute; +10 per completed weak point (max 3), once the chest is claimed |
| Nodes per biome | 3 mobs, camp, 3 mobs, boss |
| One defeat per session | at most one enemy falls per session; surplus damage walks on, stopping each enemy at 1 HP, and is never dropped |
| Mob HP | round(90 × 1.15^biome) effective minutes: 90, 103, 119, 137, 157, 181, 208 |
| Boss HP | clamp(round(1.1 × Σ weekly target minutes × 1.15^biome), 480, 2400); forest (first loop) 420; ×1.2 per ascension loop |
| Seals (bosses only) | Days (distinct local days) 3,4,5,5,6,6,7 · Depth (sessions ≥ 45 min) 1,2,2,3,3,4,4 · Insight (weak points + lines) 2,3,4,5,6,7,8, by biome; counted from sessions fought against the boss; 0 disables one |
| Staggered | a boss at 0 HP without its seals kneels; it never heals, and falls the moment its seals fill |
| XP | 1 per effective minute; +20% of the session's XP with a chronicle line; +15 per completed weak point; +100 per boss |
| Level | cumulative XP for level L = 100 × (L−1)² |
| Skill (per habit) | level L needs 25 × (L−1)² effective minutes |
| Quick log | +3 XP with a line, at most 3 rewarded a day; counts toward Insight against a boss; amounts never earn |
| Ranks | Wanderer 1, Squire 3, Knight 6, Captain 10, Warden 15, Lord 20, Legend 27 |
| Credits | ⌊effective min / 10⌋ per session; +2 per chest with a line; +25 per boss; +50 welcome |
| Journey scope | only sessions ending after `startedAt` move the journey, spawn chests and earn credits; XP, levels, ranks and skills count all history |
| Fresh chest | < 24 h old; badges the Quest tab |
| Streak freeze | 60 credits, at most 2 bought per calendar month, added to that month's allowance |

Biome twists (only while that biome is active):

| Biome | Boss | Twist |
|---|---|---|
| Whispering Forest | The Fog Wisp | tutorial boss, 420 HP |
| Mirewood Swamp | The Doomscroll Hydra | 25+ unbroken minutes ×1.2 (pauses aren't recorded) |
| Sunscorch Desert | The Mirage Djinn | ×1.5 with a completed weak point, ×0.75 without |
| Frostpeak | The Frozen Titan | first 10 min of the day's first session ×2 |
| Iron Kingdom | King Tomorrow | sessions started before 12:00 ×1.25 |
| Emberdeep Volcano | The Burnout Drake | 60–240 min days ×1.3; the day after a rest day ×1.2; the boss loses at most a third of its HP per day |
| Astral Citadel | The Hollow Echo | sessions claimed with a chronicle line ×1.25 |

After the Astral Citadel the journey loops (Ascension) with a night palette,
1.2× boss HP per loop and a star pip on the avatar.

## Encounters (v2): rules R1–R6

- **R1 One defeat per session.** Surplus carries forward, flooring each enemy at 1 HP, past a staggered boss or
  the Drake's daily limit, until absorbed; every session's hits add up to its damage (tested).
- **R2 Bigger HP with a curve** (table above), tuned with the simulator.
- **R3 Seals.** A boss falls only at 0 HP with every seal filled. A session belongs to the encounter in front
  of it before its damage lands; sessions against mobs fill no seal.
- **R4 Staggered** (see the table): no healing, no defeat until the seals fill.
- **R5 No regression.** `boss_defeated` achievements floor the journey. After this rebalance the current
  biome's node position may move back; boss defeats, XP, levels, skills and credits are unaffected.
- **R6 Twists still apply** to damage only.

**Balance simulator:** `npm run game:balance` plays daily-effort profiles (1–4 h/day, 6 days a week, 1–3
sessions a day, some chests claimed with a line or a weak point) through `deriveGameState` and prints
calendar days per biome. At 2 h/day: forest ~9, biome 4 ~17, biome 7 ~26 days; `balanceSim.test.ts` holds
those bands (±25%) and keeps 4 h/day between 1.3× and 4× faster than 1 h/day.

## Activity rewards (v2)

Derived from data the app already has; nothing new is stored. From the journey's start only.

| Activity | Effect |
|---|---|
| Focus session ≥ 10 min | damage, XP, credits, a chest |
| Session under 10 min | nothing (a warm-up) |
| Day's plan completed | +5 credits, once a day |
| Every weekly target met | a Bounty: +40 credits and +60 XP, once a week |
| Weak point done in a session | a crit and XP (through the chest) |
| Weak point done outside a session | +5 XP, at most 5 a day |
| Chronicle line after a session | bonus XP |
| Quick log | +3 XP, at most 3 a day; Insight against a boss |
| Streak freeze used | the campfire shows an ember shield |
| Habit created | a new skill in the character sheet |

Quick logs and outside weak points together earn at most 30 XP a day (10% of a full day of sessions). A small
"+5 XP" chip floats up when one of these lands (not for sessions: the Loot sheet counts those up).

## The Trail (v2)

`src/domain/progress/` compares this week so far with last week to the same moment (weeks follow the app's
week-start setting): focused minutes, sessions, weak points, a measure's total and its amount per focused
hour, skill levels. A habit is **rising** when two of these hold: minutes +15%, per hour +10%, more weak
points, a level gained; **resting** when minutes fell and nothing else improved; otherwise **steady**. The
Scribe shows it per habit with four weekly bars; a habit can have one measure (`metric_def`, e.g. Pages).

## Words

Game words appear only where they stay clear; VoiceOver always hears the plain word too (`src/domain/words.ts`).

| Plain | Game word | Where |
|---|---|---|
| Stats | Almanac | the Stats screen title and tab |
| Streak freeze | Ember shield | the Merchant |
| Task | Weak point | Quest Mode |
| Session note | Chronicle | Quest Mode (the Scribe) |
| Focus session, Habit, Streak, Weekly target | Battle, Skill, Campfire, Bounty | kept plain in forms; the game words name the Stage, skill levels, the campfire and the week's reward |

## Ceremonies

Detection is pure (`src/domain/game/ceremonies.ts`); playback is one
`RootCeremonyHost` at the app root (`src/game/ceremonies/host.tsx`).

- **Marks** are device-local, per user (`adet.quest.ceremonyMarks.v1:<userId>`),
  and monotonic: `{ level, rank, bosses[], ascensions }`.
- **No history replay.** Marks are seeded silently at onboarding, and on any
  device that sees a started journey without marks (after the first sync
  settles). A veteran never sees old levels, ranks or bosses.
- **Events:** boss defeats (once the achievement is recorded), Ascension (with
  the Astral boss), level-up, rank-up. Several levels coalesce into one; a
  rank-up replaces the level-up. Order: boss → ascension → level → rank.
- A mark is written when its ceremony **starts**, so skipping never replays it.
- `ceremonyHost.evaluate()` runs when the Loot sheet closes (Open or Later),
  after the map reveal, and on app foreground.
- **Calm:** nothing plays while a session is running or paused, over another
  sheet, before the map reveal, or in the background. Celebrations and
  ceremonies take turns.
- Every ceremony is skippable with a tap and has a reduce-motion variant
  (static frame and fade: no shake, no particles).

## Sound and haptics

`src/game/feedback/` is the only way Quest makes noise. Each call names its
context (`quest | loot | ceremony | timer`). `timer` is always muted, and so
is everything while a session is running or paused.

All nine sound effects (`ui_tap`, `chest_open`, `hit`, `crit`, `level_up`,
`rank_up`, `boss_defeat`, `gate_open`, `purchase`) are real CC0 sounds from
Kenney's packs, built by `npm run game:audio`:
- trimmed, made mono and evened in loudness (a little under the app's own
  sounds);
- encoded as AAC `.m4a`, since iOS can't play the packs' OGG;
- 53 KB in all.

They were chosen by measurement (short, soft, rising), not by ear; see
`docs/quest/art/MAPPING.md`. An id without a file stays a silent no-op. No
music loops ship yet (`assets/game/needs-audio.json`), and music is off by
default. The iOS silent switch is respected, and audio mixes with other apps.

## Safety switches

- `EXPO_PUBLIC_QUEST_ENABLED=false` removes the Quest tab and every session
  hook. Items keep syncing and bought freezes keep counting.
- Without migration 006 the Quest tab shows a friendly note, Quest writes are
  not queued, and the rest of sync is unaffected (`src/sync/missingTables.test.ts`).
  `docs/quest/MIGRATIONS.md` has the verify scripts and the locked, manual
  rollbacks (`supabase/manual/`), all tested against real Postgres (PGlite).
- The dev **Playground** (long-press the HUD portrait) exists only when `__DEV__`
  is true; a production export contains none of it. It has three tabs:
  - **Kit**: the render-kit demos.
  - **QA**: a what-if overlay (synthetic sessions and weak points, boss HP)
    derived in memory for that view only, a map preview with time of day and a
    biome jump, ceremony previews that never touch the real marks, "Forget
    marks", and the derived state as JSON. Nothing is written
    (`qa/qa.test.ts` walks its imports).
  - **Art**: every sprite by biome and category, animated at 2×/3×/4× and
    labelled with its logical id, plus the avatar's 7 tiers and every cosmetic.

## Adding a biome

1. Add its id to `BIOME_IDS` in `src/domain/game/biomes.ts` (the order is
   bottom to top), and its twist to `src/domain/game/twists.ts`, with a test in
   `derive.test.ts`.
2. Add `src/game/content/biomes/<id>.ts` (path bends, landmarks, scatter,
   lights, critters, villagers, ambient particles, lore ≤ 12 words, boss lines)
   and register it in `biomes/index.ts`.
3. Add its palette (`content/palettes.ts`, 16–24 colours in ramps) and roster: 3
   mobs, the boss, critters (`content/roster.ts`).
4. Art: map pack sprites for it in the registry (`assets/game/packs/*.json`),
   and add stand-in recipes in `scripts/art/` for the rest. Run
   `npm run game:needs-art` (the build refuses stand-ins that aren't on the
   allowlist), then `npm run game:assets`, `npm run game:report` and
   `npm run game:contact -- <id>`, and look at the contact sheet.
5. `npm test`: the biome, manifest, art, copy and accessibility tests check
   nodes, the spline, line length, guilt words, sizes and that every logical id
   resolves.

## Asset pipeline

Game code uses **logical ids** only (`boss.swamp.hydra.idle`, `npc.sage.talk`),
resolved by `src/game/assets/manifest.ts`. Needs `ffmpeg` and `unzip` on the
PATH.

```sh
npm run game:fetch      # download registered packs (pinned URL + sha256), keep their licenses
npm run game:assets     # atlases + sources.generated.ts + credits
npm run game:audio      # sound effects (.m4a)
npm run game:report     # docs/quest/art/INVENTORY.md and MAPPING.md
npm run game:contact -- forest   # docs/quest/art/contact-forest.png (--compare: stand-in above)
npm run game:needs-art  # rebuild the stand-in allowlist after mapping new art
npm run game:preview    # a scene per biome (world-preview.png)
npm run check:size      # iOS export against scripts/size-budgets.json
```

- **The registry** (`assets/game/packs/<pack>.json`) is the one place mappings
  live: the pack's page, download, checksum and license, and each sprite
  (tile index or rect, recolour, mask, frame offsets) or sound it provides.
  The packs' files sit in `assets/game/raw/` (gitignored).
- **Stand-ins:** ids no pack provides keep Adet's original art from
  `scripts/gen-placeholders.ts`. Each one must be on
  `assets/game/needs-art.json` with its reason, or the build fails.
- **The rules:** `docs/quest/art/ART_BIBLE.md` (one 16 px density, no
  upscaling, recolour to the biome palette, consistency over coverage).
- **Budgets:** JS within 1.2 MB of the polish-pass baseline, game images
  2.5 MB (no atlas over 500 KB), audio 4 MB.
- Rendering uses integer scale and nearest-neighbour sampling only.

## Licensing

Policy: **CC0, CC-BY, or explicitly permissive only.** No NonCommercial,
ShareAlike/GPL, personal-use-only or unlicensed assets.
- `assets/game/CREDITS.md` and the Scribe's Credits screen are both generated
  from the registry (`scripts/credits.ts`), and a test keeps them in step.
- Each pack's license text is kept in `assets/game/licenses/<pack>/`.
- In use today: Kenney's Tiny Town and Tiny Dungeon (ground, path, the chest)
  and Interface Sounds, Impact Sounds, RPG Audio and Music Jingles (all CC0).
- Packs looked at and not used, with why, are in
  `assets/game/evaluated-packs.json`.
- Stand-in art is Adet's own. The fonts (Pixelify Sans, Silkscreen) are SIL OFL 1.1.

## The Sage (Edge Function)

Optional. Aqyl works fully offline on local rules
(`src/domain/game/sageFallback.ts`). AI is opt-in (off by default) and asks once
with a one-line privacy note. The proxy is a Supabase Edge Function,
`supabase/functions/sage`, not deployed by this repo; setup, secrets and deploy
steps are in its README. It needs migration 007 for its daily limit. The app
only needs `EXPO_PUBLIC_SAGE_URL` (the functions base URL). The Anthropic key
lives only in the function's secrets, never in an `EXPO_PUBLIC_*` variable.
The request and response rules live in one pure module,
`supabase/functions/_shared/sageContract.ts`, used by both the function and the
app.

## Lint

`npm run lint` (eslint-config-expo). Quest code (`src/domain/game`, `src/game`,
`src/screens/Quest`, the Sage client and function) must have zero errors; the
rest of the app reports the same rules as warnings.
