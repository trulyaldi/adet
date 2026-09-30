import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import Animated, { FadeOut, ZoomIn } from 'react-native-reanimated';

import { AdetLockup } from '../components/AdetMark';
import { Character } from '../components/character/Character';
import { Glyph, IconButton } from '../components/Glyph';
import { Appear } from '../components/motion/Appear';
import { ScreenHeader } from '../components/ScreenHeader';
import { SyncIndicator } from '../components/SyncIndicator';
import { ActiveSessionCard } from '../components/today/ActiveSessionCard';
import { CapacityPrompt } from '../components/today/CapacityPrompt';
import { HeroRing } from '../components/today/HeroRing';
import { DoneRow, PlanRow, ROW_H } from '../components/today/PlanRow';
import { SortableList } from '../components/today/SortableList';
import { StreakPill } from '../components/today/StreakPill';
import { SummaryCard } from '../components/today/SummaryCard';
import { TodayItem } from '../domain/day';
import { todayListsOf, todayOf } from '../domain/selectors';
import { fmtDur } from '../domain/time';
import { useActions, useData, useSettings, useStoreNow, useUi } from '../store/StreakStore';
import { useDayStreak } from '../store/useDayStreak';
import { useTheme } from '../theme/ThemeProvider';

const GAP = 10;

/** Today: the day's suggested plan, what's running, and nothing that reads as undone. */
export function TodayScreen() {
  const t = useTheme();
  const { colors, radius } = t;
  const data = useData();
  const now = useStoreNow();
  const settings = useSettings();
  const actions = useActions();
  const model = todayOf(data, now);
  const { pending, done, bonus, summary } = todayListsOf(model);
  const streak = useDayStreak().current;
  // Only a day that finishes on screen animates into the check.
  const opened = useRef({ day: model.day, complete: model.complete });
  const animateIn = !(opened.current.complete && opened.current.day === model.day);

  const prompt = settings.dailyPrompt && !data.days[model.day]?.prompted && !model.noHabits;

  const start = (i: TodayItem) => actions.startTimer(i.habitId);
  const tapDone = (i: TodayItem) => (i.kind === 'check' ? actions.toggleCheck(i.habitId) : actions.startTimer(i.habitId));
  const segments = useMemo(
    () =>
      model.items.map((i) => {
        const sw = t.swatch(i.color);
        return { key: i.habitId, color: sw.base, track: sw.light, frac: i.done ? 1 : i.shareSec > 0 ? Math.min(1, i.sec / i.shareSec) : 0 };
      }),
    [model.items, t]
  );

  return (
    <ScrollView contentContainerStyle={{ paddingTop: 12, paddingHorizontal: 16, paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
      <ScreenHeader
        left={<AdetLockup height={26} />}
        right={
          <>
            <StreakPill days={streak} />
            <SyncIndicator />
            <IconButton label="Week" name="week" size={20} color={colors.sub} bg={colors.card} diameter={40} onPress={actions.openWeek} tipBelow />
            <IconButton label="Settings" name="gear" size={20} color={colors.sub} bg={colors.card} diameter={40} onPress={actions.openSettings} tipBelow />
          </>
        }
      />

      {model.noHabits ? (
        <View style={{ alignItems: 'center', paddingVertical: 48, gap: 20 }}>
          <Character mood="idle" size={120} />
          <IconButton
            label="Add a project and habits"
            name="plus"
            size={24}
            color={colors.onBrand}
            bg={colors.brand}
            edge={colors.brandDark}
            variant="chunky"
            diameter={60}
            onPress={() => {
              actions.setScreen('projects');
              actions.openNewProject();
            }}
          />
        </View>
      ) : (
        <>
          {prompt && <CapacityPrompt onPick={actions.setDayLevel} />}

          {model.free && !model.active ? (
            <FreeDay trackedSec={model.trackedSec} onBonus={actions.openStartSheet} />
          ) : (
            <View style={{ alignItems: 'center', marginTop: 18 }}>
              <HeroRing
                segments={segments}
                trackedSec={model.trackedSec}
                capacitySec={model.capacityMin * 60}
                complete={model.complete}
                day={model.day}
              />
              <DayCheer />
            </View>
          )}

          {model.active && <ActiveSessionCard item={model.active} />}

          {model.complete ? (
            <>
              <SummaryCard items={summary} trackedSec={model.trackedSec} streak={streak} animateIn={animateIn} onRow={tapDone} />
              <BonusButton onPress={actions.openStartSheet} />
            </>
          ) : (
            !model.free && (
              <View style={{ marginTop: 18, gap: GAP }}>
                <SortableList
                  items={pending}
                  keyOf={(i) => i.habitId}
                  slot={ROW_H + GAP}
                  gap={GAP}
                  onReorder={(ids) => actions.reorderToday([...ids, ...model.items.filter((i) => !ids.includes(i.habitId)).map((i) => i.habitId)])}
                  renderItem={(i, drag, move) => (
                    <PlanRow
                      item={i}
                      dragGesture={pending.length > 1 ? drag : undefined}
                      onMove={pending.length > 1 ? move : undefined}
                      onStart={() => start(i)}
                      onCheck={() => actions.toggleCheck(i.habitId)}
                      onAside={() => actions.setAside(i.habitId, true)}
                    />
                  )}
                />
                {done.map((i, n) => (
                  <Appear key={i.habitId} index={n}>
                    <DoneRow item={i} onPress={() => tapDone(i)} />
                  </Appear>
                ))}
                <AddRow onPress={actions.openStartSheet} />
              </View>
            )
          )}

          {bonus.length > 0 && (
            <View style={{ marginTop: 14, gap: 8 }}>
              {bonus.map((b) => (
                <DoneRow key={b.habitId} item={b} bonus onPress={() => tapDone(b)} />
              ))}
            </View>
          )}

          {model.aside.length > 0 && (
            <View style={{ marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <Glyph name="moon" size={18} color={colors.muted} label="Set aside today" />
              {model.aside.map((a) => {
                const sw = t.swatch(a.color);
                return (
                  <IconButton
                    key={a.habitId}
                    label={`Bring ${a.name} back to today`}
                    onPress={() => actions.setAside(a.habitId, false)}
                    bg={colors.card}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 7, paddingHorizontal: 12, borderRadius: radius.pill, borderWidth: 2, borderColor: sw.light }}
                  >
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: sw.base }} />
                    <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: '800', color: colors.sub, maxWidth: 140 }}>
                      {a.name}
                    </Text>
                  </IconButton>
                );
              })}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

/** Your character hops up beside the ring for a moment when the day completes. */
function DayCheer() {
  const confetti = useUi((u) => u.confetti);
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!confetti) return;
    setOn(true);
    const tm = setTimeout(() => setOn(false), 3800);
    return () => clearTimeout(tm);
  }, [confetti]);
  if (!on) return null;
  return (
    <Animated.View entering={ZoomIn.springify().damping(12)} exiting={FadeOut} style={{ position: 'absolute', right: 0, bottom: -6, pointerEvents: 'none' }}>
      <Character mood="celebrating" size={76} />
    </Animated.View>
  );
}

/** "+": start any project, planned or not. */
function AddRow({ onPress }: { onPress(): void }) {
  const { colors, radius } = useTheme();
  return (
    <View style={{ borderRadius: radius.xl, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.line, paddingVertical: 10, alignItems: 'center' }}>
      <IconButton label="Start another project" name="plus" size={20} color={colors.sub} bg={colors.card} diameter={40} onPress={onPress} />
    </View>
  );
}

function BonusButton({ onPress }: { onPress(): void }) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: 'center', marginTop: 16 }}>
      <IconButton label="Bonus: start something extra" name="bonus" size={22} color={colors.sub} bg={colors.card} diameter={46} onPress={onPress} />
    </View>
  );
}

/** Nothing planned today (targets met, or a zero-capacity day): a relaxed scene and a quiet bonus button. */
function FreeDay({ trackedSec, onBonus }: { trackedSec: number; onBonus(): void }) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingTop: 36, gap: 12 }}>
      <View accessible accessibilityLabel="Nothing planned today, rest easy">
        <Character mood="sleepy" size={130} decorative />
      </View>
      <Glyph name="moon" size={22} color={colors.muted} />
      {trackedSec > 0 && <Text style={{ fontSize: 22, fontWeight: '800', color: colors.ink, fontVariant: ['tabular-nums'] }}>{fmtDur(trackedSec)}</Text>}
      <BonusButton onPress={onBonus} />
    </View>
  );
}
