# Adet — Quest Mode (full build, all tickets)

You are working in the Adet repo (`/home/aldiyar/adet`), a React Native / Expo app (v2.0.0) backed by Supabase with a local-first sync engine (outbox pattern, last-write-wins). You are running unattended with auto-accept. **Do not stop to ask questions.** When something is ambiguous, pick the option most consistent with the principles below, record it under "Assumptions" in `docs/quest/PLAN.md`, and continue.

---

## 0. Product brief (read carefully — this drives every decision)

Adet tracks focused time on habits/projects. Time alone is neutral; Quest Mode gives it **purpose** through one loop:

1. **Choose** — before a session, optionally pick up to 3 *weak points* (planned tasks) for that habit.
2. **Fight** — the running timer deals damage to the current enemy on the player's journey.
3. **Loot** — after the session, a treasure chest appears. The player opens it by ticking weak points they completed and/or writing one line about what they did. That line becomes a *chronicle entry* that the AI Sage later uses to help plan.

The game is a **pixel-art journey** through 7 biomes with mobs, bosses, NPCs, XP, levels, rank titles, credits and an evolving avatar. It lives in a new **Quest** tab (controller icon), but the loop happens inside the *existing* session flow. It is not a separate app bolted on.

### Non-negotiable principles
- **No bloat.** Every new feature is expressed as something *in the world*: the task planner is the Quest Board, the shop is the Merchant, the reflection history is the Scribe, the AI is the Sage. No new top-level screens beyond the Quest tab.
- **Forgiving, never punishing.** The player has no HP and cannot die. Bosses never heal. Missed days cost nothing. Unopened chests never expire. No guilt language anywhere. Copy is warm, short and optional.
- **Minimal wording.** Prefer pixel icons and animation over text. NPC lines stay at 12 words or fewer. Every interactive element has an `accessibilityLabel`.
- **One-tap start still works.** The weak-points step is optional and collapsed by default. It never adds friction to starting a timer.
- **Calm during focus.** The in-session battle visual is subtle: no flashing and no sound. It must never compete with the work.
- **Game state is derived, not stored.** XP, level, rank, boss HP, journey position and credit balance are pure functions of sessions and items. Only true user actions are stored: tasks, chronicle entries, purchases, claimed chests, quest start, and boss-defeat achievements.
- **Expo Go compatible.** The owner tests on a physical iPhone via Expo Go and develops on Linux (no Mac). Use only libraries that run in Expo Go, and install them with `npx expo install`. **Do not use Rive, Lottie-native or any custom native module.**

---

## 1. Engineering rules

- **Branching:** Create branch `feat/quest` from the latest `main`. Make **one commit per ticket**, with a message like `quest(Q3): asset pipeline`. At the end, open **one PR** whose description includes a checklist of every ticket, the assumptions made, and manual test steps.
- **Migrations:** Supabase migrations live in `supabase/migrations/`. Use the next free number. Every table follows the existing conventions:
  - composite primary key `(user_id, id)`
  - soft delete via `deleted_at`
  - a `server_updated_at` trigger
  - RLS restricted to `auth.uid() = user_id`
  
  Migrations are run **manually** by the owner, so put a loud note at the top of the PR. The app must not crash if the tables don't exist yet: feature-gate the Quest tab and show a friendly empty state.
- **High-conflict files:** Keep edits to `StreakStore.tsx`, `rows.ts` and `engine.ts` minimal and surgical. Put new logic in new modules and import it.
- **Folder layout:**
  - `src/domain/game/` — pure TypeScript, no React, no RN imports. This will be shared with the future desktop (Expo web + Tauri) build.
  - `src/game/render/` — the Skia pixel rendering kit.
  - `src/game/content/` — biome, NPC, mob and boss definitions, plus lore text.
  - `src/game/assets/` — atlases, manifest and fonts.
  - `src/screens/Quest/` — screens and sheets.
  - `worker/` — the Cloudflare Worker for the Sage.
- **Tests:** Use the existing test setup. If there is none, add a minimal `jest-expo` config. The domain layer (Q2) needs thorough unit tests.
- **Phase 6:** If Phase 6 (UX simplification) is merged, respect its decisions. Don't re-add metrics it removed, and don't duplicate numbers already shown on Stats.
- **Before finishing:** Typecheck, lint and test must pass, and `npx expo start` must bundle without errors.

---

## Q0 — Recon and plan (no feature code yet)

Read the repo. Identify:
- the session model (start/end/pause fields, duration, habit link, notes)
- habits (treated as "projects" here)
- streak, freeze, weekly-target logic
- the sync engine tables list
- tab navigation, the icon system, theming
- whether `items` / `links` tables already exist

Then write `docs/quest/PLAN.md` containing: the files you'll create or touch per ticket, data flow, assumptions, and risks.

**Acceptance:** The plan exists and every later ticket references it.

---

## Q1 — Data foundation: `items` + `links`

If they don't already exist, create them.

**`items` table**
- columns: `user_id, id (uuid), type text, title text, body text, props jsonb default '{}', habit_id uuid null, created_at, updated_at, deleted_at, server_updated_at`
- index on `(user_id, type)`

**`links` table**
- columns: `user_id, id, from_type text, from_id uuid, to_type text, to_id uuid, kind text, created_at, deleted_at, server_updated_at`
- index on `(user_id, from_id)` and `(user_id, to_id)`
- `from_type` / `to_type` may be `item`, `session` or `habit`

**Item types used by Quest Mode.** Document these in `src/domain/items/types.ts` with zod-style or TS-discriminated props:

| type | purpose | props |
|---|---|---|
| `task` | a weak point | `{ status: 'open' \| 'done', order: number, doneAt?: string }` |
| `log` | chronicle entry | `{ sessionId: string }`; `body` holds the text, which may be empty if only tasks were ticked |
| `chest_claim` | marks a session's chest opened | `{ sessionId: string, claimedAt: string }` |
| `purchase` | shop purchase | `{ sku: string, cost: number, month?: 'YYYY-MM' }` |
| `achievement` | append-only milestone | `{ kind: 'boss_defeated' \| 'biome_cleared' \| 'rank_reached', ref: string, at: string }` |
| `quest_meta` | singleton | `{ startedAt: string, avatar: { gear: Record<slot, sku> }, companion?: sku, settings: {...} }` |

**Link kinds**
- `task → session`: `planned_for`, `completed_in`
- `log → session`: `chronicles`

**Sync:** Register both tables in the sync engine: outbox, pull, last-write-wins on `updated_at`, soft deletes. Add a typed repository `src/data/itemsRepo.ts` with hooks such as `useItems(type, filter)` and `useLinks(...)`.

**Acceptance:** Items and links round-trip offline → online across two devices in manual testing. The migration file is idempotent (`if not exists`).

---

## Q2 — Game domain engine (pure, fully tested)

Create `src/domain/game/` containing:

- `balance.ts`: every tunable constant, plus `BALANCE_VERSION`
- `derive.ts`: one entry point, `deriveGameState({ sessions, items, links, now, tz }) → GameState`

Everything must be deterministic and memoizable.

### Rules

**Qualifying session**
- A session counts if it has at least `MIN_SESSION_MIN = 10` focused minutes.
- Shorter sessions deal no damage, grant nothing, and spawn no chest.

**Effective minutes (burnout guard)**
- Per local day, the first 240 minutes count at 100%.
- Minutes 240–360 count at 50%.
- Beyond 360, minutes count at 0%.

**Damage**
- Base damage = effective minutes.
- Crit: each weak point with a `completed_in` link to the session adds `+10` damage (maximum 3 per session). Crits apply once the chest is claimed.
- Biome twist modifiers apply only while that biome is active (see Q5).

**Journey**
- The journey starts at `quest_meta.startedAt`. Only sessions after that date move the journey.
- Levels, XP and skills use the **full history**, so existing users get a satisfying head start (e.g. "you're already a Knight").
- Each biome is an ordered list of nodes: 6 mob nodes, 1 camp (rest/NPC) node in the middle, and a final boss node.
- Damage fills nodes in order. Overkill carries over to the next node.
- Mob HP: `MOB_HP = 25`.
- Boss HP: `clamp(round(0.8 × user's weekly target minutes summed across habits), 150, 900)`. Biome 1's boss is fixed at 120.
- When a boss reaches 0 HP:
  - an `achievement(boss_defeated)` is written (append-only, idempotent)
  - the next biome unlocks
- Derived journey progress = `max(stored achievements, derived)`. This way, a balance change can never un-defeat a boss.

**XP**
- 1 XP per effective minute.
- `+20%` of that session's XP if the chest is claimed with a non-empty chronicle entry.
- `+15` per completed weak point.
- `+100` per boss defeated.

**Level**
- Cumulative XP needed for level `L` is `100 × (L−1)²`.
- Expose `level`, `xpIntoLevel` and `xpForNextLevel`.

**Rank title (from level)**

| Levels | Title |
|---|---|
| 1–2 | Wanderer |
| 3–5 | Squire |
| 6–9 | Knight |
| 10–14 | Captain |
| 15–19 | Warden |
| 20–26 | Lord |
| 27+ | Legend |

- Each rank maps to an avatar gear tier (0–6).

**Skills**
- Each habit is a skill.
- Skill XP = the effective minutes on that habit.
- Skill level uses `25 × (L−1)²`.

**Credits**
- Earned:
  - `floor(effective minutes / 10)` per session
  - `+2` per claimed chest with a chronicle entry
  - `+25` per boss
- Balance = earned − sum of purchases. Never negative: the shop blocks purchases the player can't afford.

**Chests**
- Every qualifying session without a `chest_claim` item is an unopened chest.
- Base damage and base XP apply immediately. The chest holds the *bonus* (crit damage, reflection XP, credits).
- Expose `unopenedChests` sorted newest first, and `hasFreshChest` (unopened chest less than 24h old). `hasFreshChest` drives the tab badge; older chests just sit quietly at camp.

**Ascension (after biome 7)**
- The journey loops through the biomes again.
- Each loop: alternate night palette, boss HP ×1.2 per loop, and a star pip on the avatar.

### Tests
Unit-test at least the following:
- the day cap
- the 10-minute threshold
- overkill carry-over
- the boss-never-un-defeats rule
- every biome twist
- the level curve boundaries
- credit balance with purchases
- chest bonus deferral
- timezone day boundaries
- empty history

**Acceptance:** 100% of the rules above are covered by tests. `deriveGameState` handles 5,000 sessions in under 50 ms (add a benchmark test).

---

## Q3 — Art direction and asset pipeline

### Style: modern pixel art
The reference bar is games like *Eastward*, *Sea of Stars* and *Stardew Valley*. That means:

- **One pixel density everywhere.** 16 px tiles, 16–32 px characters, 48–64 px bosses.
- **Integer scaling only.** Compute the largest integer scale that fits the screen width (usually 3× or 4× on iPhone).
- **Nearest-neighbour sampling everywhere.** No sub-pixel positions: round all draw positions to the pixel grid at render scale.
- **A limited palette per biome** (roughly 16–24 colours), with consistent outline treatment.
- **Motion:** 2–4 frame idle animations at 6–8 fps. Hit flash (1 white frame). Squash and stretch on landing. Dust puffs when walking. Pixel ellipse drop shadows.
- **Light:** Additive glow sprites for light sources (torches, lanterns, lava, crystals). A time-of-day colour grade from device local time: dawn, day, dusk, night.
- **Depth:** Parallax background layers (2–3 per biome), and a subtle vignette.

### Asset sources
The owner will place licensed packs in `assets/game/raw/<pack-name>/`. **Primary pack: Pixel-boy's "Ninja Adventure" (CC0)**. It includes characters, monsters, bosses, tilesets, UI, SFX and music. It may be supplemented by Kenney CC0 packs.

Handling rules:
- Inspect whatever is present.
- **Never mix pixel densities.** If a pack's density doesn't match 16 px, exclude it and note that in `CREDITS.md`.
- For biomes a pack doesn't cover (swamp, volcano, astral), derive them with **palette swaps** using a Skia runtime shader or a palette-remap step in the build script. Do not use mismatched art.

### Pipeline
- Write `scripts/build-atlases.ts` (Node, using `sharp` plus a simple shelf packer or `free-tex-packer-core`).
- Output one atlas PNG + JSON per biome, plus `shared` (UI, avatar, NPCs, FX), into `src/game/assets/atlases/`.
- Write `src/game/assets/manifest.ts`, which maps **logical IDs** to frames and animations, e.g.:
  - `boss.swamp.hydra.idle`
  - `npc.sage.talk`
  - `tile.forest.grass.a`
  
  Game code only uses logical IDs, never raw file names.
- **Placeholder generator (`scripts/gen-placeholders.ts`).** If a logical ID has no art from the packs, generate an original sprite from palette-indexed ASCII grids that you author yourself (16×16 mobs, 64×64 bosses, 2–4 idle frames). Make them genuinely charming, not grey boxes. The app must be complete and good-looking with placeholders alone.
- **Credits:** `assets/game/CREDITS.md` records the source, author, license and URL of every pack, and flags anything whose license isn't CC0/CC-BY/explicitly-permissive. Add an in-app Credits entry, reachable from the Scribe.

### Fonts
Use a pixel font via `@expo-google-fonts/pixelify-sans` (or `silkscreen` for tiny labels), loaded with `useFont` for Skia text and `expo-font` for RN text.

**Acceptance:**
- `npm run game:assets` rebuilds everything.
- The manifest has zero missing IDs (enforced by a test).
- `CREDITS.md` is complete.

---

## Q4 — Pixel render kit (`src/game/render/`)

Build on `@shopify/react-native-skia` (Expo Go compatible) and `react-native-reanimated`.

- **`PixelStage`:** A Skia `Canvas` with integer scale, a nearest-neighbour `sampling` default, a pixel-snapped camera (Reanimated shared values), and culling of anything off-screen.
- **`SpriteAtlas` rendering:** Draw via Skia's `Atlas` / `drawAtlas` for batched sprites. Provide an `AnimatedSprite` with fps, loop, one-shot, flip and hit-flash.
- **`Tilemap`:** Layered tilemap renderer (ground, decor, overhang). Supports animated tiles (water, lava, torches).
- **`Particles`:** Small pooled emitter with presets: fireflies, leaves, spores, fog wisps, bubbles, sand gusts, heat shimmer, snow, embers, stars, dust puff, loot sparkle, pixel-dissolve.
- **`Lighting`:** Time-of-day colour matrix plus additive light sprites, with night intensity.
- **UI primitives:**
  - `PixelPanel` (9-slice)
  - `PixelButton` (pressed state is 1 px down)
  - `PixelText`
  - `DialogBox` (typewriter effect, tap to complete, portrait)
  - `HPBar` (chunky segments, trailing "ghost" damage)
  - `CountUp` (for XP and credits)
- **Transitions:** Iris wipe and pixel-dissolve between map and cutscenes.
- **Motion and performance:**
  - Respect `AccessibilityInfo.isReduceMotionEnabled()`: particles off, no camera shake, instant transitions.
  - Pause all animation when the Quest tab or screen isn't focused, or the app is backgrounded.
  - Target 60 fps on iPhone; 30 fps fallback if frame time exceeds budget.

**Acceptance:** A hidden dev-only `QuestPlayground` screen demos every primitive. No blurry pixels at any scale.

---

## Q5 — Biome content (`src/game/content/biomes/`)

Each biome file defines:
- palette
- parallax layers
- tilemap (hand-placed landmarks plus seeded procedural decoration, deterministic per biome)
- path spline
- node positions (6 mobs, camp, boss gate)
- NPC placements
- critters
- ambient particle presets
- mob roster (3)
- boss, with its twist
- ~8 short lore/tip lines

Lore/tip lines are warm, never guilt-inducing, and at most 12 words.

### Biome table

| # | Biome | Palette mood | Mobs | Boss (what it represents) | Twist (only while this biome is active) | Ambient |
|---|---|---|---|---|---|---|
| 1 | **Whispering Forest** | mossy greens, warm light | Moss Slime, Thorn Sprite, Mushroom Imp | **The Fog Wisp** (mental fog) | Tutorial: boss HP 120. A fog overlay visibly clears as its HP drops. | fireflies at night, falling leaves, rabbits, birds |
| 2 | **Mirewood Swamp** | teal, murky violet | Bog Toad, Leech Wraith, Lantern Eel | **The Doomscroll Hydra** (distraction) | If sessions record pauses: each pause beyond 2 in a session reduces that session's damage by 10%, floor 50%, and a head visibly regrows. If pauses aren't tracked, the twist becomes: sessions of 25+ unbroken minutes deal ×1.2. | low fog layers, bubbles, frogs, lanterns |
| 3 | **Sunscorch Desert** | ochre, coral, deep blue sky | Sand Scarab, Dust Devil, Cactus Golem | **The Mirage Djinn** (busywork) | Sessions with ≥1 completed weak point deal ×1.5; sessions without deal ×0.75. | heat shimmer, sand gusts, lizards |
| 4 | **Frostpeak** | ice blues, white, pink dawn | Frost Bat, Ice Golemling, Snow Wolf | **The Frozen Titan** (inertia) | The first 10 minutes of each day's first qualifying session deal ×2. | snow, aurora at night, foxes |
| 5 | **Iron Kingdom** | stone grey, royal red, gold | Rogue Knight, Paper Golem, Crow Herald | **King Tomorrow** (procrastination) | Sessions started before 12:00 local deal ×1.25. | fluttering banners, torches, villagers, pigeons |
| 6 | **Emberdeep Volcano** | charcoal, magma orange | Magma Slug, Ash Imp, Cinder Hound | **The Burnout Drake** (overwork) | Days with 60–240 effective minutes deal ×1.3. A session on the day after a zero-minute rest day gets a "Rested" ×1.2 buff. The boss *cannot* be beaten by grinding. | embers, lava glow, ash |
| 7 | **Astral Citadel** | indigo, starlight, cyan crystal | Star Moth, Void Shade, Clockwork Sentinel | **The Hollow Echo** (self-doubt) | Sessions whose chest is claimed with a chronicle entry deal ×1.25. During the fight, its dialogue quotes the player's own past chronicle entries back as encouragement, e.g. *"You wrote: 'shipped the OTP flow.' You can do this."* | stars, floating islands, crystal hum |

### Bosses
Each boss gets:
- 64×64 idle (4 frames), hurt, and a staggered "low HP" pose
- a defeat animation: flash, then pixel-dissolve into loot
- 3 pre-fight lines and 1 defeat line

**Acceptance:** All 7 biomes render, scroll smoothly, and pass a test asserting node counts, a valid spline, and resolvable asset IDs.

---

## Q6 — The Quest tab and journey map

### Tab
- Add a **Quest** tab with a stroke-based controller icon matching Adet's icon system and checkmark style. Include an accessibility label.
- Show a small dot badge when `hasFreshChest` is true.

### Map layout: a vertical ascending journey
- Biomes are stacked bottom to top: Forest at the bottom, Astral Citadel at the summit.
- A winding path climbs through them.
- There are no choices to make. What's next is always obvious. The world is alive when you want to explore it.
- **On open:** The camera centres on the avatar.
- **Reveal moment:** If progress advanced since the last visit (store `lastSeenProgress` locally), play a short sequence: the avatar walks node to node with dust puffs, defeated mobs pop into sparkles, and the camera eases along. It's skippable with a tap. This is the core delight moment. Keep it under 4 seconds.
- **Scrolling:** Vertical pan with momentum and rubber-band at the ends. No pinch-zoom; scale stays fixed.
- **Future biomes:** Visible but dimmed and desaturated, with a closed gate. Nothing to do there yet, but they're beautiful to look at.

### Nodes
- Mob nodes show the mob sprite idling. Tap for a tiny panel: sprite, HP bar, no prose.
- Defeated nodes show a small grave or flag.
- The boss gate shows the boss looming behind it, with its HP bar when active.

### The camp
The camp travels with the player, always at their current node. It includes:
- a **campfire** that mirrors today's streak state: bright when today's goal is done, soft embers when "at risk". Purely visual, no text.
- the NPCs from Q7
- the pile of **unopened chests**
- the player's companion, if owned

### Critters and villagers
- Critters wander within a radius and react to taps: hop, flee, emote.
- Villagers show a one-line bubble when tapped (biome lore/tips).

### Top HUD
A slim pixel HUD shows: avatar portrait, level, a thin XP bar, and credits. Nothing else.

**Acceptance:**
- 60 fps scrolling on a recent iPhone.
- The reveal plays correctly after a new session.
- There's an empty state for brand-new users. The onboarding cutscene (Q9) handles the first open.

---

## Q7 — NPCs as features

Tapping an NPC opens a `DialogBox`, then a pixel sheet. Suggested names nod to Adet's Kazakh roots; keep them easy to rename in one content file.

**Aqyl the Owl — Sage (ақыл, "wisdom")**
- Shows up to 3 suggested weak points for the player's most-used habits (from Q11), each with "pin" (adds a `task`) and "dismiss".
- Shows a one-line pattern insight, e.g. "You fight best before noon."

**The Quest Board (a notice-board object at camp)**
- Per-habit list of open `task` items: add, reorder, done, delete (soft).
- This is where the player predetermines future tasks.
- Show at most 3 pinned tasks per habit on the board face; the full list opens on tap.

**Saudager the Fox — Merchant (саудагер, "merchant")**
- Spend credits. Each purchase writes a `purchase` item.
- Stock:
  - **Streak freeze:** 60 credits, maximum 2 bought per calendar month. It must integrate with the existing freeze system as additional freezes for that month. Don't rewrite freeze logic; extend its available-count input.
  - **Avatar cosmetics:** cloaks, helmets, banners, weapon skins.
  - **Companions:** fox kit, owlet, slime pet, ember sprite.
  - **Campfire styles.**
- Cosmetics are purely visual. Some are rank-gated, which gives rank promotions tangible unlocks.
- Show the balance, and disable unaffordable items gently (greyed out, no scolding).

**Hatshy the Tortoise — Scribe (хатшы, "scribe/secretary")**
- The chronicle: a scrollable parchment of chronicle entries, grouped by week, each tagged with its habit icon and the enemy defeated that session.
- Tap an entry to edit it.
- Also holds: the list of claimable unopened chests, Credits (from Q3), and Quest settings (Q12).

**Acceptance:**
- Each NPC is reachable within 2 taps of opening the Quest tab.
- No feature exists outside an NPC or object.

---

## Q8 — Session integration (the loop)

### Start
In the existing session start flow, add a collapsed **weak points** row (sword icon plus a count).
- Expanded, it shows that habit's top open tasks, with up to 3 preselected by order, plus a quick-add field.
- Selections create `planned_for` links.
- Starting without touching it is exactly as fast as today.

### During
On the existing timer screen, add a slim **battle strip**, no taller than about 72 px, placed so it never crowds the timer:
- the current enemy idling
- a chunky HP bar that drains live as minutes accrue (preview only; real values come from derivation after the session)
- a tiny hit sparkle once per minute

No sound, no flashing, and reduce-motion is respected. Tap the strip to see the enemy's name. That's all.

### End
- **Sessions of 10+ minutes** end with the **Loot sheet**. The chest bounces in and shows:
  - the planned weak points as checkboxes
  - one text field with a quill icon and no label text
  - **Open** — enabled once at least one box is ticked or some text is entered. The chest bursts open, crits hit the enemy with screen shake and white flash, XP and credits count up, and haptics fire.
  - **Later** — the chest goes to the camp pile. No guilt text.
- Opening writes:
  - a `chest_claim` item
  - a `log` item, even if the text is empty but boxes were ticked
  - `completed_in` links
  - the ticked tasks' status → `done`
- **Sessions under 10 minutes** end exactly as today, with no chest.
- If the loot pushes a level-up or a boss defeat, chain straight into the matching ceremony (Q9).

### Existing notes
If sessions already have a notes field, the chronicle entry must not duplicate it. Either migrate the notes UI to the chronicle, or show existing notes as the chronicle entry's prefill. Pick the cleaner option and document it.

**Acceptance:**
- End-to-end manual test: plan 2 tasks → run a 12-minute session → tick 1 → write a line → see crit, XP, credits → see the entry at the Scribe → see the avatar advance on the map.

---

## Q9 — Ceremonies

Every ceremony is skippable with a tap and plays at most once per event. Track played events locally, keyed by event ID.

**Level-up**
- Short burst, "LV N" in the pixel font, XP bar refill.

**Rank promotion**
- Full-screen cutscene with an iris wipe: the avatar kneels, a banner unfurls, the new gear tier materialises piece by piece, and the title appears.
- Show newly unlocked shop items as small icons at the bottom.

**Boss defeat**
- Boss staggers, flashes, then pixel-dissolves.
- Loot rains down.
- Aqyl gives a 2–3 sentence **battle report**: an AI recap of that biome's chronicle entries (Q11), or a template fallback.
- The gate to the next biome opens, and the camera pans up to reveal it with its palette fading in.

**Onboarding (first Quest-tab open)**
- 3 panels:
  1. The avatar wakes by a campfire in the Whispering Forest.
  2. Aqyl: "Focus is your blade." A 1-line explanation of the chest.
  3. The rank reveal from existing history: "Your past focus already made you a Knight."
- Writes `quest_meta.startedAt`.

**Acceptance:** Each ceremony looks polished at 3× and 4× scale, and reduce-motion variants exist.

---

## Q10 — Character sheet

Tapping the avatar, on the map or in the HUD, opens the character sheet:
- a large animated avatar wearing current gear
- title and level with an XP bar
- **skills**: each habit shown as an icon, skill level and thin bar
- gear slots, where tapping equips owned cosmetics
- a companion slot
- trophy shelf: one mini sprite per defeated boss

No other stats. Stats stay on the Stats screen, and nothing already shown there is duplicated.

**Avatar tiers (7)**

| Tier | Look |
|---|---|
| 0 | traveller's cloak |
| 1 | squire tabard |
| 2 | knight armour |
| 3 | captain's cape |
| 4 | warden's lantern |
| 5 | lord's crown |
| 6 | legend's aura |

Owned cosmetics layer on top. Build the avatar from layered sprites (body, outfit, head, back, hand, companion) so gear composes cleanly.

**Acceptance:** All 7 tiers render correctly, and cosmetics layer without clipping.

---

## Q11 — Aqyl AI (Cloudflare Worker + client with fallback)

### Worker (`worker/`)
- A Cloudflare Worker (TypeScript, Wrangler) that verifies the Supabase JWT, then calls the Claude API.
- Configuration:
  - API key via `wrangler secret put ANTHROPIC_API_KEY`
  - `SAGE_MODEL` env var, default `claude-haiku-4-5-20251001`
- Endpoints:
  - `POST /sage/suggest` — input: last ~20 chronicle entries plus open tasks per habit. Output: strict JSON `{ suggestions: [{ habitId, title }] (≤3), insight: string (≤12 words) }`.
  - `POST /sage/recap` — input: the chronicle entries from one biome run. Output: `{ recap: string }` (2–3 warm sentences in Aqyl's voice).
- System prompts enforce: warm, concise, never guilt-inducing, JSON only.
- Rate limit per user (simple KV counter).
- Don't deploy. Include `worker/README.md` with deploy steps.

### Client (`src/services/sage.ts`)
- Reads `EXPO_PUBLIC_SAGE_URL`.
- AI is **opt-in**. The toggle lives in Quest settings and defaults to off. The first time it's enabled, show a one-line privacy note: "Chronicle entries are sent to generate suggestions."
- Cache responses per day.
- Timeout after 8 s.

### Rule-based fallback (always available)
- **Suggestions:** the oldest open tasks per most-used habit, plus "continue X" derived from the last chronicle entry's habit.
- **Insight:** a computed best time-of-day or best weekday, from session data.
- **Recap:** a template built from counts, e.g. "You faced the Hydra across 6 sessions and 9 tasks. Well fought."

**Acceptance:** Aqyl works fully offline via the fallback. With the worker configured, AI responses appear, and malformed JSON falls back gracefully.

---

## Q12 — Audio, haptics, settings

**Audio**
- Use `expo-audio`, with SFX from the primary pack if present: UI clicks, chest open, hit, level-up, boss defeat, gate open.
- Defaults:
  - SFX on in the Quest tab and Loot sheet only
  - **never** during a running timer
  - music off (optional ambient per-biome loop, toggle in settings)

**Haptics**
- Use `expo-haptics`: light on crit hits and count-up ticks, success on boss defeat and rank up.

**Quest settings (at the Scribe)**
- SFX, music, haptics, AI Sage, battle strip on the timer (on/off), reduce motion (follows system by default), NPC names (reset).

**Acceptance:** Every setting persists via `quest_meta.settings` and applies instantly.

---

## Q13 — Polish, performance, accessibility, QA, PR

**Polish pass**
- Check every screen at 3× and 4× scale in light and dark system themes.
- The Quest world has its own palette; the surrounding RN chrome follows the Adet theme.
- No blurry pixels, consistent outlines, no text overflow in panels.

**Performance**
- Profile map scroll and the reveal.
- Lazy-decode atlases so only visible biomes plus neighbours are in memory.
- Keep the JS bundle growth reasonable, and report its size delta in the PR.

**Accessibility**
- Labels on all nodes, NPCs, chests and buttons.
- Dialog text readable by VoiceOver.
- Tap targets of 44 pt or more even when the sprites are smaller.

**Edge cases**
- Offline play, sync conflicts on `quest_meta` (last-write-wins is fine), timezone travel, a deleted habit that still has skill XP (show it as "retired"), a user with zero sessions, a user with years of history.

**Docs**
- `docs/quest/README.md`: the loop, balance table, how to add a biome, the asset pipeline, and licensing.

**PR**
- Open the PR with:
  - the ticket checklist
  - **"Run migration NNN in the Supabase SQL Editor before testing"** at the very top
  - assumptions
  - screenshots from the dev playground if you can capture them
  - manual test steps for Expo Go

**Final acceptance:** A new session, run end to end in Expo Go, produces a delightful, calm, polished loop. The app feels *more* focused, not busier.
