# Licensed art packs

Drop a pack in a folder here (`assets/game/raw/<pack-name>/`) with a
`pack.json` that maps the game's logical sprite ids to frames in its files,
then run `npm run game:assets`. Ids a pack doesn't map keep the original
placeholder art. The list of ids is `REQUIRED_IDS` in
`src/game/assets/manifest.ts`.

```json
{
  "name": "Ninja Adventure",
  "author": "Pixel-boy & AAA",
  "license": "CC0",
  "url": "https://pixel-boy.itch.io/ninja-adventure-asset-pack",
  "tileSize": 16,
  "sprites": {
    "mob.forest.slime.idle": { "file": "Actor/Monster/Slime/Slime.png", "rects": [[0, 0, 16, 16], [16, 0, 16, 16]], "fps": 4, "loop": true, "atlas": "forest" }
  }
}
```

Rules:
- **One pixel density.** `tileSize` must be 16. Other packs are skipped and
  flagged in `assets/game/CREDITS.md`, never mixed in.
- Frames of one sprite must share a size. Use `anchor: [x, y]` for anything
  not standing on its bottom centre.
- Licenses other than CC0 / CC-BY / explicitly permissive are flagged in
  CREDITS.md for review.
- Packs themselves are not committed unless their license allows it.
