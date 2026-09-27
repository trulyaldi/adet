import React, { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';

import { lastCompletedWeekStart, recapSummary, recapToShow } from '../domain/recap';
import { useStreak } from '../store/StreakStore';
import { colors, radius, shadowCard } from '../theme/tokens';

/**
 * Last week's recap, offered once per week on this device (see recapToShow).
 * Opening the details or dismissing marks the week as seen.
 */
export function RecapCard() {
  const { data, now, settings, actions } = useStreak();
  const lastWeek = lastCompletedWeekStart(now);
  // Recompute only when data, the week, or the seen state changes, not every
  // tick (recapToShow only uses `now` to find last week).
  const recap = useMemo(
    () => recapToShow(data, now, settings.recapSeenWeek),
    [data, lastWeek, settings.recapSeenWeek]
  );
  if (!recap) return null;

  const openDetails = () => {
    actions.markRecapSeen(recap.weekStart);
    actions.openRecap(recap.weekStart);
  };

  return (
    <View style={[{ marginTop: 16, backgroundColor: colors.card, borderRadius: radius.xl, padding: 16 }, shadowCard]}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: colors.subtext, letterSpacing: 0.5 }}>
            LAST WEEK · {recap.rangeLabel.toUpperCase()}
          </Text>
          <Text style={{ fontSize: 15, fontWeight: '700', color: colors.ink, marginTop: 6, lineHeight: 21 }}>
            {recapSummary(recap)}
          </Text>
        </View>
        <Pressable
          onPress={() => actions.markRecapSeen(recap.weekStart)}
          hitSlop={8}
          style={{ width: 28, height: 28, borderRadius: 999, backgroundColor: colors.track, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ fontSize: 13, color: colors.subtext }}>✕</Text>
        </Pressable>
      </View>
      <Pressable onPress={openDetails} style={{ marginTop: 12, alignSelf: 'flex-start' }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: '#0A84FF' }}>See recap</Text>
      </Pressable>
    </View>
  );
}
