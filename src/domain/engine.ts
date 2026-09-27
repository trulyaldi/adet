// Framework-free selectors + calculations, ported from the design's renderVals().
// These return plain data only; UI attaches press handlers from the store.

import { AppConfig } from './config';
import { ICONS, MONTHS, DOWFULL, DOWS, HEAT_SCALE, STAGES } from './constants';
import { addDays, dkey, fmtH, fmtHM, fmtMin, monday, pad, pkey } from './time';
import {
  ActiveTimer,
  Habit,
  IconKey,
  PersistedState,
  Session,
  Stage,
} from './types';

// ---------- stages ----------
export function stagesFor(config: AppConfig): Stage[] {
  const custom = config.stageHours;
  if (Array.isArray(custom) && custom.length === STAGES.length) {
    return STAGES.map((s, i) => [s[0], custom[i]] as Stage);
  }
  return STAGES;
}

export function stageOf(sec: number, stages: Stage[]): Stage {
  const h = sec / 3600;
  let cur = stages[0];
  for (const s of stages) if (h >= s[1]) cur = s;
  return cur;
}

export function nextStageOf(sec: number, stages: Stage[]): Stage | null {
  const h = sec / 3600;
  for (const s of stages) if (h < s[1]) return s;
  return null;
}

// ---------- active timer ----------
export function activeSec(active: ActiveTimer | null, now: number): number {
  if (!active) return 0;
  return active.baseSec + (active.startedAt ? (now - active.startedAt) / 1000 : 0);
}

// ---------- aggregations ----------
type SessionFilter = (s: { start: number }) => boolean;

export function habitSec(
  data: PersistedState,
  now: number,
  hid: string,
  filter?: SessionFilter
): number {
  let t = 0;
  for (const s of data.sessions) {
    if (s.habitId === hid && (!filter || filter(s))) t += s.duration;
  }
  const a = data.active;
  if (a && a.habitId === hid && (!filter || filter({ start: now }))) {
    t += activeSec(a, now);
  }
  return t;
}

export function daySecMap(
  data: PersistedState,
  now: number,
  hids?: string[]
): Record<string, number> {
  const map: Record<string, number> = {};
  for (const s of data.sessions) {
    if (hids && !hids.includes(s.habitId)) continue;
    const k = dkey(new Date(s.start));
    map[k] = (map[k] || 0) + s.duration;
  }
  const a = data.active;
  if (a && (!hids || hids.includes(a.habitId))) {
    const k = dkey(new Date(now));
    map[k] = (map[k] || 0) + activeSec(a, now);
  }
  return map;
}

export function streakOf(dayMap: Record<string, number>): number {
  const todayD = new Date();
  let streak = 0;
  let sd = new Date(todayD.getFullYear(), todayD.getMonth(), todayD.getDate());
  if (!dayMap[dkey(sd)]) sd = addDays(sd, -1);
  while (dayMap[dkey(sd)] > 0) {
    streak++;
    sd = addDays(sd, -1);
  }
  return streak;
}

// ---------- shared stat tables ----------
interface HabitStat {
  life: number;
  week: number;
  lastWeek: number;
  day: number;
  month: number;
  count: number;
}
interface ProjStat {
  habits: Habit[];
  life: number;
  week: number;
  lastWeek: number;
  count: number;
}

interface StatContext {
  today: string;
  weekStartK: string;
  lastWeekStartK: string;
  monthPrefix: string;
  mon: Date;
  todayD: Date;
  habitStats: Record<string, HabitStat>;
  projStats: Record<string, ProjStat>;
  inWeek: SessionFilter;
  inLastWeek: SessionFilter;
  inDay: SessionFilter;
  inMonth: SessionFilter;
}

function buildContext(data: PersistedState, now: number): StatContext {
  const todayD = new Date(now);
  const today = dkey(todayD);
  const mon = monday(todayD);
  const weekStartK = dkey(mon);
  const lastWeekStartK = dkey(addDays(mon, -7));
  const monthPrefix = today.slice(0, 7);

  const inWeek: SessionFilter = (s) => {
    const k = dkey(new Date(s.start));
    return k >= weekStartK && k <= today;
  };
  const inLastWeek: SessionFilter = (s) => {
    const k = dkey(new Date(s.start));
    return k >= lastWeekStartK && k < weekStartK;
  };
  const inDay: SessionFilter = (s) => dkey(new Date(s.start)) === today;
  const inMonth: SessionFilter = (s) =>
    dkey(new Date(s.start)).slice(0, 7) === monthPrefix;

  const habitStats: Record<string, HabitStat> = {};
  for (const h of data.habits) {
    habitStats[h.id] = {
      life: habitSec(data, now, h.id),
      week: habitSec(data, now, h.id, inWeek),
      lastWeek: habitSec(data, now, h.id, inLastWeek),
      day: habitSec(data, now, h.id, inDay),
      month: habitSec(data, now, h.id, inMonth),
      count: data.sessions.filter((s) => s.habitId === h.id).length,
    };
  }
  const projStats: Record<string, ProjStat> = {};
  for (const p of data.projects) {
    const hs = data.habits.filter((h) => h.projectId === p.id);
    projStats[p.id] = {
      habits: hs,
      life: hs.reduce((a, h) => a + habitStats[h.id].life, 0),
      week: hs.reduce((a, h) => a + habitStats[h.id].week, 0),
      lastWeek: hs.reduce((a, h) => a + habitStats[h.id].lastWeek, 0),
      count: hs.reduce((a, h) => a + habitStats[h.id].count, 0),
    };
  }

  return {
    today,
    weekStartK,
    lastWeekStartK,
    monthPrefix,
    mon,
    todayD,
    habitStats,
    projStats,
    inWeek,
    inLastWeek,
    inDay,
    inMonth,
  };
}

function trendOf(ps: { week: number; lastWeek: number }) {
  // Non-punitive: gains read as progress; shortfalls read as an actionable
  // "to match last week" rather than a red penalty.
  const d = ps.week - ps.lastWeek;
  if (d >= 0)
    return { label: '↑ ' + fmtH(d), sub: 'vs last week', color: '#1F8A3B' };
  return { label: '↓ ' + fmtH(-d), sub: 'vs last week', color: '#FF3B30' };
}

function iconPath(icon: IconKey): string {
  return ICONS[icon] || ICONS.code;
}

// ---------- TODAY ----------
function recommendedIdFrom(
  ctx: StatContext,
  data: PersistedState,
  now: number
): string | null {
  void now;
  let recommendedId: string | null = null;
  let lowestScore = Infinity;

  for (const h of data.habits) {
    if (data.active && data.active.habitId === h.id) continue;

    const stt = ctx.habitStats[h.id];
    const dGoal = (h.dailyTargetMin || 30) * 60;
    if (stt.day >= dGoal) continue;

    const wGoal = (h.weeklyTargetMin || 150) * 60;
    const score = stt.day / dGoal + (stt.week / wGoal) * 0.25;
    if (score < lowestScore) {
      lowestScore = score;
      recommendedId = h.id;
    }
  }

  return recommendedId;
}

export interface TodayRow {
  habitId: string;
  iconPath: string;
  tile: string;
  name: string;
  sub: string;
  todayPct: string;
  barColor: string;
  done: boolean;
  recommended: boolean;
  running: boolean;
  paused: boolean;
  cardBorder: string;
  btnLabelSec: number; // seconds to render as clock when running
  btnLabel: string;
  btnBg: string;
  btnFg: string;
}
export interface TodayGroup {
  projectId: string;
  name: string;
  stageLabel: string;
  weekLabel: string;
  weekPct: number;
  barColor: string;
  consistencyLabel: string;
  rows: TodayRow[];
}
export interface TodayModel {
  todayDateLabel: string;
  streakLabel: string;
  groups: TodayGroup[];
  noHabits: boolean;
  hasHabits: boolean;
  focusPctLabel: string;
  focusRingOffset: number;
  focusRingColor: string;
  focusTimeLabel: string;
  focusDots: { c: string }[];
  focusDotsLabel: string;
}

export function recommendedHabitId(
  data: PersistedState,
  config: AppConfig,
  now: number
): string | null {
  void config;
  const ctx = buildContext(data, now);
  return recommendedIdFrom(ctx, data, now);
}

export function selectToday(
  data: PersistedState,
  config: AppConfig,
  now: number
): TodayModel {
  const ctx = buildContext(data, now);
  const stages = stagesFor(config);
  const globalStreak = streakOf(daySecMap(data, now));
  const todayD = ctx.todayD;
  const dayGoalSec = data.habits.reduce(
    (total, h) => total + (h.dailyTargetMin || 30) * 60,
    0
  );
  const dayDoneSec = data.habits.reduce(
    (total, h) => total + ctx.habitStats[h.id].day,
    0
  );
  const doneCount = data.habits.filter(
    (h) => ctx.habitStats[h.id].day >= (h.dailyTargetMin || 30) * 60
  ).length;
  const fp = dayGoalSec > 0 ? Math.min(1, dayDoneSec / dayGoalSec) : 0;
  const recommendedId = recommendedIdFrom(ctx, data, now);

  const groups: TodayGroup[] = data.projects
    .map((p) => {
      const ps = ctx.projStats[p.id];
      const target = (p.weeklyTarget || 8) * 3600;
      const pct = Math.min(100, Math.round((ps.week / target) * 100));
      const pStreak = streakOf(
        daySecMap(data, now, ps.habits.map((h) => h.id))
      );
      const trend = trendOf(ps);
      return {
        projectId: p.id,
        name: p.name,
        stageLabel: stageOf(ps.life, stages)[0],
        weekLabel:
          fmtHM(Math.floor(ps.week)) +
          ' / ' +
          (p.weeklyTarget || 8) +
          'h this week',
        weekPct: pct,
        barColor: pct >= 100 ? '#34C759' : '#17181A',
        consistencyLabel:
          pStreak + '-day streak · ' + trend.label + ' vs last week',
        rows: ps.habits.map((h) => {
          const stt = ctx.habitStats[h.id];
          const active = data.active;
          const dGoal = (h.dailyTargetMin || 30) * 60;
          const running = !!(active && active.habitId === h.id);
          const paused = running && !active?.startedAt;
          const done = stt.day >= dGoal;
          const rec = h.id === recommendedId;
          return {
            habitId: h.id,
            iconPath: iconPath(h.icon),
            tile: h.tile,
            name: h.name,
            sub:
              fmtHM(Math.floor(stt.day)) +
              ' / ' +
              fmtMin(h.dailyTargetMin || 30) +
              ' today',
            todayPct: Math.min(100, Math.round((stt.day / dGoal) * 100)) + '%',
            barColor: done ? '#34C759' : '#17181A',
            done,
            recommended: rec,
            running,
            paused,
            cardBorder: running ? config.accent : 'transparent',
            btnLabelSec: running && !paused ? activeSec(active, now) : 0,
            btnLabel: running
              ? paused
                ? 'Resume'
                : ''
              : done
              ? 'Done ✓'
              : stt.day > 0
              ? 'Continue'
              : 'Start timer',
            btnBg: running
              ? paused
                ? '#FFF4E5'
                : '#FFECEB'
              : done
              ? '#E8F5EC'
              : rec
              ? config.accent
              : '#F1F2F5',
            btnFg: running
              ? paused
                ? '#C77800'
                : '#FF3B30'
              : done
              ? '#1F8A3B'
              : rec
              ? '#FFFFFF'
              : config.accent,
          };
        }),
      };
    })
    .filter((g) => g.rows.length > 0);

  return {
    todayDateLabel:
      MONTHS[todayD.getMonth()] +
      ' ' +
      todayD.getDate() +
      ', ' +
      todayD.getFullYear(),
    streakLabel: globalStreak + ' day' + (globalStreak === 1 ? '' : 's'),
    groups,
    noHabits: data.habits.length === 0,
    hasHabits: data.habits.length > 0,
    focusPctLabel: Math.round(fp * 100) + '%',
    focusRingOffset: Number((157.1 * (1 - fp)).toFixed(1)),
    focusRingColor: fp >= 1 ? '#34C759' : config.accent,
    focusTimeLabel: fmtHM(Math.floor(dayDoneSec)) + ' of ' + fmtHM(dayGoalSec),
    focusDots: data.habits.map((h) => ({
      c:
        ctx.habitStats[h.id].day >= (h.dailyTargetMin || 30) * 60
          ? '#34C759'
          : '#E3E4E8',
    })),
    focusDotsLabel: doneCount + ' of ' + data.habits.length + ' habits done',
  };
}

// ---------- PROJECTS ----------
export interface ProjectHabitRow {
  habitId: string;
  iconPath: string;
  tile: string;
  name: string;
  sharePct: string;
  shareBarW: number; // 0..100
  sub: string;
}
export interface ProjectCard {
  projectId: string;
  name: string;
  weeklyTarget: number;
  sub: string;
  stageLabel: string;
  nextStageLabel: string;
  stageHoursLabel: string;
  stagePct: number;
  streakLabel: string;
  weekShort: string;
  trendLabel: string;
  trendColor: string;
  habits: ProjectHabitRow[];
}
export interface ProjectsModel {
  sub: string;
  cards: ProjectCard[];
}

export function selectProjects(
  data: PersistedState,
  config: AppConfig,
  now: number
): ProjectsModel {
  const ctx = buildContext(data, now);
  const stages = stagesFor(config);

  const cards: ProjectCard[] = data.projects.map((p) => {
    const ps = ctx.projStats[p.id];
    const stage = stageOf(ps.life, stages);
    const next = nextStageOf(ps.life, stages);
    const h = ps.life / 3600;
    const stagePct = next
      ? Math.min(100, Math.round(((h - stage[1]) / (next[1] - stage[1])) * 100))
      : 100;
    const started = p.started ? new Date(p.started) : null;
    const startedLabel = started
      ? 'Started ' +
        MONTHS[started.getMonth()].slice(0, 3) +
        ' ' +
        started.getFullYear()
      : '';
    const pStreak = streakOf(daySecMap(data, now, ps.habits.map((x) => x.id)));
    const trend = trendOf(ps);
    const maxLife = Math.max(1, ...ps.habits.map((x) => ctx.habitStats[x.id].life));
    return {
      projectId: p.id,
      name: p.name,
      weeklyTarget: p.weeklyTarget || 8,
      sub: [startedLabel, fmtH(ps.life) + ' total', ps.count + ' sessions']
        .filter(Boolean)
        .join(' · '),
      stageLabel: stage[0],
      nextStageLabel: next
        ? '→ ' + next[0] + ' at ' + next[1] + 'h'
        : 'Highest stage',
      stageHoursLabel: h.toFixed(1) + 'h',
      stagePct,
      streakLabel: pStreak + 'd',
      weekShort: fmtH(ps.week),
      trendLabel: trend.label,
      trendColor: trend.color,
      habits: ps.habits
        .slice()
        .sort((a, b) => ctx.habitStats[b.id].life - ctx.habitStats[a.id].life)
        .map((x) => {
          const stt = ctx.habitStats[x.id];
          const share = ps.life > 0 ? Math.round((stt.life / ps.life) * 100) : 0;
          return {
            habitId: x.id,
            iconPath: iconPath(x.icon),
            tile: x.tile,
            name: x.name,
            sharePct: share + '%',
            shareBarW: Math.max(2, Math.round((stt.life / maxLife) * 100)),
            sub:
              fmtH(stt.life) +
              ' lifetime · ' +
              fmtHM(Math.floor(stt.week)) +
              ' this week · ' +
              stt.count +
              ' sessions',
          };
        }),
    };
  });

  return {
    sub:
      data.projects.length +
      (data.projects.length === 1 ? ' project · ' : ' projects · ') +
      data.habits.length +
      ' habits',
    cards,
  };
}

// ---------- STAGE SHEET ----------
export interface StageLadderRow {
  name: string;
  hoursLabel: string;
  current: boolean;
  done: boolean;
  dotBg: string;
  dotFg: string;
  nameColor: string;
  rowBg: string;
}
export interface StageSheetModel {
  projectName: string;
  currentStage: string;
  nextStage: string | null;
  hasNext: boolean;
  remainingLabel: string;
  progressPct: number;
  etaLabel: string;
  ladder: StageLadderRow[];
}

export function selectStageSheet(
  data: PersistedState,
  config: AppConfig,
  projectId: string,
  now: number
): StageSheetModel | null {
  const p = data.projects.find((x) => x.id === projectId);
  if (!p) return null;
  const ctx = buildContext(data, now);
  const ps = ctx.projStats[p.id];
  if (!ps) return null;
  const stages = stagesFor(config);
  const h = ps.life / 3600;
  const stage = stageOf(ps.life, stages);
  const next = nextStageOf(ps.life, stages);
  const paceH = ps.week / 3600;
  const remaining = next ? Math.max(0, next[1] - h) : 0;

  let etaLabel: string;
  if (!next) etaLabel = 'You’ve reached the highest stage.';
  else if (paceH >= 0.05) {
    const wk = remaining / paceH;
    etaLabel =
      wk <= 1
        ? 'About a week away at your current pace'
        : '~' + Math.ceil(wk) + ' weeks away at ' + paceH.toFixed(1) + 'h / week';
  } else etaLabel = 'Log some time this week to start closing the gap';

  const ladder: StageLadderRow[] = stages.map(([name, hrs]) => ({
    name,
    hoursLabel: hrs === 0 ? 'Start' : hrs + 'h',
    done: h >= hrs && name !== stage[0],
    current: name === stage[0],
    dotBg: name === stage[0] ? config.accent : h >= hrs ? '#17181A' : '#E3E4E8',
    dotFg: h >= hrs || name === stage[0] ? '#FFFFFF' : '#A9ACB3',
    nameColor:
      name === stage[0] ? '#17181A' : h >= hrs ? '#17181A' : '#A9ACB3',
    rowBg: name === stage[0] ? '#F4F5F7' : 'transparent',
  }));

  return {
    projectName: p.name,
    currentStage: stage[0],
    nextStage: next ? next[0] : null,
    hasNext: !!next,
    remainingLabel: next ? remaining.toFixed(1) + 'h to go' : 'Maxed out',
    progressPct: next
      ? Math.min(100, Math.round(((h - stage[1]) / (next[1] - stage[1])) * 100))
      : 100,
    etaLabel,
    ladder,
  };
}

// ---------- STATS ----------
export interface HeatCell {
  key: string | null;
  color: string;
  bcolor: string;
  selected: boolean;
}
export interface HeatRow {
  monthLabel: string;
  cells: HeatCell[];
}
export interface HeatSelRow {
  iconPath: string;
  tile: string;
  name: string;
  timeLabel: string;
}
/** One completed session on the selected heatmap day (tappable to edit). */
export interface HeatSelSession {
  id: string;
  iconPath: string;
  tile: string;
  name: string;
  /** e.g. "14:05–15:10 · chapter 3" */
  sub: string;
  timeLabel: string;
}
export interface DistRow {
  name: string;
  label: string;
  barW: number;
}
export interface HistoryRow {
  id: string;
  iconPath: string;
  tile: string;
  name: string;
  sub: string;
  timeLabel: string;
}
export interface Insight {
  iconPath: string;
  bg: string;
  text: string;
}
export interface StatsModel {
  sub: string;
  insights: Insight[];
  hasInsights: boolean;
  lifetimeLabel: string;
  lifetimeSub: string;
  weekHours: string;
  monthHours: string;
  avgDaily: string;
  recStreak: string;
  hasTopHabit: boolean;
  topHabitName: string;
  topHabitTile: string;
  topHabitIcon: string;
  topHabitHours: string;
  projDist: DistRow[];
  legendCells: string[];
  dayHeads: string[];
  heatRows: HeatRow[];
  heatFullRows: HeatRow[];
  heatRangeLabel: string;
  heatFullRangeLabel: string;
  heatOpenLabel: string;
  heatCanToggle: boolean;
  heatSelOpen: boolean;
  heatSelEmpty: boolean;
  heatSelDate: string;
  heatSelInfo: string;
  heatSelRows: HeatSelRow[];
  heatSelSessions: HeatSelSession[];
  historyRows: HistoryRow[];
  historyHasRows: boolean;
}

export function selectStats(
  data: PersistedState,
  config: AppConfig,
  now: number,
  ui: { heatSel: string | null }
): StatsModel {
  const ctx = buildContext(data, now);
  const todayD = ctx.todayD;
  const today = ctx.today;
  const mon = ctx.mon;
  const dayMap = daySecMap(data, now);

  const lifeAll = data.habits.reduce((a, h) => a + ctx.habitStats[h.id].life, 0);
  const weekAll = data.habits.reduce((a, h) => a + ctx.habitStats[h.id].week, 0);
  const monthAll = data.habits.reduce((a, h) => a + ctx.habitStats[h.id].month, 0);

  const allKeys = Object.keys(dayMap).sort();
  const firstDay = allKeys.length ? pkey(allKeys[0]) : todayD;
  const spanDays = Math.max(
    1,
    Math.round((todayD.getTime() - firstDay.getTime()) / 86400000) + 1
  );
  const avgSec = lifeAll / spanDays;

  // heatmap
  const baseWeeks = Math.min(20, Math.max(4, config.heatmapWeeks ?? 10));
  const lvlOf = (sec: number) =>
    sec <= 0 ? 0 : sec < 1800 ? 1 : sec < 3600 ? 2 : sec < 7200 ? 3 : 4;

  // Full history: from the Monday of the first-ever active day up to now. The
  // inline card shows recent weeks; a sheet shows the full history so years of
  // activity are never lost.
  const firstMon = monday(firstDay);
  const fullWeeks = Math.max(
    1,
    Math.round((mon.getTime() - firstMon.getTime()) / (7 * 86400000)) + 1
  );
  const heatCanToggle = fullWeeks > baseWeeks;
  const weeks = Math.min(baseWeeks, fullWeeks);

  // Build most-recent-on-top rows for the last `nWeeks` weeks, with month/year
  // gutter labels (a year label like "Jul '25" appears when the span crosses years).
  const buildHeatRows = (nWeeks: number): HeatRow[] => {
    const s = addDays(mon, -(nWeeks - 1) * 7);
    const multiYear = s.getFullYear() !== todayD.getFullYear();
    const built: { cells: HeatCell[]; month: number; year: number }[] = [];
    for (let w = 0; w < nWeeks; w++) {
      const cells: HeatCell[] = [];
      const rowStart = addDays(s, w * 7);
      for (let i = 0; i < 7; i++) {
        const d = addDays(s, w * 7 + i);
        if (d > todayD) {
          cells.push({
            key: null,
            color: 'transparent',
            bcolor: 'transparent',
            selected: false,
          });
          continue;
        }
        const key = dkey(d);
        cells.push({
          key,
          color: HEAT_SCALE[lvlOf(dayMap[key] || 0)],
          bcolor: 'rgba(23,24,26,0.07)',
          selected: ui.heatSel === key,
        });
      }
      built.push({ cells, month: rowStart.getMonth(), year: rowStart.getFullYear() });
    }
    built.reverse();
    const rows: HeatRow[] = [];
    let prevMonth = -1;
    let prevYear: number | null = null;
    for (const r of built) {
      let monthLabel = '';
      const yearChanged = prevYear !== null && r.year !== prevYear;
      if (yearChanged || (prevYear === null && multiYear)) {
        monthLabel = MONTHS[r.month].slice(0, 3) + " '" + String(r.year).slice(2);
      } else if (r.month !== prevMonth) {
        monthLabel = MONTHS[r.month].slice(0, 3);
      }
      rows.push({ cells: r.cells, monthLabel });
      prevMonth = r.month;
      prevYear = r.year;
    }
    return rows;
  };

  const start = addDays(mon, -(weeks - 1) * 7);
  const spanYears = start.getFullYear() !== todayD.getFullYear();
  const heatRows = buildHeatRows(weeks);
  // The history sheet shows at least ~6 months of past, and extends back to the
  // first active day for long-time users.
  const sheetWeeks = Math.max(fullWeeks, 26);
  const heatFullRows = buildHeatRows(sheetWeeks);
  const fullStart = addDays(mon, -(sheetWeeks - 1) * 7);

  // heat selection detail
  let heatSelRows: HeatSelRow[] = [];
  let heatSelSessions: HeatSelSession[] = [];
  let heatSelInfo = '';
  let heatSelDate = '';
  if (ui.heatSel) {
    const d = pkey(ui.heatSel);
    heatSelDate =
      DOWFULL[d.getDay()].slice(0, 3) +
      ', ' +
      MONTHS[d.getMonth()].slice(0, 3) +
      ' ' +
      d.getDate();
    const perHabit: Record<string, number> = {};
    for (const s of data.sessions) {
      if (dkey(new Date(s.start)) === ui.heatSel) {
        perHabit[s.habitId] = (perHabit[s.habitId] || 0) + s.duration;
      }
    }
    if (data.active && dkey(new Date(now)) === ui.heatSel) {
      perHabit[data.active.habitId] =
        (perHabit[data.active.habitId] || 0) + activeSec(data.active, now);
    }
    heatSelRows = Object.keys(perHabit)
      .map((hid) => {
        const h = data.habits.find((x) => x.id === hid);
        return h
          ? {
              iconPath: iconPath(h.icon),
              tile: h.tile,
              name: h.name,
              timeLabel: fmtHM(Math.floor(perHabit[hid])),
              sec: perHabit[hid],
            }
          : null;
      })
      .filter((x): x is HeatSelRow & { sec: number } => !!x)
      .sort((a, b) => b.sec - a.sec)
      .map(({ sec, ...rest }) => rest);
    const tot = Object.values(perHabit).reduce((a, x) => a + x, 0);
    heatSelInfo = tot > 0 ? fmtHM(Math.floor(tot)) + ' total' : 'No time logged';
    const hm = (ms: number) => {
      const t = new Date(ms);
      return pad(t.getHours()) + ':' + pad(t.getMinutes());
    };
    heatSelSessions = data.sessions
      .filter((s) => dkey(new Date(s.start)) === ui.heatSel)
      .sort((a, b) => a.start - b.start)
      .map((s) => {
        const h = data.habits.find((x) => x.id === s.habitId);
        return h
          ? {
              id: s.id,
              iconPath: iconPath(h.icon),
              tile: h.tile,
              name: h.name,
              sub: hm(s.start) + '–' + hm(s.end) + (s.notes ? ' · ' + s.notes : ''),
              timeLabel: fmtHM(s.duration),
            }
          : null;
      })
      .filter((x): x is HeatSelSession => !!x);
  }

  // longest streak across all history
  let recStreak = 0;
  let cur = 0;
  if (allKeys.length) {
    let prev: string | null = null;
    for (const k of allKeys) {
      if (prev && dkey(addDays(pkey(prev), 1)) === k) cur++;
      else cur = 1;
      recStreak = Math.max(recStreak, cur);
      prev = k;
    }
  }

  const topHabit =
    data.habits
      .slice()
      .sort((a, b) => ctx.habitStats[b.id].life - ctx.habitStats[a.id].life)[0] ||
    null;

  // insights (icon paths are 24x24 stroke glyphs: flame / bars / calendar)
  const FLAME_PATH =
    'M12 21c3.9 0 6.5-2.4 6.5-6 0-2.5-1.4-4.7-3-6.5-.3 1-.8 1.9-1.7 2.5C13.6 8.6 13 5.5 10 3c.3 2.5-.7 4.4-2.1 6C6.6 10.6 5.5 12.4 5.5 15c0 3.6 2.6 6 6.5 6z';
  const BARS_PATH = 'M5 20V12M12 20V4M19 20v-6';
  const CAL_PATH =
    'M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5v-11zM8 2.5V5M16 2.5V5M4 8.5h16';
  const lastWeekAll = data.habits.reduce(
    (a, h) => a + ctx.habitStats[h.id].lastWeek,
    0
  );
  const insights: Insight[] = [];
  const topWeekHabit = data.habits
    .slice()
    .sort((a, b) => ctx.habitStats[b.id].week - ctx.habitStats[a.id].week)[0];
  if (topWeekHabit && ctx.habitStats[topWeekHabit.id].week > 0) {
    insights.push({
      iconPath: FLAME_PATH,
      bg: '#FDE4D5',
      text:
        topWeekHabit.name +
        ' is leading this week with ' +
        fmtHM(Math.floor(ctx.habitStats[topWeekHabit.id].week)) +
        '.',
    });
  }
  if (weekAll > 0 || lastWeekAll > 0) {
    const d = weekAll - lastWeekAll;
    if (d >= 0)
      insights.push({
        iconPath: BARS_PATH,
        bg: '#D9F2E3',
        text: 'You’re ' + fmtH(d) + ' ahead of last week’s pace.',
      });
    else
      insights.push({
        iconPath: BARS_PATH,
        bg: '#D8EAF9',
        text: 'About ' + fmtHM(Math.floor(-d)) + ' more this week matches last week.',
      });
  }
  const wdTotals = [0, 0, 0, 0, 0, 0, 0];
  for (const s of data.sessions) wdTotals[new Date(s.start).getDay()] += s.duration;
  let bestWd = 0;
  for (let i = 1; i < 7; i++) if (wdTotals[i] > wdTotals[bestWd]) bestWd = i;
  if (wdTotals[bestWd] > 0) {
    insights.push({
      iconPath: CAL_PATH,
      bg: '#E4E0F7',
      text: 'You log the most time on ' + DOWFULL[bestWd] + 's.',
    });
  }

  const projDist: DistRow[] = data.projects
    .map((p) => ({ p, t: ctx.projStats[p.id].life }))
    .sort((a, b) => b.t - a.t)
    .map(({ p, t }) => ({
      name: p.name,
      label:
        lifeAll > 0
          ? Math.round((t / lifeAll) * 100) + '% · ' + fmtH(t)
          : fmtH(t),
      barW: lifeAll > 0 ? Math.max(2, Math.round((t / lifeAll) * 100)) : 2,
    }));

  const historyRows: HistoryRow[] = data.sessions
    .slice()
    .filter((s) => s.start > (data.historyClearedAt || 0))
    .sort((a, b) => b.start - a.start)
    .slice(0, 10)
    .map((s) => {
      const h = data.habits.find((x) => x.id === s.habitId);
      if (!h) return null;
      const d = new Date(s.start);
      const k = dkey(d);
      const dateLabel =
        k === today
          ? 'Today'
          : DOWFULL[d.getDay()].slice(0, 3) +
            ', ' +
            MONTHS[d.getMonth()].slice(0, 3) +
            ' ' +
            d.getDate();
      return {
        id: s.id,
        iconPath: iconPath(h.icon),
        tile: h.tile,
        name: h.name,
        sub:
          dateLabel +
          (s.manual ? ' · logged manually' : '') +
          (s.notes ? ' · ' + s.notes : ''),
        timeLabel: fmtHM(s.duration),
      };
    })
    .filter((x): x is HistoryRow => !!x);

  return {
    sub: data.sessions.length + ' sessions logged',
    insights,
    hasInsights: insights.length > 0,
    lifetimeLabel: (lifeAll / 3600).toFixed(1) + ' hours',
    lifetimeSub:
      'Since ' +
      MONTHS[firstDay.getMonth()].slice(0, 3) +
      ' ' +
      firstDay.getDate() +
      ' · avg ' +
      fmtHM(Math.floor(avgSec)) +
      ' / day',
    weekHours: fmtH(weekAll),
    monthHours: fmtH(monthAll),
    avgDaily: fmtHM(Math.floor(avgSec)),
    recStreak: recStreak + 'd',
    hasTopHabit: !!topHabit && ctx.habitStats[topHabit.id].life > 0,
    topHabitName: topHabit ? topHabit.name : '',
    topHabitTile: topHabit ? topHabit.tile : '#EEE',
    topHabitIcon: topHabit ? iconPath(topHabit.icon) : '',
    topHabitHours: topHabit ? fmtH(ctx.habitStats[topHabit.id].life) : '',
    projDist,
    legendCells: HEAT_SCALE.slice(),
    dayHeads: DOWS.map((d) => d[0]),
    heatRows,
    heatFullRows,
    heatRangeLabel:
      MONTHS[start.getMonth()].slice(0, 3) +
      ' ' +
      start.getDate() +
      (spanYears ? ', ' + start.getFullYear() : '') +
      ' – ' +
      MONTHS[todayD.getMonth()].slice(0, 3) +
      ' ' +
      todayD.getDate() +
      (spanYears ? ', ' + todayD.getFullYear() : ''),
    heatFullRangeLabel:
      MONTHS[fullStart.getMonth()].slice(0, 3) +
      ' ' +
      fullStart.getDate() +
      ', ' +
      fullStart.getFullYear() +
      ' – ' +
      MONTHS[todayD.getMonth()].slice(0, 3) +
      ' ' +
      todayD.getDate() +
      ', ' +
      todayD.getFullYear(),
    heatOpenLabel:
      'See full history · ' + fullWeeks + (fullWeeks === 1 ? ' week' : ' weeks'),
    heatCanToggle,
    heatSelOpen: !!ui.heatSel,
    heatSelEmpty: !!ui.heatSel && heatSelRows.length === 0,
    heatSelDate,
    heatSelInfo,
    heatSelRows,
    heatSelSessions,
    historyRows,
    historyHasRows: historyRows.length > 0,
  };
}

// ---------- TIMER ----------
export interface TimerModel {
  open: boolean;
  habitId: string;
  name: string;
  iconPath: string;
  tile: string;
  projectLabel: string;
  tracking: boolean;
  displaySec: number;
  ringProgress: number; // 0..1 over the current 30-min cycle
  ringColor: string;
}

export function selectTimer(
  data: PersistedState,
  config: AppConfig,
  now: number
): TimerModel | null {
  const active = data.active;
  const habit = active ? data.habits.find((h) => h.id === active.habitId) : null;
  if (!active || !habit) return null;
  const project = data.projects.find((p) => p.id === habit.projectId);
  const tracking = !!active.startedAt;
  const secs = activeSec(active, now);
  return {
    open: true,
    habitId: habit.id,
    name: habit.name,
    iconPath: iconPath(habit.icon),
    tile: habit.tile,
    projectLabel: project ? project.name : '',
    tracking,
    displaySec: secs,
    ringProgress: (secs % 1800) / 1800,
    ringColor: tracking ? config.accent : '#C9CBD1',
  };
}
