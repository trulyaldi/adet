import { Alert } from 'react-native';

import { activeSec } from '../domain/engine';
import { longSessionSec } from '../domain/reminder';
import { fmtHM } from '../domain/time';
import { useStreak } from './StreakStore';

/**
 * Stop the running timer. An unusually long session offers a trim before it's
 * saved. From the timer overlay this is asked while the modal is still up,
 * since iOS can't show an alert over a dismissing modal.
 */
export function useStopTimer(): () => void {
  const { data, settings, actions } = useStreak();
  return () => {
    const secs = activeSec(data.active, Date.now());
    if (secs <= longSessionSec(settings.reminderHours)) {
      actions.stopTimer({ done: true });
      return;
    }
    const tracked = fmtHM(secs);
    Alert.alert('Long session', `You tracked ${tracked}. Keep it, or set the end time?`, [
      { text: `Keep ${tracked}`, onPress: () => actions.stopTimer({ done: true }) },
      { text: 'Set end time', onPress: () => actions.stopTimer({ done: true, editAfter: true }) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };
}
