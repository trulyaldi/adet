// Shelf packing for the art gallery, in game pixels (pure, tested).

const GAP = 6;

/** Shelf-pack sprites (in game pixels) into rows `maxW` wide. Pure, for tests. */
export function packShelves(ids: string[], maxW: number, size: (id: string) => { w: number; h: number }) {
  const cells: { id: string; x: number; y: number; w: number; h: number }[] = [];
  let x = 0;
  let y = 0;
  let rowH = 0;
  for (const id of ids) {
    const { w, h } = size(id);
    if (x > 0 && x + w > maxW) {
      x = 0;
      y += rowH + GAP;
      rowH = 0;
    }
    cells.push({ id, x, y, w, h });
    x += Math.max(w, 24) + GAP;
    rowH = Math.max(rowH, h);
  }
  return { cells, height: y + rowH };
}

