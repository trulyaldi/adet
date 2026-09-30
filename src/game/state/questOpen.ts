// A request, from outside the Quest tab, to open one of its sheets once it is
// showing (the Almanac's link to the Trail). Read once by the Quest screen.

let pending: string | null = null;
const listeners = new Set<() => void>();

export function requestQuestSheet(id: 'trail' | 'quicklog'): void {
  pending = id;
  listeners.forEach((l) => l());
}

/** The pending sheet, cleared as it is taken. */
export function takeQuestSheet(): string | null {
  const id = pending;
  pending = null;
  return id;
}

export function onQuestSheetRequest(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
