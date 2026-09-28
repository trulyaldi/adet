// Done marks: a check-off habit tapped done, or "done" tapped on a timed
// habit's session. A timed habit also counts as done once the day's time on
// it reaches its share of the plan, with no mark needed.

import { Habit, Mark, PersistedState } from './types';

export function markId(habitId: string, day: string): string {
  return `${habitId}:${day}`;
}

export function isCheck(h: Pick<Habit, 'kind'>): boolean {
  return h.kind === 'check';
}

/** habitId → set of dkeys marked done. */
export type MarkIndex = Map<string, Set<string>>;

export function markIndex(marks: Mark[]): MarkIndex {
  const out: MarkIndex = new Map();
  for (const m of marks) {
    let s = out.get(m.habitId);
    if (!s) out.set(m.habitId, (s = new Set()));
    s.add(m.day);
  }
  return out;
}

export function hasMark(idx: MarkIndex, habitId: string, day: string): boolean {
  return idx.get(habitId)?.has(day) ?? false;
}

/** Mark a habit done on `day` (no-op if it already is). */
export function addMark(data: PersistedState, habitId: string, day: string): PersistedState {
  const id = markId(habitId, day);
  if (data.marks.some((m) => m.id === id)) return data;
  return { ...data, marks: [...data.marks, { id, habitId, day }] };
}

/** Clear a habit's done mark on `day` (no-op if there is none). */
export function removeMark(data: PersistedState, habitId: string, day: string): PersistedState {
  const id = markId(habitId, day);
  if (!data.marks.some((m) => m.id === id)) return data;
  return { ...data, marks: data.marks.filter((m) => m.id !== id) };
}

/**
 * Done for the day: marked, or (timed) the day's time reached its share.
 * A share of 0 means nothing was asked of it, so only a mark counts.
 */
export function isDone(h: Habit, idx: MarkIndex, day: string, daySec: number, shareSec: number): boolean {
  if (hasMark(idx, h.id, day)) return true;
  return !isCheck(h) && shareSec > 0 && daySec >= shareSec;
}

/** Marks moved from one habit to another (merge), keeping one per day. */
export function moveMarks(marks: Mark[], fromId: string, intoId: string): Mark[] {
  const taken = new Set(marks.filter((m) => m.habitId === intoId).map((m) => m.day));
  const out: Mark[] = [];
  for (const m of marks) {
    if (m.habitId !== fromId) out.push(m);
    else if (!taken.has(m.day)) {
      taken.add(m.day);
      out.push({ id: markId(intoId, m.day), habitId: intoId, day: m.day });
    }
  }
  return out;
}
