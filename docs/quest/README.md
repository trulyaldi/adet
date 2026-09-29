# Quest Mode

Quest Mode gives focused time a purpose. It lives in the **Quest** tab, and its
one loop runs inside the existing session flow. `PLAN.md` holds the
architecture, file map and every assumption; the spec is in `spec/`.

## The loop

1. **Choose.** On the focus view, an optional, collapsed weak-points row picks up
   to 3 open tasks for this session. Starting a timer is still one tap.
2. **Fight.** A slim battle strip (≤72 px, no sound, no flashing) shows the
   current enemy losing HP as minutes accrue. It's only a preview; real values
   come from derivation after the session.
3. **Loot.** A session of 10+ minutes ends with the Loot sheet. Tick finished
   weak points and/or write one line, then **Open**, or tap **Later** and the
   chest waits at camp. It never expires.

Nothing in Quest Mode is active until onboarding (the first Quest-tab visit)
writes `quest_meta.startedAt`. Before that, sessions end exactly as before.

Everything lives in the world: the **Quest Board** (tasks), **Saudager** the
merchant (shop), **Hatshy** the scribe (chronicle, chests, settings, credits)
and **Aqyl** the sage (suggestions).

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
| Mob HP | 25 |
| Boss HP | 0.8 × Σ weekly target minutes, clamped 150–900; forest (first loop) 120; ×1.2 per ascension loop |
| XP | 1 per effective minute; +20% of the session's XP with a chronicle line; +15 per completed weak point; +100 per boss |
| Level | cumulative XP for level L = 100 × (L−1)² |
| Skill (per habit) | level L needs 25 × (L−1)² effective minutes |
| Ranks | Wanderer 1, Squire 3, Knight 6, Captain 10, Warden 15, Lord 20, Legend 27 |
| Credits | ⌊effective min / 10⌋ per session; +2 per chest with a line; +25 per boss; +50 welcome |
| Journey scope | only sessions ending after `startedAt` move the journey, spawn chests and earn credits; XP, levels, ranks and skills count all history |
| Fresh chest | < 24 h old; badges the Quest tab |
| Streak freeze | 60 credits, at most 2 bought per calendar month, added to that month's allowance |

Biome twists (only while that biome is active):

| Biome | Boss | Twist |
|---|---|---|
| Whispering Forest | The Fog Wisp | tutorial boss, 120 HP |
| Mirewood Swamp | The Doomscroll Hydra | 25+ unbroken minutes ×1.2 (pauses aren't recorded) |
| Sunscorch Desert | The Mirage Djinn | ×1.5 with a completed weak point, ×0.75 without |
| Frostpeak | The Frozen Titan | first 10 min of the day's first session ×2 |
| Iron Kingdom | King Tomorrow | sessions started before 12:00 ×1.25 |
| Emberdeep Volcano | The Burnout Drake | 60–240 min days ×1.3; the day after a rest day ×1.2; the boss loses at most a third of its HP per day |
| Astral Citadel | The Hollow Echo | sessions claimed with a chronicle line ×1.25 |

After the Astral Citadel the journey loops (Ascension) with a night palette,
1.2× boss HP per loop and a star pip on the avatar.

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
is everything while a session is running or paused. SFX ids without a file
are silent no-ops (only `ui_tap` has one today); music is off by default and
no loops are shipped yet. The iOS silent switch is respected, and audio mixes
with other apps.

## Safety switches

- `EXPO_PUBLIC_QUEST_ENABLED=false` removes the Quest tab and every session
  hook. Items keep syncing and bought freezes keep counting.
- Without migration 006 the Quest tab shows a friendly note, Quest writes are
  not queued, and the rest of sync is unaffected.
- `QuestPlayground` (long-press the HUD) exists only in `__DEV__`.

## Adding a biome

1. Add its id to `BIOME_IDS` in `src/domain/game/biomes.ts` (the order is
   bottom to top), and its twist to `src/domain/game/twists.ts`, with a test in
   `derive.test.ts`.
2. Add `src/game/content/biomes/<id>.ts` (path bends, landmarks, scatter,
   lights, critters, villagers, ambient particles, lore ≤ 12 words, boss lines)
   and register it in `biomes/index.ts`.
3. Add its palette (`content/palettes.ts`) and roster: 3 mobs, the boss,
   critters (`content/roster.ts`).
4. Add placeholder recipes for its sprites in `scripts/art/` (mobs, boss,
   props, world tiles), run
   `npm run game:assets`, and commit the atlases.
5. `npm test`: `biomes.test.ts` and `manifest.test.ts` check nodes, the spline,
   line length and that every logical id resolves.

## Asset pipeline

- Game code uses **logical ids** only (`boss.swamp.hydra.idle`, `npc.sage.talk`),
  resolved by `src/game/assets/manifest.ts`.
- `npm run game:assets` (`scripts/build-atlases.ts`) packs one atlas per biome
  plus `shared` into `src/game/assets/atlases/`, from licensed packs in
  `assets/game/raw/<pack>/` where present and the placeholder generator
  (`scripts/gen-placeholders.ts`) everywhere else. One density: 16 px tiles
  and mobs, 64 px bosses.
- `npm run game:preview` renders the world and the avatar at 3× and 4×.
- Rendering uses integer scale and nearest-neighbour sampling only.

## Licensing

`assets/game/CREDITS.md` is generated with the atlases and lists every pack,
its author, license and URL. No pack is installed today, so all art is original
generated placeholder art. The fonts (Pixelify Sans, Silkscreen) are SIL OFL
1.1. The one Quest sound (`ui_tap`) is the app's own generated tap
(`scripts/generate-sounds.js`). The in-app Credits entry is at the Scribe.

## The Sage (Edge Function)

Optional. Aqyl works fully offline on local rules
(`src/domain/game/sageFallback.ts`). AI is opt-in (off by default) and asks once
with a one-line privacy note. The proxy is a Supabase Edge Function,
`supabase/functions/sage`, not deployed by this repo; setup, secrets and deploy
steps are in its README. It needs migration 007 for its daily limit. The app
only needs `EXPO_PUBLIC_SAGE_URL` (the functions base URL). The Anthropic key
lives only in the function's secrets, never in an `EXPO_PUBLIC_*` variable.
