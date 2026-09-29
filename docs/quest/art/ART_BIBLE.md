# Quest art bible

The rules every sprite follows, whether it comes from a pack or from Adet's
stand-in generator. The tests in `src/game/assets/` check the measurable ones.

## Density and scale

- **Base tile: 16 px.** Ground tiles are 16×16. A sprite's pixels are 1:1 with
  the tile's pixels: **never upscale** a smaller sprite to pass as a bigger one.
- **Characters** (avatar, villagers): 20×26. **Mobs, NPCs, companions:** 16×16.
  **Bosses:** 64×64, drawn natively at that size (32 or 48 are also allowed if
  drawn natively).
- The renderer draws at the largest **integer** scale that fits the screen (3×
  or 4× on iPhone), with nearest-neighbour sampling and positions snapped to
  the game-pixel grid.
- A pack whose density doesn't match (8 px, 32 px tiles) is rejected, not mixed
  in. Proportion counts too: a pack's 16 px trees next to our 26 px people would
  be shorter than a person, so they aren't used.

## Colour

- **One palette per biome, 16–24 colours** (`src/game/content/palettes.ts`), in
  dark → light ramps: ground, path, foliage, trunk, rock, liquid, two accents,
  one warm light and a hue-shifted near-black outline.
- Pack sprites are recoloured into their biome's palette so mixed packs share one
  colour language (`scripts/art-sources.ts`):
  - **tone-preserving** (`ramp`): the sprite's colours, ranked dark → light, are
    spread over part of one ramp. Used for ground and path, so a two-tone tile
    keeps its contrast in the biome's own mid tones.
  - **nearest colour** (`palette` alone): each pixel takes the closest palette
    colour.
- Shared sprites (chests, UI) keep their pack colours; they appear in every biome.

## Outline, light and shadow

- **Outlines:** characters, creatures and props have a dark outline; ground,
  path and liquid tiles don't. Within a category, all outlined or all
  outline-free (Roguelike Characters was rejected for this).
- **Light** comes from the top left. Warm light sprites (torches, lanterns, the
  campfire) are drawn additively; the time-of-day grade tints the world.
- **Shadows** are one pixel-ellipse drop shadow per standing thing (`prop.shadow`),
  never baked into the sprite.

## Anchors and animation

- Anchors are the feet: bottom centre (`[w/2, h]`) unless a sprite says
  otherwise, so every frame of an animation shares one baseline and nothing
  jitters.
- Idle animations are 2–4 frames at 6–8 fps. Hit flash is a generated white
  silhouette (`@flash`), mirrored copies are generated (`@flip`), and motion
  like a hop or bounce can be composed by moving a frame (`offsets`), never by
  inventing pixels.
- Frames of one sprite are the same size.

## Consistency over coverage

A category is replaced only if it can be covered **consistently**, across all 7
biomes after recolouring. Half a set would mix two styles in one scene or one UI
row, so it stays on stand-ins until a pack covers all of it. Each such case is in
`assets/game/needs-art.json` with the reason.
