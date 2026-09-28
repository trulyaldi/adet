// Schedules the local "Still working on <habit>?" notification. There is at
// most one, under a fixed identifier; the store calls syncReminder whenever the
// running timer (local or synced from another device) or the setting changes.

// expo-notifications loads on first use, not at startup (see STARTUP_DELAY_MS).
type NotificationsModule = typeof import('expo-notifications');

const ID = 'long-timer-reminder';

/** How long after launch the first reminder update waits, off the startup path. */
const STARTUP_DELAY_MS = 1000;

let mod: NotificationsModule | null = null;

function notifications(): NotificationsModule {
  if (!mod) {
    mod = require('expo-notifications') as NotificationsModule;
    // Show the reminder even while the app is open.
    mod.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  }
  return mod;
}

/** Ask for notification permission if it hasn't been decided yet. Resolves to whether it's granted. */
export async function requestReminderPermission(): Promise<boolean> {
  try {
    const Notifications = notifications();
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
// The chain starts shortly after launch, so the first screen isn't waiting on it.
let queue: Promise<void> = new Promise((resolve) => setTimeout(resolve, STARTUP_DELAY_MS));

/** Replace any scheduled reminder with `req` (skipped if in the past or permission is missing). */
export function syncReminder(req: ReminderRequest): void {
  queue = queue.then(() => apply(req)).catch(() => {});
}

async function apply({ fireAt, habitName, hours }: ReminderRequest): Promise<void> {
  const Notifications = notifications();
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
