// What a reward chip says for a change in the game's totals (pure).

export interface Totals {
  xp: number;
  credits: number;
}

/** "+5 XP", "+5 credits", both, or null when nothing was gained. */
export function rewardChipText(before: Totals, after: Totals): string | null {
  const xp = after.xp - before.xp;
  const cr = after.credits - before.credits;
  const parts = [xp > 0 ? `+${xp} XP` : '', cr > 0 ? `+${cr} credits` : ''].filter(Boolean);
  return parts.length ? parts.join('  ') : null;
}
