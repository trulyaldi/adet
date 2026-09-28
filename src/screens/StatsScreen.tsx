import React, { useMemo } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { BadgeArt } from '../components/celebrate/BadgeArt';
import { Companion } from '../components/Companion';
import { Glyph, GlyphName, IconButton } from '../components/Glyph';
import { Icon } from '../components/Icon';
import { Appear } from '../components/motion/Appear';
import { AnimatedBar } from '../components/motion/AnimatedBar';
import { ScreenHeader } from '../components/ScreenHeader';
import { TimeHeatmap } from '../components/stats/TimeHeatmap';
import { WeeklyBars } from '../components/stats/WeeklyBars';
import { ICONS } from '../domain/constants';
import { projectLook } from '../domain/look';
import { STREAK_MILESTONES } from '../domain/milestones';
import { sessionWhen } from '../domain/projectsView';
import { badgeCollection, projectTotals, weeklyByProject } from '../domain/stats';
import { fmtDur, sayDur } from '../domain/time';
import { useStreak } from '../store/StreakStore';
import { useDayStreak } from '../store/useDayStreak';
import { useTheme } from '../theme/ThemeProvider';

/** Stats: colorful and readable, each number shown once. */
export function StatsScreen() {
  const t = useTheme();
  const { colors } = t;
  const { data, now, actions } = useStreak();
  const streak = useDayStreak();
  const weeks = useMemo(() => weeklyByProject(data, now), [data, Math.floor(now / 3_600_000)]);
  const totals = useMemo(() => projectTotals(data), [data]);
  const badges = useMemo(() => badgeCollection(data), [data]);
  const recent = useMemo(
    () =>
      data.sessions
        .filter((s) => s.end > data.historyClearedAt)
        .sort((a, b) => b.start - a.start)
        .slice(0, 15),
    [data.sessions, data.historyClearedAt]
  );
  const habitOf = (id: string) => data.habits.find((h) => h.id === id);
  const maxTotal = Math.max(1, ...totals.map((p) => p.sec));
  const nextStreak = STREAK_MILESTONES.find((n) => !data.badges.some((b) => b.id === `streak-${n}`));

  return (
    <ScrollView contentContainerStyle={{ paddingTop: 12, paddingHorizontal: 16, paddingBottom: 110, gap: 14 }} showsVerticalScrollIndicator={false}>
      <ScreenHeader
        title="Stats"
        right={<IconButton label="Log time" name="plus" size={20} color={colors.sub} bg={colors.card} diameter={40} onPress={() => actions.openLogSheet()} tipBelow />}
      />

      {!data.sessions.length && (
        <View accessible accessibilityLabel="Nothing tracked yet" style={{ alignItems: 'center', paddingVertical: 24 }}>
          <Companion mood="sleepy" size={110} />
        </View>
      )}

      <Appear index={0}>
        <Card glyph="stats" label="Time per project, last 12 weeks">
          <WeeklyBars weeks={weeks} data={data} />
        </Card>
      </Appear>

      <Appear index={1}>
        <Card glyph="clock" label="Time of day, last 12 weeks">
          <TimeHeatmap data={data} now={now} />
        </Card>
      </Appear>

      <Appear index={2}>
        <Card glyph="badge" label="Badges">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            {badges.map((b) => (
              <View key={b.id} accessible accessibilityLabel={badgeLabel(b.kind, b.value, data.projects.find((p) => p.id === b.projectId)?.name)}>
                <BadgeArt info={b} size={62} />
              </View>
            ))}
            {nextStreak && (
              <View accessible accessibilityLabel={`Next: a ${nextStreak} day streak`}>
                <BadgeArt info={{ id: 'next', kind: 'streak', value: nextStreak }} size={62} dim />
              </View>
            )}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Glyph name="flame" size={16} color={colors.sub} label="Longest streak" />
            <Text style={{ fontSize: 14, fontWeight: '800', color: colors.sub, fontVariant: ['tabular-nums'] }}>{streak.longest}</Text>
          </View>
        </Card>
      </Appear>

      {totals.length > 0 && (
        <Appear index={3}>
          <Card glyph="target" label="Total per project">
            {totals.map((p) => {
              const sw = t.swatch(p.look.color);
              return (
                <View key={p.projectId} accessible accessibilityLabel={`${p.name}, ${sayDur(p.sec)} in total`} style={{ gap: 6 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{ width: 26, height: 26, borderRadius: 8, backgroundColor: sw.base, alignItems: 'center', justifyContent: 'center' }}>
                      <Icon path={p.iconPath} size={14} color={sw.on} />
                    </View>
                    <Text numberOfLines={1} style={{ flex: 1, fontSize: 14.5, fontWeight: '800', color: p.archived ? colors.sub : colors.ink }}>
                      {p.name}
                    </Text>
                    {p.archived && <Glyph name="archive" size={14} color={colors.muted} />}
                    <Text style={{ fontSize: 14.5, fontWeight: '800', color: colors.ink, fontVariant: ['tabular-nums'] }}>{fmtDur(p.sec)}</Text>
                  </View>
                  <AnimatedBar value={p.sec / maxTotal} color={sw.base} track={sw.light} height={8} />
                </View>
              );
            })}
          </Card>
        </Appear>
      )}

      {recent.length > 0 && (
        <Appear index={4}>
          <Card glyph="list" label="Recent sessions">
            {recent.map((s) => {
              const h = habitOf(s.habitId);
              const p = h ? data.projects.find((x) => x.id === h.projectId) : undefined;
              const sw = t.swatch(projectLook(p ?? { id: h?.projectId ?? '' }).color);
              return (
                <Pressable
                  key={s.id}
                  onPress={() => actions.openSessionSheet(s.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`${h?.name ?? 'Session'}, ${sessionWhen(s.start)}, ${sayDur(s.duration)}. Edit`}
                  style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, opacity: pressed ? 0.6 : 1 })}
                >
                  <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: sw.light, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon path={h ? ICONS[h.icon] || ICONS.code : ICONS.code} size={15} color={t.dark ? sw.base : sw.dark} />
                  </View>
                  <Text numberOfLines={1} style={{ flex: 1, fontSize: 14, fontWeight: '700', color: colors.ink }}>
                    {h?.name ?? ''}
                  </Text>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: colors.sub, fontVariant: ['tabular-nums'] }}>{sessionWhen(s.start)}</Text>
                  <Text style={{ width: 56, textAlign: 'right', fontSize: 14, fontWeight: '800', color: colors.ink, fontVariant: ['tabular-nums'] }}>{fmtDur(s.duration)}</Text>
                </Pressable>
              );
            })}
          </Card>
        </Appear>
      )}
    </ScrollView>
  );
}

function badgeLabel(kind: string, value: number, project?: string): string {
  if (kind === 'streak') return `${value} day streak badge`;
  if (kind === 'hours') return `${value} hours on ${project ?? 'a project'} badge`;
  if (kind === 'week') return `Weekly target reached${project ? ` on ${project}` : ''} badge`;
  return 'First session badge';
}

function Card({ glyph, label, children }: { glyph: GlyphName; label: string; children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={[{ backgroundColor: t.colors.card, borderRadius: t.radius.xxl, padding: 16, gap: 12 }, t.shadow]}>
      <Glyph name={glyph} size={22} color={t.colors.sub} label={label} />
      {children}
    </View>
  );
}
