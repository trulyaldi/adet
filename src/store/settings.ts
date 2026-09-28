import AsyncStorage from '@react-native-async-storage/async-storage';

import { clampBudgetMin, clampPlanCap, DEFAULT_BUDGET_MIN, DEFAULT_PLAN_CAP } from '../domain/plan';
import { clampReminderHours, DEFAULT_REMINDER_HOURS } from '../domain/reminder';

// Device-only preferences: never synced and kept across sign-outs.
const KEY = 'streak-settings-v1';

export interface AppSettings {
  /** Hours of tracked time before the "Still working?" reminder; 0 = off. */
  reminderHours: number;
  /** Monday dkey of the last weekly recap seen or dismissed on this device. */
  recapSeenWeek: string | null;
  /** The one-time "remove sessions under a minute" prompt was answered on this device. */
  shortSessionsReviewed: boolean;
  /** Daily time budget in minutes: a day's plan never adds up to more (full lengths). */
  budgetMin: number;
  /** Most habits in a day's plan. */
  planCap: number;
  /** Ask light / normal / heavy on the first open of each day. */
  dailyPrompt: boolean;
  /** dkey a learned-capacity suggestion was last dismissed (asked again two weeks later). */
  learnedDismissed: string | null;
  /** The target-vs-capacity conflict last dismissed (TargetCheck.signature). */
  targetCheckDismissed: string | null;
  /** The one-time "welcome to the new Adet" flow was seen on this device. */
  welcomeSeen: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  reminderHours: DEFAULT_REMINDER_HOURS,
  recapSeenWeek: null,
  shortSessionsReviewed: false,
  budgetMin: DEFAULT_BUDGET_MIN,
  planCap: DEFAULT_PLAN_CAP,
  dailyPrompt: true,
  learnedDismissed: null,
  targetCheckDismissed: null,
  welcomeSeen: false,
};

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
      shortSessionsReviewed: saved.shortSessionsReviewed === true,
      budgetMin: clampBudgetMin(saved.budgetMin),
      planCap: clampPlanCap(saved.planCap),
      dailyPrompt: saved.dailyPrompt !== false,
      learnedDismissed: typeof saved.learnedDismissed === 'string' ? saved.learnedDismissed : null,
      targetCheckDismissed: typeof saved.targetCheckDismissed === 'string' ? saved.targetCheckDismissed : null,
      welcomeSeen: saved.welcomeSeen === true,
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
