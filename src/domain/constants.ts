import { IconKey, Stage } from './types';

// SVG path data for each habit icon (24x24 viewBox), ported verbatim from the design.
export const ICONS: Record<IconKey, string> = {
  code: 'M8 7l-5 5 5 5M16 7l5 5-5 5M13.5 4l-3 16',
  target:
    'M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0-18 0M12 12m-5 0a5 5 0 1 0 10 0a5 5 0 1 0-10 0M12 12m-1.2 0a1.2 1.2 0 1 0 2.4 0a1.2 1.2 0 1 0-2.4 0',
  book: 'M12 6.2C10 4.7 7.5 4.2 4 4.2v13.6c3.5 0 6 .5 8 2 2-1.5 4.5-2 8-2V4.2c-3.5 0-6 .5-8 2zM12 6.2v13.6',
  briefcase:
    'M4 8.5h16v10.5H4zM9 8.5V6a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 6v2.5M4 13h16',
  gym: 'M2.5 12h2M19.5 12h2M8 12h8M4.5 8.5v7M8 6v12M16 6v12M19.5 8.5v7',
  meditate:
    'M12 5c1.5 2.2 2.4 4.6 2.4 7.2 0 2.6-1.4 4.3-2.4 4.8-1-.5-2.4-2.2-2.4-4.8C9.6 9.6 10.5 7.2 12 5zM4 13c.5 4.5 4 7 8 7s7.5-2.5 8-7c-1.9 0-3.6.6-5 1.6M4 13c1.9 0 3.6.6 5 1.6',
  walk: 'M13.2 4.8a1.9 1.9 0 1 0 0-3.8 1.9 1.9 0 0 0 0 3.8zM12.7 7.2l-2.1 5.4 3 3.4-.9 6M10.6 12.6c-.5 2.2-1.6 3.8-3.4 5M12.7 7.2c1.7.3 2.9 1.3 3.5 2.9l2 1.4M12.7 7.2c-1.9.1-3.4 1-4.5 2.6',
  art: 'M12 3a9 9 0 1 0 0 18c1.5 0 2.2-.9 2.2-2 0-.6-.2-1-.2-1.6 0-1.1.9-2 2-2h2.1A3.9 3.9 0 0 0 21 12c0-5-4-9-9-9zM7.5 10.5h.01M10.5 7h.01M14.5 7h.01M17 10h.01',
  music: 'M9 18V5.5l11-2V16M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM20 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM9 9.5l11-2',
  pen: 'M4 20l1.2-4.6L15.8 4.8a2.3 2.3 0 0 1 3.3 3.3L8.6 18.8zM13.9 6.7l3.4 3.4M4 20h16',
  leaf: 'M5 19c0-8 5-14 15-14 0 10-6 15-14 15M5 19c3-4 6-6.5 9.5-8.5',
  globe: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3.5 9h17M3.5 15h17M12 3c-2.6 2.6-3.8 5.6-3.8 9s1.2 6.4 3.8 9M12 3c2.6 2.6 3.8 5.6 3.8 9s-1.2 6.4-3.8 9',
  heart: 'M12 20s-7.5-4.4-7.5-10.2A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.5 2.5C19.5 15.6 12 20 12 20z',
  chart: 'M4 4v16h16M8 15l3.5-4 3 2.5L19 8',
};

export const ICON_KEYS: IconKey[] = [
  'code',
  'target',
  'book',
  'briefcase',
  'gym',
  'meditate',
  'walk',
  'art',
  'music',
  'pen',
  'leaf',
  'globe',
  'heart',
  'chart',
];

export const TILES: string[] = [
  '#E4E0F7',
  '#D9F2E3',
  '#FDE4D5',
  '#FADCE8',
  '#D8EAF9',
  '#FBF0CE',
  '#E2EFDA',
  '#EFE3F5',
];

export const STAGES: Stage[] = [
  ['Novice', 0],
  ['Learner', 10],
  ['Builder', 25],
  ['Practitioner', 75],
  ['Professional', 150],
  ['Expert', 300],
  ['Master', 600],
];

export const DOWS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const DOWFULL = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];
export const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** Heatmap intensity scale (0..4). */
export const HEAT_SCALE = ['#EAEAF3', '#B4B4C4', '#7E7E8C', '#4C4C57', '#232327'];
