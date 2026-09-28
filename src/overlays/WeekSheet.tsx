import React, { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { CloseButton, Glyph, IconButton } from '../components/Glyph';
import { MiniDayRing } from '../components/MiniDayRing';
import { AnimatedBar } from '../components/motion/AnimatedBar';
import { Sheet } from '../components/Sheet';
import { DOWS } from '../domain/constants';
import { fmtDur, sayDur } from '../domain/time';
import { selectWeekView, WeekDayState } from '../domain/weekView';
import { useActions, useData, useSettings, useStoreNow, useUi } from '../store/StreakStore';
import { useDayStreak } from '../store/useDayStreak';
import { useTheme } from '../theme/ThemeProvider';

const LETTER = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SAY: Record<WeekDayState, string> = {
  complete: 'done',
  rest: 'rest day',
  free: 'nothing planned',
  today: 'today',
  past: '',
  future: 'coming up',
};

/**
 * The week at a glance: seven small segmented rings (check for complete, moon
 * for rest, a pulsing outline for today, a plain ring otherwise), then each
 * project's week toward its target. A learned capacity shows as a gentle
 * suggestion to accept or dismiss.
 */
export function WeekSheet() {
  const t = useTheme();
  const { colors, radius } = t;
  const data = useData();
  const open = useUi((u) => u.weekOpen);
  const now = useStoreNow();
  const settings = useSettings();
  const actions = useActions();
  const streak = useDayStreak();
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    if (open) setOffset(0);
  }, [open]);
  const model = useMemo(
    () => (open ? selectWeekView(data, now, offset, streak.marks, settings.learnedDismissed) : null),
    [open, data, now, offset, streak.marks, settings.learnedDismissed]
  );

  return (
    <Sheet visible={open} onClose={actions.closeWeek} maxHeightPct={0.88}>
      {model && (
        <View style={{ gap: 18, paddingTop: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, zIndex: 10 }}>
            <IconButton label="Earlier week" name="chevronLeft" size={18} color={colors.sub} bg={colors.well} diameter={34} disabled={!model.hasEarlier} onPress={() => setOffset((o) => o + 1)} />
            <Text style={{ fontSize: 16, fontWeight: '800', color: colors.ink, fontVariant: ['tabular-nums'] }}>{model.rangeLabel}</Text>
            <IconButton label="Later week" name="chevronRight" size={18} color={colors.sub} bg={colors.well} diameter={34} disabled={offset === 0} onPress={() => setOffset((o) => Math.max(0, o - 1))} />
            <View style={{ flex: 1 }} />
            <CloseButton onPress={actions.closeWeek} />
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            {model.days.map((d) => (
              <View
                key={d.key}
                accessible
                accessibilityLabel={`${FULL[d.weekday]} ${d.date}${SAY[d.state] ? ', ' + SAY[d.state] : ''}${d.trackedSec >= 60 ? ', ' + sayDur(d.trackedSec) : ''}`}
                style={{ alignItems: 'center', gap: 6 }}
              >
                <Text style={{ fontSize: 12, fontWeight: '800', color: d.state === 'today' ? colors.brand : colors.sub }}>{LETTER[d.weekday]}</Text>
                <MiniDayRing segs={d.segs} state={d.state} size={42} />
                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.muted, fontVariant: ['tabular-nums'], height: 14 }}>{d.trackedSec >= 60 ? fmtDur(d.trackedSec) : ''}</Text>
              </View>
            ))}
          </View>

          <View style={{ gap: 14 }}>
            {model.projects.map((p) => {
              const sw = t.swatch(p.color);
              return (
                <View key={p.projectId} style={{ gap: 6 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: sw.base }} />
                    <Text numberOfLines={1} style={{ flex: 1, fontSize: 14.5, fontWeight: '800', color: colors.ink }}>
                      {p.name}
                    </Text>
                    <Text style={{ fontSize: 13.5, fontWeight: '800', color: colors.sub, fontVariant: ['tabular-nums'] }}>
                      {fmtDur(p.sec)} / {fmtDur(p.targetH * 3600)}
                    </Text>
                    {p.targetH > 0 && p.sec >= p.targetH * 3600 && <Glyph name="done" size={16} color={t.dark ? sw.base : sw.dark} label="Target reached" />}
                  </View>
                  <AnimatedBar value={p.targetH > 0 ? p.sec / (p.targetH * 3600) : 0} color={sw.base} track={sw.light} height={10} />
                </View>
              );
            })}
          </View>

          {model.suggestion && (
            <Animated.View entering={FadeIn.delay(300)} style={{ backgroundColor: colors.brandLight, borderRadius: radius.xl, padding: 14, gap: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Glyph name="sparkle" size={18} color={colors.brand} bg={colors.brandLight} label="Suggested capacity from your last weeks" />
                <View style={{ flex: 1 }} />
                <IconButton label="Dismiss suggestion" name="close" size={16} color={colors.sub} bg={colors.card} diameter={34} onPress={actions.dismissLearned} />
                <IconButton label="Use suggested capacity" name="done" size={18} color={colors.onBrand} bg={colors.brand} edge={colors.brandDark} variant="chunky" diameter={38} quiet onPress={() => actions.acceptLearned(model.suggestion!)} />
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                {model.suggestion.map((m, i) => {
                  const cur = data.prefs.capacityMin[i];
                  return (
                    <View key={i} accessible accessibilityLabel={`${FULL[(i + 1) % 7]}: ${sayDur(cur * 60)} now, suggested ${sayDur(m * 60)}`} style={{ alignItems: 'center', gap: 3, width: 42 }}>
                      <Text style={{ fontSize: 11, fontWeight: '800', color: colors.sub }}>{DOWS[i][0]}</Text>
                      <Text style={{ fontSize: 13, fontWeight: '800', color: colors.ink, fontVariant: ['tabular-nums'] }}>{fmtDur(m * 60)}</Text>
                      <Text style={{ fontSize: 10.5, fontWeight: '700', color: colors.muted, fontVariant: ['tabular-nums'] }}>{fmtDur(cur * 60)}</Text>
                    </View>
                  );
                })}
              </View>
            </Animated.View>
          )}
        </View>
      )}
    </Sheet>
  );
}
