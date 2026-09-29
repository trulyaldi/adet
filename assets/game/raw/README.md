# Licensed art and audio packs (not committed)

Each pack's files live here, in `assets/game/raw/<name>/`. This folder is
gitignored except this README. What the game takes from each pack is **not**
here: it is in the committed registry, `assets/game/packs/<name>.json`
(official page, pinned download, sha256, license, and the sprite and sound
mappings).

```sh
npm run game:fetch    # download direct-download packs, check sha256, keep their licenses
npm run game:assets   # atlases (fails if a mapped pack is missing)
npm run game:audio    # sound effects (same)
npm run game:report   # docs/quest/art/INVENTORY.md and MAPPING.md
```

Packs that need a browser (itch.io) are downloaded by hand into their folder.
See `docs/quest/OWNER_ACTIONS.md`.

Rules (`docs/quest/art/ART_BIBLE.md`): one 16 px pixel density, no upscaling,
recolour to the biome palette, and only CC0, CC-BY or explicitly permissive
licenses.
