import type { BiomeDef } from './layout';

export const astral: BiomeDef = {
  id: 'astral',
  bends: [0.24, 0.78, 0.22, 0.8, 0.35],
  landmarks: [{ id: 'landmark', x: 96, y: 330 }, { id: 'tree.a', x: 28, y: 230 }],
  scatter: { 'tree.a': 5, 'tree.b': 5, bush: 4, rock: 5, flowers: 7, tuft: 10, mushrooms: 4 },
  pools: [{ x: 90, y: 180 }],
  lights: [{ x: 36, y: 120 }],
  critters: [
    { name: 'wisp', x: 60, y: 270, wander: 14 },
    { name: 'wisp', x: 86, y: 100, wander: 12 },
  ],
  villagers: [{ x: 30, y: 310, line: 0 }, { x: 98, y: 250, line: 6 }],
  ambient: { day: ['stars', 'spores'], night: ['stars', 'aurora'] },
  parallax: [0.4, 0.2],
  lore: [
    'The Echo only repeats what you let it.',
    'Your chronicle is proof. Read it aloud.',
    'Doubt is loud. Evidence is louder.',
    'Every line you wrote is a stepping stone.',
    'The stars were always there. So were you.',
    'You climbed six lands to stand here.',
    'Write what you did. Let it answer back.',
    'The summit is not the end. Only a view.',
  ],
  boss: {
    before: ['Who are you to be here?', 'Everyone else is further along.', 'Are you sure you belong up here?'],
    defeat: 'The Echo fades into your own voice, and it is kind.',
  },
};
