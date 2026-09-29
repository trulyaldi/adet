import type { BiomeDef } from './layout';

export const desert: BiomeDef = {
  id: 'desert',
  bends: [0.25, 0.78, 0.2, 0.75, 0.35],
  landmarks: [{ id: 'landmark', x: 96, y: 326 }, { id: 'tree.a', x: 28, y: 200 }],
  scatter: { 'tree.a': 5, 'tree.b': 7, bush: 5, rock: 6, flowers: 4, tuft: 8, mushrooms: 4 },
  pools: [{ x: 86, y: 150 }],
  lights: [{ x: 40, y: 280 }],
  critters: [
    { name: 'lizard', x: 60, y: 250, wander: 12 },
    { name: 'lizard', x: 90, y: 80, wander: 10 },
  ],
  villagers: [{ x: 30, y: 300, line: 2 }, { x: 98, y: 110, line: 5 }],
  ambient: { day: ['heat', 'sand'], night: ['stars'] },
  parallax: [0.55, 0.3],
  lore: [
    'Busy is not the same as done.',
    'The Djinn loves a list with no finish line.',
    'Pick the task that matters. Mirages fade after.',
    'Water first, then the dunes. Care for yourself.',
    'A finished weak point hits twice as hard here.',
    'Sand shifts. Small, real steps stay put.',
    'Check it off. Watch the mirage flicker.',
    'The obelisk points up. So can you.',
  ],
  boss: {
    before: ['So many little tasks, so little time!', 'Sort them, colour them, sort them again.', 'Surely the big one can wait?'],
    defeat: 'The mirage melts. What remains is real, and it is yours.',
  },
};
