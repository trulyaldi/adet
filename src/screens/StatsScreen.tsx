import React, { useCallback, useMemo, useRef } from 'react';
import { ScrollView, View } from 'react-native';

import { Button } from '../components/Button';
import { IconButton } from '../components/Glyph';
import { ScreenIlmek } from '../components/ilmek/ScreenIlmek';
import { Appear } from '../components/motion/Appear';
import { ScreenHeader } from '../components/ScreenHeader';
import { projectInfoMap } from '../components/stats/common';
import { FocusTime } from '../components/stats/FocusTime';
import { PeriodChart } from '../components/stats/PeriodChart';
import { ProjectProgressList } from '../components/stats/ProjectProgressList';
import { RecordsGrid } from '../components/stats/RecordsGrid';
import { StreakShelf } from '../components/stats/StreakShelf';
import { WeekHero } from '../components/stats/WeekHero';
import { badgeCollectionOf, focusHoursOf, projectProgressOf, recordsOf, thisWeekOf } from '../domain/selectors';
import { nextStreakMilestone } from '../domain/stats';
import { useActions, useData, useStoreNow } from '../store/StreakStore';
import { useDayStreak } from '../store/useDayStreak';
import { useTheme } from '../theme/ThemeProvider';

/** Fewer days with time than this: the chart shows what exists with Ilmek, and focus time and records wait. */
const LOW_DATA_DAYS = 3;
/** Best focus time needs at least this many sessions in its four weeks. */
const FOCUS_MIN_SESSIONS = 5;

/**
 * Stats: "how am I doing?" at a glance. This week, the daily chart, project
 * progress, best focus time, streaks and badges, then records. Everything is
 * computed in memoized domain selectors, and each card is memoized, so the
 * store's clock tick and a timer running elsewhere don't redraw the charts.
 */
export function StatsScreen() {
  const { colors } = useTheme();
  const data = useData();
  const now = useStoreNow();
  const actions = useActions();
  const streak = useDayStreak();
  const scroll = useRef<ScrollView>(null);
  const chartY = useRef(0);

  const info = useMemo(() => projectInfoMap(data.projects), [data.projects]);
  const week = thisWeekOf(data, now);
  const progress = projectProgressOf(data, now);
  const focus = focusHoursOf(data, now);
  const recs = recordsOf(data, now);
  const badges = badgeCollectionOf(data);
  const next = useMemo(() => nextStreakMilestone(data.badges, streak.current), [data.badges, streak.current]);
  const lowData = recs.daysWithTime < LOW_DATA_DAYS;
  const toChart = useCallback(() => scroll.current?.scrollTo({ y: Math.max(0, chartY.current - 8), animated: true }), []);

  const header = (
    <ScreenHeader
      title="Stats"
      right={<IconButton label="Log time" name="logTime" size={21} color={colors.sub} bg={colors.card} diameter={40} onPress={() => actions.openLogSheet()} tipBelow />}
    />
  );

  if (recs.daysWithTime === 0) {
    return (
      <ScrollView contentContainerStyle={{ paddingTop: 12, paddingHorizontal: 16, paddingBottom: 110, gap: 14 }} showsVerticalScrollIndicator={false}>
        {header}
        <Appear>
          <View style={{ alignItems: 'center', paddingVertical: 40, gap: 24 }}>
            <View accessible accessibilityLabel="Nothing tracked yet">
              <ScreenIlmek state="relaxed" size={120} decorative />
            </View>
            <Button icon="play" label="Start on Today" onPress={() => actions.setScreen('today')} />
          </View>
        </Appear>
      </ScrollView>
    );
  }

  let i = 0;
  return (
    <ScrollView ref={scroll} contentContainerStyle={{ paddingTop: 12, paddingHorizontal: 16, paddingBottom: 110, gap: 14 }} showsVerticalScrollIndicator={false}>
      {header}
      <Appear index={i++}>
        <WeekHero week={week} info={info} onPress={toChart} />
      </Appear>
      <View onLayout={(e) => (chartY.current = e.nativeEvent.layout.y)}>
        <Appear index={i++}>
          <PeriodChart info={info} lowData={lowData} />
        </Appear>
      </View>
      <Appear index={i++}>
        <ProjectProgressList rows={progress} />
      </Appear>
      {!lowData && focus.sessions >= FOCUS_MIN_SESSIONS && (
        <Appear index={i++}>
          <FocusTime focus={focus} />
        </Appear>
      )}
      <Appear index={i++}>
        <StreakShelf current={streak.current} longest={streak.longest} badges={badges} next={next} info={info} />
      </Appear>
      {!lowData && (
        <Appear index={i++}>
          <RecordsGrid records={recs} />
        </Appear>
      )}
    </ScrollView>
  );
}
