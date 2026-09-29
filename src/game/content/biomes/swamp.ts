import type { BiomeDef } from './layout';

export const swamp: BiomeDef = {
  id: 'swamp',
  bends: [0.78, 0.2, 0.75, 0.25, 0.7],
  landmarks: [{ id: 'landmark', x: 34, y: 330 }, { id: 'tree.a', x: 96, y: 240 }],
  scatter: { 'tree.a': 6, 'tree.b': 5, bush: 6, rock: 4, flowers: 8, tuft: 8, mushrooms: 6 },
  pools: [{ x: 40, y: 220 }, { x: 92, y: 110 }, { x: 30, y: 60 }],
  lights: [{ x: 60, y: 300 }, { x: 44, y: 150 }],
  critters: [
    { name: 'frog', x: 48, y: 240, wander: 6 },
    { name: 'frog', x: 86, y: 128, wander: 6 },
    { name: 'firefly', x: 70, y: 190, wander: 16 },
  ],
  villagers: [{ x: 94, y: 300, line: 1 }, { x: 30, y: 120, line: 4 }],
  ambient: { day: ['bubbles', 'fog'], night: ['fog', 'fireflies'] },
  parallax: [0.5, 0.25],
  lore: [
    'Every head of the Hydra is a tab. Close one.',
    'Long, unbroken stretches cut the deepest.',
    'The lanterns burn for travellers who keep going.',
    'Put the shiny thing face down. It will keep.',
    'Frogs sit still for ages, then leap. That works.',
    'The swamp is only murky until you pick a path.',
    'One task, one lantern. Walk toward it.',
    'You came back. That is the whole trick.',
  ],
  boss: {
    before: ['Just one more scroll, traveller.', 'Look how much there is to see!', 'You can start after this. Promise.'],
    defeat: 'The screens go dark. Listen: the swamp is singing.',
  },
};
