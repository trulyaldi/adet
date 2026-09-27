import AsyncStorage from '@react-native-async-storage/async-storage';

import { clampReminderHours, DEFAULT_REMINDER_HOURS } from '../domain/reminder';

// Device-only preferences: never synced and kept across sign-outs.
const KEY = 'streak-settings-v1';

export interface AppSettings {
  /** Hours of tracked time before the "Still working?" reminder; 0 = off. */
  reminderHours: number;
  /** Monday dkey of the last weekly recap seen or dismissed on this device. */
  recapSeenWeek: string | null;
}

export const DEFAULT_SETTINGS: AppSettings = { reminderHours: DEFAULT_REMINDER_HOURS, recapSeenWeek: null };

export async function loadSettings(): Promise<AppSettings> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const saved = raw ? JSON.parse(raw) : null;
    if (!saved || typeof saved !== 'object') return DEFAULT_SETTINGS;
    return {
      reminderHours: clampReminderHours(saved.reminderHours),
      recapSeenWeek:
        typeof saved.recapSeenWeek === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(saved.recapSeenWeek)
          ? saved.recapSeenWeek
          : null,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // ignore write errors (parity with saveState)
  }
}
