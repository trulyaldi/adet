import AsyncStorage from '@react-native-async-storage/async-storage';

import { CeremonyMarks } from '../../domain/game/ceremonies';

const key = (userId: string) => `adet.quest.ceremonyMarks.v1:${userId}`;

export function parseCeremonyMarks(raw: string | null): CeremonyMarks | null {
  try {
    const v = raw ? JSON.parse(raw) : null;
    if (!v || !Number.isInteger(v.level) || !Number.isInteger(v.rank) || !Array.isArray(v.bosses) || !Number.isInteger(v.ascensions)) return null;
    return { level: Math.max(1, v.level), rank: Math.max(0, v.rank), bosses: v.bosses.filter((b: unknown) => typeof b === 'string'), ascensions: Math.max(0, v.ascensions) };
  } catch { return null; }
}

export async function loadCeremonyMarks(userId: string): Promise<CeremonyMarks | null> {
  return parseCeremonyMarks(await AsyncStorage.getItem(key(userId)));
}

export function saveCeremonyMarks(userId: string, marks: CeremonyMarks): void {
  AsyncStorage.setItem(key(userId), JSON.stringify(marks)).catch(() => {});
}

/** Forget this device's marks (dev QA). The host then reseeds silently: nothing replays. */
export function clearCeremonyMarks(userId: string): void {
  AsyncStorage.removeItem(key(userId)).catch(() => {});
}
