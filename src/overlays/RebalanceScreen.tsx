import React, { useEffect, useState } from 'react';
import { Modal, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AdetMark } from '../components/AdetMark';
import { AMBER } from '../components/BudgetBar';
import { FrequencyPicker } from '../components/FrequencyPicker';
import { Glyph, IconButton } from '../components/Glyph';
import { Icon } from '../components/Icon';
import { ICONS } from '../domain/constants';
import { Frequency } from '../domain/frequency';
import { activeHabits } from '../domain/projects';
import { averageDailyMin, suggestedFrequency } from '../domain/rebalance';
import { useStreak } from '../store/StreakStore';
import { colors, radius, shadowCard } from '../theme/tokens';

const CALM_BLUE = '#0A84FF';

/**
 * Shown once, after the update to daily plans: every habit with its
 * suggested frequency (tap the dots to change it) and its full and minimum
 * lengths, and a bar of the average day against the budget that turns from
 * amber to calm blue once it fits. Check applies; x keeps everything as is.
 * Either way it never shows again.
 */
export function RebalanceScreen() {
  const { data, ready, settings, config, actions } = useStreak();
  const insets = useSafeAreaInsets();
  const habits = activeHabits(data);
  const open = ready && data.rebalancePending && habits.length > 0;
  const [chosen, setChosen] = useState<Record<string, Frequency>>({});

  // Nothing to rebalance (every habit is archived): done, so it can't pop up later.
  useEffect(() => {
    if (ready && data.rebalancePending && habits.length === 0) actions.finishRebalance(null);
  }, [ready, data.rebalancePending, habits.length, actions]);

  // Suggestions are filled in once, when the screen opens.
  useEffect(() => {
    if (!open) return;
    setChosen((prev) => {
      const next = { ...prev };
      for (const h of habits) if (!next[h.id]) next[h.id] = suggestedFrequency(h);
      return next;
    });
  }, [open, data.habits]);

  const freqOf = (h: (typeof habits)[number]) => chosen[h.id] ?? suggestedFrequency(h);
  const avg = averageDailyMin(habits, freqOf);
  const before = averageDailyMin(habits);
  const fits = avg <= settings.budgetMin;
  const scale = Math.max(settings.budgetMin, before, avg, 1);
  const tone = fits ? CALM_BLUE : AMBER;

  return (
    <Modal visible={open} animationType="fade" onRequestClose={() => actions.finishRebalance(null)}>
      <View style={{ flex: 1, backgroundColor: colors.screen, paddingTop: insets.top + 20, paddingBottom: Math.max(insets.bottom, 16) + 8 }}>
        <View style={{ alignItems: 'center', gap: 10, paddingHorizontal: 20 }}>
          <AdetMark height={40} />
          <Text style={{ fontSize: 17, fontWeight: '700', color: colors.ink }}>A smaller, doable day</Text>
        </View>

        {/* The average day against the budget */}
        <View
          accessible
          accessibilityLabel={`About ${avg} minutes a day, budget ${settings.budgetMin}`}
          style={{ marginTop: 20, marginHorizontal: 20, gap: 8 }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Glyph name="clock" size={16} color={tone} />
            <View style={{ flex: 1, height: 8, borderRadius: radius.pill, backgroundColor: colors.track2 }}>
              <View style={{ width: `${Math.min(100, (avg / scale) * 100)}%`, height: '100%', borderRadius: radius.pill, backgroundColor: tone }} />
              {/* The budget line */}
              <View
                style={{
                  position: 'absolute',
                  left: `${Math.min(100, (settings.budgetMin / scale) * 100)}%`,
                  top: -4,
                  bottom: -4,
                  width: 2,
                  marginLeft: -1,
                  borderRadius: 1,
                  backgroundColor: colors.ink,
                }}
              />
            </View>
            <Text style={{ fontSize: 13, fontWeight: '800', color: tone, fontVariant: ['tabular-nums'] }}>
              {avg}/{settings.budgetMin}
            </Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, gap: 10 }}>
          {habits.map((h) => (
            <View key={h.id} style={[{ backgroundColor: colors.card, borderRadius: radius.xl, padding: 14, gap: 10 }, shadowCard]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 30, height: 30, borderRadius: radius.sm, backgroundColor: h.tile, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon path={ICONS[h.icon] || ICONS.code} size={15} />
                </View>
                <Text numberOfLines={1} style={{ flex: 1, fontSize: 14.5, fontWeight: '700', color: colors.ink }}>
                  {h.name}
                </Text>
                <View accessible accessibilityLabel={`Full ${h.dailyTargetMin} minutes`} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Glyph name="full" size={13} color={colors.ink} />
                  <Text style={{ fontSize: 13, fontWeight: '800', color: colors.ink, fontVariant: ['tabular-nums'] }}>{h.dailyTargetMin}</Text>
                </View>
                <View accessible accessibilityLabel={`Minimum ${h.minTargetMin} minutes`} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Glyph name="min" size={13} color={colors.ink} />
                  <Text style={{ fontSize: 13, fontWeight: '800', color: colors.ink, fontVariant: ['tabular-nums'] }}>{h.minTargetMin}</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Glyph name="calendar" size={16} color={colors.subtext} />
                <View style={{ flex: 1 }}>
                  <FrequencyPicker
                    compact
                    value={freqOf(h)}
                    accent={config.accent}
                    onChange={(f) => setChosen((c) => ({ ...c, [h.id]: f }))}
                  />
                </View>
              </View>
            </View>
          ))}
        </ScrollView>

        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 28, paddingTop: 8 }}>
          <IconButton label="Keep everything as it is" name="close" size={22} color={colors.subtext} bg={colors.card} diameter={58} onPress={() => actions.finishRebalance(null)} />
          <IconButton label="Apply these" name="done" size={28} color="#FFFFFF" bg={CALM_BLUE} diameter={58} onPress={() => actions.finishRebalance(chosen)} />
        </View>
      </View>
    </Modal>
  );
}
