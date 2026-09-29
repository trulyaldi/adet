# What only you can do

## 1. Download Ninja Adventure (the art and music most of the stand-ins wait for)

322 sprite ids still ship Adet's original stand-in art, and the 7 biome music
loops are missing. Everything that could be fetched without a browser has been
(Kenney's CC0 packs: ground, path, chests and all 9 sound effects). The rest needs
a pack with 16 px characters, monsters, 64 px bosses, animals and music. The
spec's primary pack has all of those, but itch.io needs a click-through that a
script can't do.

1. Open **https://pixel-boy.itch.io/ninja-adventure-asset-pack** and download it
   ("Download Now"; paying is optional).
2. Unzip it to **`assets/game/raw/ninja-adventure/`** (so its own license file is
   at `assets/game/raw/ninja-adventure/<license file>`). The folder is gitignored:
   the pack itself is never committed.
3. Check its license file says CC0 (it did when the spec was written). If it
   doesn't, stop and don't use it.
4. Tell Claude "Ninja Adventure is in assets/game/raw/ninja-adventure". The next
   step is a registry entry, `assets/game/packs/ninja-adventure.json`, like the
   Kenney ones (`download: null`, the zip's sha256, the mappings), then
   `npm run game:assets`, `npm run game:report` and a contact sheet per biome.

What it could cover (all listed in `assets/game/needs-art.json`). This hasn't been checked
against the pack itself, since it couldn't be downloaded here:

| Category | Ids | Look for |
|---|---|---|
| Bosses and trophies | 35 | bosses drawn at 32–64 px that match the table in `art/MAPPING.md`, recoloured per biome |
| Mobs | 42 | monsters with 2–4 frame idle animations, close to the spec's mob names |
| NPCs | 6 | an owl, a fox and a tortoise (or the nearest animals plus a small accessory) |
| Critters and companions | 22 | small animals |
| Villagers and the avatar | 7 + 23 | layered-enough characters; the avatar may stay generated if its layers can't be matched |
| Music | 7 loops | one calm loop per biome, converted by `npm run game:audio` |

Without it, the game is complete and consistent with its stand-ins. The pack only
makes it richer.

## 2. Listen to the sounds once

Nobody has heard the nine sound effects yet. They were chosen by measurement
(short, soft, rising). `docs/quest/DEVICE_QA.md` has a row for each.

## 3. Optional: the AI Sage

Only if you want AI suggestions: run migration 007 (see `docs/quest/MIGRATIONS.md`)
and deploy the Edge Function (`supabase/functions/sage/README.md`). Quest Mode
works fully without it.

## 4. Your working tree

Your checkout at `/home/aldiyar/adet` still has the temporary QA harness
(`index.ts` deleted, `package.json` `main` → `index.tsx`, `src/qa-ceremony.tsx`).
Before pulling this branch:

```sh
git checkout -- index.ts package.json
rm index.tsx src/qa-ceremony.tsx
git pull
```

(`git pull` would stop on the modified `package.json` otherwise.)
