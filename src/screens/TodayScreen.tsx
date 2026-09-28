import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import Animated, { FadeOut, ZoomIn } from 'react-native-reanimated';

import { AdetLockup } from '../components/AdetMark';
import { Companion } from '../components/Companion';
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
import { selectToday, TodayItem } from '../domain/day';
import { fmtDur } from '../domain/time';
import { useStreak } from '../store/StreakStore';
import { useDayStreak } from '../store/useDayStreak';
import { useTheme } from '../theme/ThemeProvider';

const GAP = 10;

/** Today: the day's suggested plan, what's running, and nothing that reads as undone. */
export function TodayScreen() {
  const t = useTheme();
  const { colors, radius } = t;
  const { data, now, settings, actions } = useStreak();
  const model = useMemo(() => selectToday(data, now), [data, now]);
  const streak = useDayStreak().current;
  // Only a day that finishes on screen animates into the check.
  const opened = useRef({ day: model.day, complete: model.complete });
  const animateIn = !(opened.current.complete && opened.current.day === model.day);

  const pending = model.items.filter((i) => !i.done && !i.running);
  const done = model.items.filter((i) => i.done && !i.running);
  const prompt = settings.dailyPrompt && !data.days[model.day]?.prompted && !model.noHabits;

  const start = (i: TodayItem) => actions.startTimer(i.habitId);
  const tapDone = (i: TodayItem) => (i.kind === 'check' ? actions.toggleCheck(i.habitId) : actions.startTimer(i.habitId));

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
          <Companion mood="idle" size={120} />
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
                segments={model.items.map((i) => {
                  const sw = t.swatch(i.color);
                  return { key: i.habitId, color: sw.base, track: sw.light, frac: i.done ? 1 : i.shareSec > 0 ? Math.min(1, i.sec / i.shareSec) : 0 };
                })}
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
              <SummaryCard items={[...model.items, ...model.bonus.filter((b) => b.done)]} trackedSec={model.trackedSec} streak={streak} animateIn={animateIn} onRow={tapDone} />
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

          {model.bonus.filter((b) => !b.running && !(model.complete && b.done)).length > 0 && (
            <View style={{ marginTop: 14, gap: 8 }}>
              {model.bonus
                .filter((b) => !b.running && !(model.complete && b.done))
                .map((b) => (
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

/** The companion hops up beside the ring for a moment when the day completes. */
function DayCheer() {
  const { ui } = useStreak();
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!ui.confetti) return;
    setOn(true);
    const tm = setTimeout(() => setOn(false), 3800);
    return () => clearTimeout(tm);
  }, [ui.confetti]);
  if (!on) return null;
  return (
    <Animated.View entering={ZoomIn.springify().damping(12)} exiting={FadeOut} pointerEvents="none" style={{ position: 'absolute', right: 0, bottom: -6 }}>
      <Companion mood="cheer" size={76} />
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
        <Companion mood="sleepy" size={130} />
      </View>
      <Glyph name="moon" size={22} color={colors.muted} />
      {trackedSec > 0 && <Text style={{ fontSize: 22, fontWeight: '800', color: colors.ink, fontVariant: ['tabular-nums'] }}>{fmtDur(trackedSec)}</Text>}
      <BonusButton onPress={onBonus} />
    </View>
  );
}
