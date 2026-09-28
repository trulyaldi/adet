import { useEffect, useMemo, useRef } from 'react';

import { selectToday } from '../domain/day';
import { newBadges, qualifiedBadges } from '../domain/milestones';
import { useTheme } from '../theme/ThemeProvider';
import { useStreak } from './StreakStore';
import { TargetWatcher } from './TargetWatcher';
import { usePlanStreak } from './usePlanStreak';

/**
 * Milestones: badges earned since the last look are recorded and queued for
 * their celebration. Whatever was already reached when the redesign arrived
 * is recorded quietly, once.
 */
function MilestoneWatcher() {
  const { data, now, ready, actions } = useStreak();
  const streak = usePlanStreak().current;
  const minute = Math.floor(now / 60_000);
  useEffect(() => {
    if (!ready) return;
    const t = Date.now();
    if (!data.badgesPrimed) {
      // Nothing yet (e.g. a new device before its first pull): wait.
      if (!data.sessions.length) return;
      // History arrived (an upgrade, or a pull): record what's reached, quietly.
      // A single session from today is a brand-new start, and gets its moment.
      const today = new Date(t).toDateString();
      const fresh = data.sessions.length === 1 && new Date(data.sessions[0].start).toDateString() === today;
      if (!fresh) {
        actions.earnBadges(qualifiedBadges(data, streak, t), false);
        return;
      }
    }
    const ids = newBadges(data, streak, t);
    if (ids.length) actions.earnBadges(ids, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, data, streak, minute]);
  return null;
}

/** The day's plan completing while the app is open: jingle, confetti in today's colors, companion cheers. */
function DayWatcher() {
  const { data, now, actions } = useStreak();
  const t = useTheme();
  const minute = Math.floor(now / 60_000);
  const model = useMemo(() => selectToday(data, Date.now()), [data, minute]);
  const prev = useRef<{ day: string; complete: boolean } | null>(null);
  useEffect(() => {
    const was = prev.current;
    prev.current = { day: model.day, complete: model.complete };
    if (!was || was.day !== model.day || was.complete || !model.complete) return;
    const colors = [...new Set(model.items.map((i) => t.swatch(i.color).base))];
    actions.dayCompleted(colors.length ? colors : [t.colors.brand]);
  }, [model, actions, t]);
  return null;
}

/** Everything that reacts to progress in the background of the app. */
export function Watchers() {
  return (
    <>
      <TargetWatcher />
      <MilestoneWatcher />
      <DayWatcher />
    </>
  );
}
