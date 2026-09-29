import type { BiomeDef } from './layout';

export const iron: BiomeDef = {
  id: 'iron',
  bends: [0.22, 0.8, 0.28, 0.76, 0.3],
  landmarks: [{ id: 'landmark', x: 94, y: 330 }, { id: 'bush', x: 30, y: 240 }, { id: 'tree.b', x: 92, y: 170 }],
  scatter: { 'tree.a': 5, 'tree.b': 2, bush: 3, rock: 4, flowers: 8, tuft: 8, mushrooms: 3 },
  pools: [{ x: 32, y: 120 }],
  lights: [{ x: 60, y: 280 }, { x: 84, y: 100 }],
  critters: [
    { name: 'pigeon', x: 70, y: 220, wander: 10 },
    { name: 'pigeon', x: 40, y: 60, wander: 8 },
  ],
  villagers: [{ x: 30, y: 300, line: 1 }, { x: 98, y: 240, line: 7 }],
  ambient: { day: ['leaves'], night: ['fireflies'] },
  parallax: [0.5, 0.3],
  lore: [
    'King Tomorrow rules only the days you give him.',
    'Morning sessions ring the castle bells loudest.',
    'Today is the only day with a door.',
    'The banners fly for work actually done.',
    'Pigeons carry no scrolls marked "later".',
    'Knights are not fearless. They just start anyway.',
    'Keep the torch lit. Ten minutes is enough.',
    'The throne of later is always empty.',
  ],
  boss: {
    before: ['Why today, when tomorrow is so lovely?', 'Rest. My kingdom has no deadlines.', 'Tomorrow, you will surely feel ready.'],
    defeat: 'The crown rolls away. Today, it turns out, was enough.',
  },
};
