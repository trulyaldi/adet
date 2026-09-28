import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { HabitCard } from '../domain/today';
import { fmtClock } from '../domain/time';
import { useStreak } from '../store/StreakStore';
import { useStopTimer } from '../store/useStopTimer';
import { colors, radius, shadowCard } from '../theme/tokens';
import { CompletionMark } from './CompletionMark';
import { DotRow } from './DotRow';
import { IconButton } from './Glyph';
import { Icon } from './Icon';
import { StartButtons } from './StartButtons';

interface PlanCardProps {
  card: HabitCard;
  /** Show swap and remove (planned habits not done yet). */
  editable?: boolean;
  /** Draw as a small bonus row (outside the plan). */
  bonus?: boolean;
}

/**
 * One habit on Today: its tile and name, this week's dots, and the two start
 * buttons (full and minimum). Running: the clock with pause and stop. Done:
 * its check (the minimum's hollow check keeps the full button, to go on).
 */
export function PlanCard({ card: c, editable, bonus }: PlanCardProps) {
  const { data, config, actions } = useStreak();
  const stop = useStopTimer();
  const habit = data.habits.find((h) => h.id === c.habitId);
  if (!habit) return null;

  return (
    <Pressable
      onPress={c.running ? actions.openTimer : undefined}
      accessibilityLabel={c.running ? `${c.name}, open timer` : undefined}
      style={[
        {
          marginTop: 12,
          backgroundColor: c.running ? '#F3F8FF' : colors.card,
          borderRadius: radius.xl,
          padding: 14,
          gap: 12,
          borderWidth: c.running ? 1.5 : 0,
          borderColor: config.accent + '55',
        },
        shadowCard,
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 40, height: 40, borderRadius: radius.md, backgroundColor: c.tile, alignItems: 'center', justifyContent: 'center' }}>
          <Icon path={c.iconPath} size={20} />
        </View>
        <View style={{ flex: 1, gap: 6 }}>
          <Text numberOfLines={2} style={{ fontSize: 15.5, fontWeight: '700', color: colors.ink }}>
            {c.name}
          </Text>
          <DotRow total={c.weekTarget} filled={c.weekDone} size={7} color={config.accent} label={`${c.weekDone} of ${c.weekTarget} this week`} />
        </View>
        <CompletionMark mark={c.done} bonus={bonus} size={22} bg={c.running ? '#F3F8FF' : colors.card} />
        {editable && !c.done && !c.running && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <IconButton
              label={`Swap ${c.name}`}
              name="swap"
              size={18}
              color={colors.subtext}
              diameter={32}
              onPress={() => actions.openPlanPicker({ mode: 'swap', habitId: c.habitId })}
            />
            <IconButton
              label={`Remove ${c.name} from today`}
              name="remove"
              size={18}
              color={colors.subtext}
              diameter={32}
              onPress={() => actions.removeFromPlan(c.habitId)}
            />
          </View>
        )}
      </View>

      {c.running ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            style={{ flex: 1, fontSize: 22, fontWeight: '800', color: c.paused ? colors.subtext : colors.ink, fontVariant: ['tabular-nums'] }}
          >
            {fmtClock(c.elapsedSec)}
          </Text>
          <IconButton
            label={c.paused ? 'Resume' : 'Pause'}
            name={c.paused ? 'play' : 'pause'}
            size={16}
            bg={colors.card}
            diameter={38}
            onPress={actions.togglePause}
          />
          <IconButton label="Stop and save" name="done" size={18} color="#FFFFFF" bg={config.accent} diameter={38} onPress={stop} />
        </View>
      ) : c.done === 'full' ? null : (
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
          {c.done === 'min' ? (
            // Done at the minimum: going on to the full length is still offered.
            <StartButtons habit={{ ...habit, minTargetMin: habit.dailyTargetMin }} size={40} />
          ) : (
            <StartButtons habit={habit} size={46} />
          )}
        </View>
      )}
    </Pressable>
  );
}
