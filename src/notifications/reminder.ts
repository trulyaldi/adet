// Schedules the local "Still working on <habit>?" notification. There is at
// most one, under a fixed identifier; the store calls syncReminder whenever the
// running timer (local or synced from another device) or the setting changes.

import * as Notifications from 'expo-notifications';

const ID = 'long-timer-reminder';

// Show the reminder even while the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** Ask for notification permission if it hasn't been decided yet. Resolves to whether it's granted. */
export async function requestReminderPermission(): Promise<boolean> {
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    return (await Notifications.requestPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

export interface ReminderRequest {
  /** Epoch ms, or null to cancel. */
  fireAt: number | null;
  habitName: string;
  hours: number;
}

// Calls are chained so a quick start/pause/stop can't reorder cancel and schedule.
let queue: Promise<void> = Promise.resolve();

/** Replace any scheduled reminder with `req` (skipped if in the past or permission is missing). */
export function syncReminder(req: ReminderRequest): void {
  queue = queue.then(() => apply(req)).catch(() => {});
}

async function apply({ fireAt, habitName, hours }: ReminderRequest): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(ID);
  if (fireAt === null || fireAt <= Date.now()) return;
  const { granted } = await Notifications.getPermissionsAsync();
  if (!granted) return;
  await Notifications.scheduleNotificationAsync({
    identifier: ID,
    content: {
      title: `Still working on ${habitName}?`,
      body: `Your timer has been running for ${hours} hour${hours === 1 ? '' : 's'}.`,
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(fireAt) },
  });
}
