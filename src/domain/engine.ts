// Framework-free selectors + calculations, ported from the design's renderVals().
// These return plain data only; UI attaches press handlers from the store.

import { AppConfig } from './config';
import { ICONS, MONTHS, DOWFULL, DOWS, HEAT_SCALE, STAGES } from './constants';
import { addDays, dkey, fmtH, fmtHM, monday, pad, pkey } from './time';
import { dailyStreak, weeklyTargetStreak } from './streaks';
import { timeOfDay } from './insights';
import { activeProjects, archivedProjects, isArchived } from './projects';
import { weekPace } from './weeks';
import { Completion, completionOf, habitDaySec, HabitDays } from './plan';
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

/**
 * This week vs last week. Non-punitive: gains read as progress, shortfalls as
 * a plain amount in neutral gray (never red), and a change under a minute is
 * neutral ("—"), never an arrow.
 */
export function trendOf(ps: { week: number; lastWeek: number }) {
  const d = ps.week - ps.lastWeek;
  if (Math.abs(d) < 60) return { label: '—', sub: 'same as last week', color: '#8A8D93' };
  if (d > 0) return { label: '↑ ' + fmtH(d), sub: 'vs last week', color: '#1F8A3B' };
  return { label: '↓ ' + fmtH(-d), sub: 'vs last week', color: '#8A8D93' };
}

function iconPath(icon: IconKey): string {
  return ICONS[icon] || ICONS.code;
}

/** A project's week against its target, as shown on Projects. */
function weekProgress(weekSec: number, targetHours: number, now: number) {
  const pace = weekPace(weekSec, targetHours, now);
  const pct = pace.targetSec ? Math.min(100, Math.round((weekSec / pace.targetSec) * 100)) : 0;
  return {
    /** Numbers only, e.g. "3.5h / 8h" (the card's clock glyph says "this week"). */
    weekLabel: pace.targetSec ? fmtH(weekSec) + ' / ' + fmtH(pace.targetSec) : fmtH(weekSec),
    weekPct: pct,
    barColor: pct >= 100 ? '#34C759' : '#17181A',
    // Without a target the pace label would just repeat the week's time.
    paceLabel: pace.kind === 'noTarget' ? '' : pace.label,
    paceMet: pace.kind === 'met',
  };
}

/** Local clock time, e.g. "14:05". */
function clockTime(ms: number): string {
  const t = new Date(ms);
  return pad(t.getHours()) + ':' + pad(t.getMinutes());
}

/** A session's start time and duration, e.g. "14:05 · 45m", plus a manual-log marker. */
export function sessionLine(s: Session): string {
  return clockTime(s.start) + ' · ' + fmtHM(s.duration) + (s.manual ? ' · logged manually' : '');
}

/** "Today", "Yesterday", else e.g. "Sun, Sep 27". */
export function dayLabel(key: string, now: number): string {
  const today = new Date(now);
  if (key === dkey(today)) return 'Today';
  if (key === dkey(addDays(today, -1))) return 'Yesterday';
  const d = pkey(key);
  return DOWFULL[d.getDay()].slice(0, 3) + ', ' + MONTHS[d.getMonth()].slice(0, 3) + ' ' + d.getDate();
}

/** "5d streak", "" with no streak. Never a nudge when it's at risk. */
function streakText(streak: { current: number; atRisk: boolean }): string {
  return streak.current > 0 ? streak.current + 'd streak' : '';
}

// ---------- PROJECTS ----------
export interface ProjectHabitRow {
  habitId: string;
  iconPath: string;
  tile: string;
  name: string;
  /** "40%" of the project's time; "" when the project has a single habit. */
  shareLabel: string;
  /** Share of the project's lifetime time, 0..100. */
  shareBarW: number;
  /** Lifetime time, e.g. "12h"; "" for a single habit (the project's numbers already say it). */
  sub: string;
}
export interface ProjectCard {
  projectId: string;
  name: string;
  weeklyTarget: number;
  // Collapsed
  /** e.g. "3.5h / 8h this week". */
  weekLabel: string;
  weekPct: number;
  barColor: string;
  /** Pace toward this week's target (see weekPace); "" without a target. */
  paceLabel: string;
  paceMet: boolean;
  /** e.g. "5d streak"; "" with no streak. */
  streakLabel: string;
  streakAtRisk: boolean;
  // Expanded
  stageLabel: string;
  /** e.g. "→ Builder at 25h" or "Highest stage". */
  nextStageLabel: string;
  stagePct: number;
  /** Lifetime hours, e.g. "12.5h". */
  lifetimeLabel: string;
  sessionsLabel: string;
  /** Consecutive weeks meeting the weekly target, e.g. "3w". */
  weekStreakLabel: string;
  /** Consecutive weeks meeting the weekly target (shown with the chain glyph). */
  weekStreak: number;
  trendLabel: string;
  trendColor: string;
  /** e.g. "Jul 2026" (shown with the calendar glyph); "" when unknown. */
  startedLabel: string;
  habits: ProjectHabitRow[];
}
/** An archived project, listed in the collapsed "Archived" section. */
export interface ArchivedCard {
  projectId: string;
  name: string;
  /** e.g. "12.5h · Sep 2026" (lifetime, then when it was archived). */
  sub: string;
}
export interface ProjectsModel {
  sub: string;
  cards: ProjectCard[];
  archived: ArchivedCard[];
}

export function selectProjects(
  data: PersistedState,
  config: AppConfig,
  now: number
): ProjectsModel {
  const ctx = buildContext(data, now);
  const stages = stagesFor(config);

  const active = activeProjects(data);
  const activeIds = new Set(active.map((p) => p.id));
  const habitCount = data.habits.filter((h) => activeIds.has(h.projectId)).length;

  const cards: ProjectCard[] = active.map((p) => {
    const ps = ctx.projStats[p.id];
    const stage = stageOf(ps.life, stages);
    const next = nextStageOf(ps.life, stages);
    const h = ps.life / 3600;
    const stagePct = next
      ? Math.min(100, Math.round(((h - stage[1]) / (next[1] - stage[1])) * 100))
      : 100;
    const started = p.started ? new Date(p.started) : null;
    const pDays = daySecMap(data, now, ps.habits.map((x) => x.id));
    const streak = dailyStreak(pDays, now);
    const trend = trendOf(ps);
    const several = ps.habits.length >= 2;
    const weekStreak = weeklyTargetStreak(pDays, p.weeklyTarget, now);
    return {
      projectId: p.id,
      name: p.name,
      weeklyTarget: p.weeklyTarget || 8,
      ...weekProgress(ps.week, p.weeklyTarget, now),
      streakLabel: streakText(streak),
      streakAtRisk: streak.atRisk,
      stageLabel: stage[0],
      nextStageLabel: next ? '→ ' + next[0] + ' at ' + next[1] + 'h' : 'Highest stage',
      stagePct,
      lifetimeLabel: fmtH(ps.life),
      sessionsLabel: String(ps.count),
      weekStreakLabel: weekStreak + 'w',
      weekStreak,
      trendLabel: trend.label,
      trendColor: trend.color,
      startedLabel: started ? MONTHS[started.getMonth()].slice(0, 3) + ' ' + started.getFullYear() : '',
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
            shareLabel: several ? share + '%' : '',
            shareBarW: share,
            sub: several ? fmtH(stt.life) : '',
          };
        }),
    };
  });

  const archived: ArchivedCard[] = archivedProjects(data).map((p) => {
    const at = new Date(p.archivedAt!);
    return {
      projectId: p.id,
      name: p.name,
      sub: fmtH(ctx.projStats[p.id].life) + ' · ' + MONTHS[at.getMonth()].slice(0, 3) + ' ' + at.getFullYear(),
    };
  });

  return {
    sub:
      active.length +
      (active.length === 1 ? ' project · ' : ' projects · ') +
      habitCount +
      (habitCount === 1 ? ' habit' : ' habits'),
    cards,
    archived,
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
  } else etaLabel = '';

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
/** One completed session on the selected heatmap day (tappable to edit). */
export interface HeatSelSession {
  id: string;
  iconPath: string;
  tile: string;
  name: string;
  /** Start time and duration, e.g. "14:05 · 45m" (see sessionLine). */
  sub: string;
  /** The session note, shown on its own line; "" when none. */
  note: string;
  /** The habit's completion that day (see dayMarks). */
  mark: Completion | null;
  /** Done that day outside its plan. */
  bonus: boolean;
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
  /** Start time and duration, e.g. "14:05 · 45m · logged manually" (see sessionLine). */
  sub: string;
  /** The session note, shown on its own line; "" when none. */
  note: string;
  /** The habit's completion that day (see dayMarks). */
  mark: Completion | null;
  /** Done that day outside its plan. */
  bonus: boolean;
}
/** Recent sessions that started on one local day, newest first. */
export interface HistoryDay {
  key: string;
  /** "Today", "Yesterday" or e.g. "Sun, Sep 27". */
  label: string;
  rows: HistoryRow[];
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
  /** "2h 05m total" with 2+ sessions or a timer running that day; "" for a lone session (its row says it). */
  heatSelInfo: string;
  heatSelSessions: HeatSelSession[];
  historyRows: HistoryRow[];
  /** historyRows grouped under a header per day. */
  historyDays: HistoryDay[];
  historyHasRows: boolean;
}

/**
 * The vs-last-week insight (this week so far against last week in full), or
 * null when last week had nothing to compare with or this week is behind it.
 */
export function weekVsLastWeek(weekSec: number, lastWeekSec: number, iconPath = ''): Insight | null {
  if (lastWeekSec <= 0) return null;
  const d = weekSec - lastWeekSec;
  if (Math.abs(d) < 60) return { iconPath, bg: '#D9F2E3', text: 'You’ve matched last week’s total.' };
  if (d > 0) return { iconPath, bg: '#D9F2E3', text: 'You’re ' + fmtH(d) + ' past last week’s total.' };
  // Behind last week is never framed as a shortfall to make up.
  return null;
}

/**
 * A habit-day's completion goes on one of its rows only (the first one given
 * for that habit and day), so a day with several sessions shows it once. It's
 * a bonus when that day had a plan without the habit (days from before plans
 * existed have none, so they show no bonus badge).
 */
function dayMarks(data: PersistedState, days: HabitDays) {
  const seen = new Set<string>();
  return (habitId: string, start: number): { mark: Completion | null; bonus: boolean } => {
    const k = dkey(new Date(start));
    const key = habitId + '|' + k;
    if (seen.has(key)) return { mark: null, bonus: false };
    seen.add(key);
    const h = data.habits.find((x) => x.id === habitId);
    const mark = h ? completionOf(h, days.get(h.id)?.get(k) ?? 0) : null;
    const plan = data.plans[k];
    return { mark, bonus: !!mark && !!plan && !plan.includes(habitId) };
  };
}

export function selectStats(
  data: PersistedState,
  config: AppConfig,
  now: number,
  ui: { heatSel: string | null }
): StatsModel {
  const ctx = buildContext(data, now);
  const todayD = ctx.todayD;
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
  let heatSelSessions: HeatSelSession[] = [];
  let heatSelInfo = '';
  let heatSelDate = '';
  let heatSelEmpty = false;
  if (ui.heatSel) {
    const d = pkey(ui.heatSel);
    heatSelDate =
      DOWFULL[d.getDay()].slice(0, 3) +
      ', ' +
      MONTHS[d.getMonth()].slice(0, 3) +
      ' ' +
      d.getDate();
    // The day's time: its sessions, plus a timer running today.
    const known = new Set(data.habits.map((h) => h.id));
    const parts = data.sessions
      .filter((s) => known.has(s.habitId) && dkey(new Date(s.start)) === ui.heatSel)
      .map((s) => s.duration);
    const running = !!data.active && known.has(data.active.habitId) && dkey(new Date(now)) === ui.heatSel;
    if (running) parts.push(activeSec(data.active, now));
    const tot = parts.reduce((a, x) => a + x, 0);
    heatSelEmpty = tot <= 0;
    // A lone session's time is already on its row; a running timer has no row.
    heatSelInfo = parts.length >= 2 || running ? fmtHM(Math.floor(tot)) + ' total' : '';
    const markSel = dayMarks(data, habitDaySec(data, now));
    heatSelSessions = data.sessions
      .filter((s) => dkey(new Date(s.start)) === ui.heatSel)
      .sort((a, b) => b.start - a.start)
      .map((s) => {
        const h = data.habits.find((x) => x.id === s.habitId);
        return h
          ? {
              id: s.id,
              iconPath: iconPath(h.icon),
              tile: h.tile,
              name: h.name,
              sub: sessionLine(s),
              note: s.notes ?? '',
              ...markSel(s.habitId, s.start),
            }
          : null;
      })
      .filter((x): x is HeatSelSession => !!x)
      // Marked newest-first (the day's last session), listed oldest first.
      .reverse();
  }

  // Insights: one card, each fact once. (Icon paths are 24x24 stroke glyphs:
  // flame / bars / calendar / clock.)
  const FLAME_PATH =
    'M12 21c3.9 0 6.5-2.4 6.5-6 0-2.5-1.4-4.7-3-6.5-.3 1-.8 1.9-1.7 2.5C13.6 8.6 13 5.5 10 3c.3 2.5-.7 4.4-2.1 6C6.6 10.6 5.5 12.4 5.5 15c0 3.6 2.6 6 6.5 6z';
  const BARS_PATH = 'M5 20V12M12 20V4M19 20v-6';
  const CAL_PATH =
    'M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5v-11zM8 2.5V5M16 2.5V5M4 8.5h16';
  const CLOCK_PATH = 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2';
  const lastWeekAll = data.habits.reduce(
    (a, h) => a + ctx.habitStats[h.id].lastWeek,
    0
  );
  const insights: Insight[] = [];
  const byWeek = data.habits
    .filter((h) => ctx.habitStats[h.id].week > 0)
    .sort((a, b) => ctx.habitStats[b.id].week - ctx.habitStats[a.id].week);
  const byLife = data.habits
    .filter((h) => ctx.habitStats[h.id].life > 0)
    .sort((a, b) => ctx.habitStats[b.id].life - ctx.habitStats[a.id].life);
  // With a single habit these would only repeat the This week / Lifetime totals.
  const weekLeader = byWeek.length >= 2 ? byWeek[0] : null;
  const lifeLeader = byLife.length >= 2 ? byLife[0] : null;
  if (weekLeader) {
    const both = lifeLeader === weekLeader;
    insights.push({
      iconPath: FLAME_PATH,
      bg: '#FDE4D5',
      text:
        weekLeader.name +
        ' is leading this week with ' +
        fmtH(ctx.habitStats[weekLeader.id].week) +
        (both ? ', and overall with ' + fmtH(ctx.habitStats[weekLeader.id].life) : '') +
        '.',
    });
  }
  if (lifeLeader && lifeLeader !== weekLeader) {
    insights.push({
      iconPath: FLAME_PATH,
      bg: '#FDE4D5',
      text: lifeLeader.name + ' is your most-tracked habit, with ' + fmtH(ctx.habitStats[lifeLeader.id].life) + ' in total.',
    });
  }
  const vsLast = weekVsLastWeek(weekAll, lastWeekAll, BARS_PATH);
  if (vsLast) insights.push(vsLast);
  const wdTotals = [0, 0, 0, 0, 0, 0, 0];
  for (const s of data.sessions) wdTotals[new Date(s.start).getDay()] += s.duration;
  let bestWd = 0;
  for (let i = 1; i < 7; i++) if (wdTotals[i] > wdTotals[bestWd]) bestWd = i;
  if (wdTotals[bestWd] > 0) {
    insights.push({
      iconPath: CAL_PATH,
      bg: '#E4E0F7',
      text: DOWFULL[bestWd] + 's are your busiest day.',
    });
  }
  // Time of day across all projects; the Patterns card no longer repeats it.
  const tod = timeOfDay(data, null, now).insight;
  if (tod) insights.push({ iconPath: CLOCK_PATH, bg: '#FFF1CC', text: tod });

  const projDist: DistRow[] = data.projects
    .map((p) => ({ p, t: ctx.projStats[p.id].life }))
    .sort((a, b) => b.t - a.t)
    .map(({ p, t }) => ({
      // Archived projects' history still counts here.
      name: isArchived(p) ? p.name + ' (archived)' : p.name,
      label:
        lifeAll > 0
          ? Math.round((t / lifeAll) * 100) + '% · ' + fmtH(t)
          : fmtH(t),
      barW: lifeAll > 0 ? Math.max(2, Math.round((t / lifeAll) * 100)) : 2,
    }));

  const recent = data.sessions
    .filter((s) => s.start > (data.historyClearedAt || 0) && data.habits.some((h) => h.id === s.habitId))
    .sort((a, b) => b.start - a.start)
    .slice(0, 10);
  const historyDays: HistoryDay[] = [];
  const markRow = dayMarks(data, habitDaySec(data, now));
  for (const s of recent) {
    const h = data.habits.find((x) => x.id === s.habitId)!;
    const key = dkey(new Date(s.start));
    let day = historyDays[historyDays.length - 1];
    if (!day || day.key !== key) {
      day = { key, label: dayLabel(key, now), rows: [] };
      historyDays.push(day);
    }
    day.rows.push({
      id: s.id,
      iconPath: iconPath(h.icon),
      tile: h.tile,
      name: h.name,
      sub: sessionLine(s),
      note: s.notes ?? '',
      ...markRow(s.habitId, s.start),
    });
  }
  const historyRows: HistoryRow[] = historyDays.flatMap((d) => d.rows);

  return {
    sub: data.sessions.length + ' sessions logged',
    insights,
    hasInsights: insights.length > 0,
    lifetimeLabel: (lifeAll / 3600).toFixed(1) + ' hours',
    // The average per day has its own tile, so it isn't repeated here.
    lifetimeSub: MONTHS[firstDay.getMonth()].slice(0, 3) + ' ' + firstDay.getDate(),
    weekHours: fmtH(weekAll),
    monthHours: fmtH(monthAll),
    avgDaily: fmtHM(Math.floor(avgSec)),
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
    heatSelEmpty,
    heatSelDate,
    heatSelInfo,
    heatSelSessions,
    historyRows,
    historyDays,
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
  tracking: boolean;
  displaySec: number;
  /** The session length aimed for, in minutes (full or minimum). */
  goalMin: number;
  /** Whether the goal is the minimum (half circle) rather than the full length. */
  goalIsMin: boolean;
  /** 0..1 toward the goal, counting today's earlier time on the habit. */
  ringProgress: number;
  /** Today's time on the habit reached the goal: the timer keeps running, but the ring shows done. */
  reached: boolean;
  ringColor: string;
}

/**
 * The running timer. `goalMin` is the length chosen at start; without one
 * (a timer resumed after a restart, or from another device) it's the full
 * length. Progress counts today's earlier sessions too, since completion is
 * judged on the day's total.
 */
export function selectTimer(
  data: PersistedState,
  config: AppConfig,
  now: number,
  goalMin?: number
): TimerModel | null {
  const active = data.active;
  const habit = active ? data.habits.find((h) => h.id === active.habitId) : null;
  if (!active || !habit) return null;
  const tracking = !!active.startedAt;
  const secs = activeSec(active, now);
  const today = dkey(new Date(now));
  const earlier = habitSec(data, now, habit.id, (s) => dkey(new Date(s.start)) === today) - secs;
  const goal = Math.max(1, goalMin ?? habit.dailyTargetMin);
  const progress = Math.min(1, (earlier + secs) / (goal * 60));
  return {
    open: true,
    habitId: habit.id,
    name: habit.name,
    iconPath: iconPath(habit.icon),
    tile: habit.tile,
    tracking,
    displaySec: secs,
    goalMin: goal,
    goalIsMin: goal < habit.dailyTargetMin,
    ringProgress: progress,
    reached: progress >= 1,
    ringColor: tracking ? config.accent : '#C9CBD1',
  };
}
