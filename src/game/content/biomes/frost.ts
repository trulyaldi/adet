import type { BiomeDef } from './layout';

export const frost: BiomeDef = {
  id: 'frost',
  bends: [0.75, 0.22, 0.78, 0.25, 0.72],
  landmarks: [{ id: 'landmark', x: 34, y: 330 }, { id: 'mushrooms', x: 94, y: 230 }],
  scatter: { 'tree.a': 7, 'tree.b': 6, bush: 5, rock: 5, flowers: 6, tuft: 4, mushrooms: 1 },
  pools: [{ x: 30, y: 150 }],
  lights: [{ x: 86, y: 300 }],
  critters: [
    { name: 'fox', x: 50, y: 260, wander: 12 },
    { name: 'fox', x: 88, y: 90, wander: 10 },
  ],
  villagers: [{ x: 96, y: 170, line: 0 }, { x: 30, y: 70, line: 6 }],
  ambient: { day: ['snow'], night: ['snow', 'aurora'] },
  parallax: [0.5, 0.28],
  lore: [
    'Starting is the hardest part. After that, you glide.',
    'The first ten minutes melt the most ice.',
    'Even the Titan moves once warmed up.',
    'Cold mornings ask for small beginnings.',
    'A fox never waits to feel ready.',
    'The aurora shows up for those who look up.',
    'One step breaks the stillness. Take it.',
    'Snow keeps footprints. So does practice.',
  ],
  boss: {
    before: ['Why move at all?', 'Stillness is so comfortable.', 'Stay frozen with me… just today.'],
    defeat: 'The ice cracks and sings. You were never really stuck.',
  },
};
