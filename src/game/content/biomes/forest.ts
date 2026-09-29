import type { BiomeDef } from './layout';

export const forest: BiomeDef = {
  id: 'forest',
  bends: [0.22, 0.8, 0.25, 0.78, 0.3],
  landmarks: [{ id: 'landmark', x: 94, y: 334 }, { id: 'tree.a', x: 30, y: 250 }],
  scatter: { 'tree.a': 7, 'tree.b': 6, bush: 7, rock: 4, flowers: 8, tuft: 10, mushrooms: 4 },
  pools: [{ x: 88, y: 200 }],
  lights: [{ x: 70, y: 130 }],
  critters: [
    { name: 'rabbit', x: 36, y: 300, wander: 10 },
    { name: 'bird', x: 92, y: 120, wander: 14 },
    { name: 'rabbit', x: 80, y: 60, wander: 8 },
  ],
  villagers: [{ x: 34, y: 170, line: 0 }, { x: 96, y: 280, line: 3 }],
  ambient: { day: ['leaves'], night: ['fireflies'] },
  parallax: [0.55, 0.3],
  lore: [
    'The fog lifts a little every time you begin.',
    'Small sessions count. Moss grows one sprout at a time.',
    'Rest by the fire. The path will wait for you.',
    'Name one weak point. Strike it first.',
    'Rabbits never rush, and they still get everywhere.',
    'A quiet mind is a sharp blade.',
    'Write one line after. Future you will thank you.',
    'The old stump remembers every traveller. Kindly.',
  ],
  boss: {
    before: ['I am the haze that settles on your thoughts.', 'Stay a while. Thinking can wait.', 'Or… will you simply begin?'],
    defeat: 'The fog clears. The forest has never looked so bright.',
  },
};
