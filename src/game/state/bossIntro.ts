// Which bosses have had their intro card this app session (World Mode,
// world-6). In memory only: a relaunch shows each boss's card once more.

const shown = new Set<string>();

/** True the first time `bossId` asks; marked at once, so minimizing and reopening the timer doesn't replay it. */
export function takeBossIntro(bossId: string): boolean {
  if (shown.has(bossId)) return false;
  shown.add(bossId);
  return true;
}
