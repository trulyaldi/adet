import type { BiomeDef } from './layout';

export const volcano: BiomeDef = {
  id: 'volcano',
  bends: [0.78, 0.25, 0.75, 0.22, 0.7],
  landmarks: [{ id: 'landmark', x: 34, y: 330 }, { id: 'tree.b', x: 96, y: 230 }],
  scatter: { 'tree.a': 5, 'tree.b': 4, bush: 5, rock: 6, flowers: 5, tuft: 8, mushrooms: 4 },
  pools: [{ x: 94, y: 300 }, { x: 30, y: 170 }, { x: 88, y: 90 }],
  lights: [{ x: 60, y: 210 }],
  critters: [
    { name: 'beetle', x: 52, y: 280, wander: 8 },
    { name: 'beetle', x: 78, y: 140, wander: 8 },
  ],
  villagers: [{ x: 96, y: 170, line: 2 }, { x: 30, y: 280, line: 5 }],
  ambient: { day: ['embers', 'ash'], night: ['embers'] },
  parallax: [0.45, 0.25],
  lore: [
    'The Drake feeds on nights without sleep.',
    'Steady days hit harder than scorched ones.',
    'A rest day is not lost. It is armour.',
    'Grinding only makes the Drake stronger.',
    'One to four hours: the sweet spot.',
    'Cool water, warm fire, gentle pace.',
    'You are allowed to stop before you burn.',
    'Embers last longest when banked with care.',
  ],
  boss: {
    before: ['Faster. Longer. Never stop.', 'Rest is for the weak, surely?', 'Burn everything. I will wait.'],
    defeat: 'The Drake finally sleeps. So can you, tonight.',
  },
};
