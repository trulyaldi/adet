// Pacing: calendar days each biome takes for daily-effort profiles.
//
//   npm run game:balance

import { PROFILES, simulate } from '../src/domain/game/balanceSim';
import { BIOME_IDS } from '../src/domain/game/biomes';

const SEEDS = [1, 2, 3, 4, 5];
console.log(`profile    ${BIOME_IDS.map((b) => b.padStart(8)).join('')}   total   (staggered days per boss)`);
for (const p of PROFILES) {
  const runs = SEEDS.map((s) => simulate(p, s));
  const avg = BIOME_IDS.map((_, b) => {
    const v = runs.map((r) => r.daysPerBiome[b]).filter((x): x is number => x !== null);
    return v.length === runs.length ? v.reduce((a, x) => a + x, 0) / v.length : null;
  });
  const stag = BIOME_IDS.map((_, b) => runs.reduce((a, r) => a + r.staggeredDays[b], 0) / runs.length);
  const total = avg.every((x) => x !== null) ? avg.reduce((a, x) => a + x!, 0) : null;
  console.log(
    `${p.name.padEnd(10)} ${avg.map((x) => (x === null ? '—' : x.toFixed(1)).padStart(8)).join('')}  ${total === null ? '   —' : total.toFixed(0).padStart(5)}   (${stag.map((x) => x.toFixed(1)).join(' ')})`
  );
}
