import React, { useRef } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { AdetMark } from '../components/AdetMark';
import { BudgetBar } from '../components/BudgetBar';
import { DayCompleteCard } from '../components/DayCompleteCard';
import { DayRing } from '../components/DayRing';
import { Glyph, IconButton } from '../components/Glyph';
import { PlanCard } from '../components/PlanCard';
import { RecapCard } from '../components/RecapCard';
import { SyncIndicator } from '../components/SyncIndicator';
import { daySecMap } from '../domain/engine';
import { dailyStreak } from '../domain/streaks';
import { selectPlanToday } from '../domain/today';
import { useStreak } from '../store/StreakStore';
import { colors, radius } from '../theme/tokens';

/** Today: the day's plan and nothing else; habits not planned never show as undone. */
export function TodayScreen() {
  const { data, ui, now, config, settings, actions } = useStreak();
  const model = selectPlanToday(data, { budgetMin: settings.budgetMin, planCap: settings.planCap }, now);
  const streak = dailyStreak(daySecMap(data, now), now).current;
  // A finished day (or one with nothing due) collapses to a single card. It
  // animates in when the day finishes on screen, not when Today opens on a
  // day that was already finished.
  const finished = model.complete || model.free;
  const opened = useRef({ day: model.day, finished });
  const animateIn = !(opened.current.finished && opened.current.day === model.day);
  const running = [...model.plan, ...model.bonus].filter((c) => c.running);

  return (
    <ScrollView
      contentContainerStyle={{ paddingTop: 16, paddingHorizontal: 20, paddingBottom: 24 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header: mark, streak and sync; week view and settings */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <View style={{ flexShrink: 1, gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <AdetMark height={30} />
            <Text style={{ fontSize: 30, fontWeight: '800', letterSpacing: -0.5, color: colors.ink }}>Adet</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View
              accessible
              accessibilityLabel={`${streak} day streak`}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.card, borderRadius: radius.pill, paddingVertical: 5, paddingHorizontal: 10 }}
            >
              <Glyph name="flame" size={14} color={colors.ink} />
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.ink, fontVariant: ['tabular-nums'] }}>{streak}</Text>
            </View>
            <SyncIndicator />
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <IconButton label="Week" name="week" size={18} color={colors.subtext} bg={colors.card} diameter={36} onPress={actions.openWeek} />
          <IconButton label="Settings" name="gear" size={18} color={colors.subtext} bg={colors.card} diameter={36} onPress={actions.openSettings} />
        </View>
      </View>

      {model.noHabits ? (
        <View style={{ alignItems: 'center', paddingVertical: 44, gap: 16 }}>
          <AdetMark height={30} color={colors.faint} />
          <IconButton
            label="Add a project and habits"
            name="plus"
            size={20}
            color="#FFFFFF"
            bg={config.accent}
            diameter={44}
            onPress={() => actions.setScreen('projects')}
          />
        </View>
      ) : (
        <>
          {/* Progress ring, budget under it */}
          <View style={{ alignItems: 'center', marginTop: 18, gap: 14 }}>
            <DayRing
              total={model.plan.length}
              done={model.doneCount}
              complete={finished}
              day={model.day}
              accent={config.accent}
            />
            <View style={{ width: 220 }}>
              <BudgetBar usedMin={model.plannedMin} budgetMin={model.budgetMin} accent={config.accent} shakeKey={ui.budgetShake} />
            </View>
          </View>

          {finished ? (
            <>
              <DayCompleteCard
                plan={model.plan}
                bonus={model.bonus}
                habits={model.doneTodayCount}
                minutes={model.trackedMin}
                accent={config.accent}
                animateIn={animateIn}
              />
              {/* A timer still running (e.g. going on past the minimum) keeps its card. */}
              {running.map((c) => (
                <PlanCard key={c.habitId} card={c} bonus={!model.plan.some((p) => p.habitId === c.habitId)} />
              ))}
              {/* Extra habits, never required: they count toward weekly targets. */}
              <View style={{ alignItems: 'center', marginTop: 14 }}>
                <IconButton
                  label="Log a bonus habit"
                  name="bonus"
                  size={22}
                  color={colors.subtext}
                  bg={colors.card}
                  diameter={44}
                  onPress={() => actions.openPlanPicker({ mode: 'bonus' })}
                />
              </View>
            </>
          ) : (
            model.plan.map((c) => <PlanCard key={c.habitId} card={c} editable />)
          )}

          {/* Room for one more: an empty slot */}
          {model.canAdd && !finished && (
            <View
              style={{
                marginTop: 12,
                borderRadius: radius.xl,
                borderWidth: 1.5,
                borderStyle: 'dashed',
                borderColor: colors.track3,
                paddingVertical: 12,
                alignItems: 'center',
              }}
            >
              <IconButton
                label="Add a habit to today"
                name="plus"
                size={18}
                color={colors.subtext}
                bg={colors.card}
                diameter={36}
                onPress={() => actions.openPlanPicker({ mode: 'add' })}
              />
            </View>
          )}

          {!finished && model.bonus.map((c) => <PlanCard key={c.habitId} card={c} bonus />)}
        </>
      )}

      {/* Last week's recap, once per week */}
      <RecapCard />
    </ScrollView>
  );
}
