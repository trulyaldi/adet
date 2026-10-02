// Which realms this app session has seen conquered (world-6), so a newly
// conquered realm's flag rises on the Overworld once. The first look seeds it
// silently: flags already standing don't all rise at launch. A realm that
// stops being conquered (an undo) is forgotten, so conquering it again raises
// its flag again. In memory only.

let known: Set<string> | null = null;

/** The realms conquered since the last call (none on the first). */
export function newlyConquered(conquered: readonly string[]): string[] {
  if (!known) {
    known = new Set(conquered);
    return [];
  }
  const fresh = conquered.filter((id) => !known!.has(id));
  known = new Set(conquered);
  return fresh;
}

/** Tests only. */
export function resetFlagMemory(): void {
  known = null;
}
