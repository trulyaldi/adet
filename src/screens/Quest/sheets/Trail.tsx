// The Trail (v2 N8), in the Scribe: is each skill rising, steady or resting?
// A row per habit: its icon, a neutral verdict icon, four weeks of focused
// minutes as pixel bars and the reasons (more time, more per hour, a level). Tap a row for this week against last week, and to give the
// habit a measure. The numbers come from domain/progress (pure).

import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Icon } from '../../../components/Icon';
import { PixelGlyph } from '../../../components/PixelGlyph';
import { TextInput } from '../../../components/Text';
import { ICONS } from '../../../domain/constants';
import { METRIC_LABEL_MAX } from '../../../domain/items/types';
import { HabitProgress, trailOf, Verdict, WindowStats } from '../../../domain/progress';
import { habitLabel, REASON_WORD, trailLine } from '../../../domain/progress/labels';
import { activeHabits } from '../../../domain/projects';
import { dkey } from '../../../domain/time';
import { PixelButton } from '../../../game/ui/PixelButton';
import { PixelPanel } from '../../../game/ui/PixelPanel';
import { PixelText } from '../../../game/ui/PixelText';
import { QUI } from '../../../game/ui/theme';
import type { QuestModel } from '../useQuestModel';
import { Row } from './common';

/** Neutral verdict marks (12×12): stairs up, a level line, a moon. Never red. */
const VERDICT_GRID: Record<Verdict, readonly string[]> = {
  rising: ['............', '........####', '........#...', '........#...', '....#####...', '....#.......', '....#.......', '#####.......', '............', '............', '............', '............'],
  steady: ['............', '............', '............', '............', '............', '############', '############', '............', '............', '............', '............', '............'],
  resting: ['....####....', '..###.......', '.###........', '.##.........', '###.........', '###.........', '###.........', '.###......#.', '.####...###.', '..########..', '....####....', '............'],
};

export function VerdictIcon({ verdict, size = 18 }: { verdict: Verdict; size?: number }) {
  return <PixelGlyph grid={VERDICT_GRID[verdict]} size={size} color={verdict === 'resting' ? QUI.muted : QUI.ink} bg={QUI.parchment} />;
}

/** `onSetMetric` saves a habit's measure; without it (the QA preview) measures can't be edited. */
export function Trail({ model, onSetMetric }: { model: Pick<QuestModel, 'data' | 'game' | 'now'>; onSetMetric?(habitId: string, label: string, unit: string): void }) {
  const { data, game } = model;
  const habits = useMemo(() => activeHabits(data).filter((h) => h.kind !== 'check'), [data]);
  const day = dkey(new Date(model.now));
  const trail = useMemo(() => {
    const eff = new Map(game.sessions.map((r) => [r.sessionId, r.effMin]));
    return trailOf({ sessions: data.sessions, habits, items: data.items, now: model.now, effMinutes: eff });
    // Re-worked out per day or when the data changes, not every tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.sessions, data.items, habits, game, day]);
  const [open, setOpen] = useState<string | null>(null);

  if (trail.empty) {
    return (
      <PixelPanel tone="parchment" padding={3}>
        <PixelText size="md" style={{ textAlign: 'center' }}>
          Your trail begins with your first session.
        </PixelText>
      </PixelPanel>
    );
  }
  return (
    <View style={{ gap: 8 }}>
      <View accessible accessibilityLabel={`This week: ${trailLine(trail)}`} style={{ flexDirection: 'row', gap: 14, justifyContent: 'center', alignItems: 'center' }}>
        {(['rising', 'steady', 'resting'] as const).map((v) => (
          <View key={v} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <VerdictIcon verdict={v} />
            <PixelText size="md">{trail[v]}</PixelText>
          </View>
        ))}
      </View>
      {trail.habits.map((h) => {
        const habit = habits.find((x) => x.id === h.habitId)!;
        return <HabitTrail key={h.habitId} progress={h} name={habit.name} icon={habit.icon} open={open === h.habitId} onToggle={() => setOpen(open === h.habitId ? null : h.habitId)} onSetMetric={onSetMetric} />;
      })}
    </View>
  );
}

function HabitTrail({ progress: h, name, icon, open, onToggle, onSetMetric }: { progress: HabitProgress; name: string; icon: string; open: boolean; onToggle(): void; onSetMetric?(habitId: string, label: string, unit: string): void }) {
  const max = Math.max(1, ...h.series.map((w) => w.minutes));
  return (
    <PixelPanel tone="parchment" padding={2} style={{ gap: 6 }}>
      <Pressable onPress={onToggle} accessibilityRole="button" accessibilityLabel={habitLabel(name, h)} accessibilityHint={open ? 'Hides the details' : 'Shows this week against last week'} accessibilityState={{ expanded: open }} style={{ gap: 6, minHeight: 44 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Icon path={ICONS[icon as keyof typeof ICONS] || ICONS.code} size={18} color={QUI.wood} />
          <PixelText size="md" numberOfLines={1} style={{ flex: 1 }}>
            {name}
          </PixelText>
          {!h.empty && <VerdictIcon verdict={h.verdict} />}
          <Bars series={h.series} max={max} />
        </View>
        {h.reasons.length > 0 && (
          <Row style={{ flexWrap: 'wrap', gap: 4 }}>
            {h.reasons.map((r) => (
              <View key={r} style={{ paddingHorizontal: 5, paddingVertical: 1, borderWidth: 2, borderColor: QUI.wood }}>
                <PixelText size="tiny" color={QUI.wood}>
                  {REASON_WORD[r]}
                </PixelText>
              </View>
            ))}
          </Row>
        )}
      </Pressable>
      {open && <Details progress={h} habitId={h.habitId} onSetMetric={onSetMetric} />}
    </PixelPanel>
  );
}

/** Four weeks of focused minutes as chunky bars (whole points, oldest first). */
function Bars({ series, max }: { series: HabitProgress['series']; max: number }) {
  const H = 22;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: H }}>
      {series.map((w, i) => (
        <View key={w.weekStart} style={{ width: 6, height: Math.max(2, Math.round((w.minutes / max) * H)), backgroundColor: i === series.length - 1 ? QUI.gold : QUI.woodLight, borderWidth: 1, borderColor: QUI.ink }} />
      ))}
    </View>
  );
}

const fmt = (n: number | null, digits = 0) => (n === null ? '–' : n.toFixed(digits));

function Details({ progress: h, habitId, onSetMetric }: { progress: HabitProgress; habitId: string; onSetMetric?(habitId: string, label: string, unit: string): void }) {
  const [label, setLabel] = useState(h.metric?.label ?? '');
  const [unit, setUnit] = useState(h.metric?.unit ?? '');
  const [editing, setEditing] = useState(!h.metric);
  const rows: [string, (w: WindowStats) => string][] = [
    ['Minutes', (w) => fmt(w.minutes)],
    ['Sessions', (w) => fmt(w.sessions)],
    ['Levels', (w) => fmt(w.levelsGained)],
  ];
  if (h.metric) {
    rows.push([h.metric.label, (w) => fmt(w.measure)], [`${h.metric.label} per hour`, (w) => fmt(w.perHour, 1)]);
  }
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row' }}>
        <PixelText size="tiny" color={QUI.muted} style={{ flex: 1 }} />
        <PixelText size="tiny" color={QUI.muted} style={{ width: 70, textAlign: 'right' }}>
          last week
        </PixelText>
        <PixelText size="tiny" color={QUI.muted} style={{ width: 70, textAlign: 'right' }}>
          this week
        </PixelText>
      </View>
      {rows.map(([k, f]) => (
        <View key={k} accessible accessibilityLabel={`${k}: last week ${f(h.lastWeek)}, this week ${f(h.thisWeek)}`} style={{ flexDirection: 'row' }}>
          <PixelText size="sm" numberOfLines={1} style={{ flex: 1 }}>
            {k}
          </PixelText>
          <PixelText size="sm" color={QUI.muted} style={{ width: 70, textAlign: 'right' }}>
            {f(h.lastWeek)}
          </PixelText>
          <PixelText size="sm" style={{ width: 70, textAlign: 'right' }}>
            {f(h.thisWeek)}
          </PixelText>
        </View>
      ))}
      {!onSetMetric ? null : editing ? (
        <View style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <TextInput value={label} onChangeText={setLabel} maxLength={METRIC_LABEL_MAX} placeholder="Measure (e.g. Pages)" placeholderTextColor={QUI.muted} accessibilityLabel="What to measure" style={{ flex: 2, minHeight: 44, paddingHorizontal: 8, backgroundColor: QUI.white, color: QUI.ink, fontSize: 14, borderWidth: 2, borderColor: QUI.ink }} />
            <TextInput value={unit} onChangeText={setUnit} maxLength={METRIC_LABEL_MAX} placeholder="unit" placeholderTextColor={QUI.muted} accessibilityLabel="Its unit" style={{ flex: 1, minHeight: 44, paddingHorizontal: 8, backgroundColor: QUI.white, color: QUI.ink, fontSize: 14, borderWidth: 2, borderColor: QUI.ink }} />
          </View>
          <PixelButton small label={h.metric ? 'Save measure' : 'Add measure'} accessibilityLabel={h.metric ? 'Save the measure' : 'Add a measure to this skill'} disabled={!label.trim()} onPress={() => {
            onSetMetric(habitId, label, unit);
            setEditing(false);
          }} />
        </View>
      ) : (
        <PixelButton small tone="parchment" label="Edit measure" accessibilityLabel="Edit this skill's measure" onPress={() => setEditing(true)} />
      )}
    </View>
  );
}
