import AsyncStorage from '@react-native-async-storage/async-storage';

import { clampReminderHours, DEFAULT_REMINDER_HOURS } from '../domain/reminder';

// Device-only preferences: never synced and kept across sign-outs.
const KEY = 'streak-settings-v1';

export interface AppSettings {
  /** Hours of tracked time before the "Still working?" reminder; 0 = off. */
  reminderHours: number;
}

export const DEFAULT_SETTINGS: AppSettings = { reminderHours: DEFAULT_REMINDER_HOURS };

export async function loadSettings(): Promise<AppSettings> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const saved = raw ? JSON.parse(raw) : null;
    if (!saved || typeof saved !== 'object') return DEFAULT_SETTINGS;
    return { reminderHours: clampReminderHours(saved.reminderHours) };
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
