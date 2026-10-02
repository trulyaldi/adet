// Game words for everyday things (v2 N7.3), used only where the game word stays
// instantly clear: an icon plus one word. The plain word stays in what
// VoiceOver says, so both are heard. Forms and settings keep the plain word
// (a "Skill" field or a "Bounty" stepper would make you stop and think).

export interface Word {
  game: string;
  plain: string;
}

export const WORDS = {
  session: { game: 'Battle', plain: 'Focus session' },
  habit: { game: 'Skill', plain: 'Habit' },
  streak: { game: 'Campfire', plain: 'Streak' },
  weeklyTarget: { game: 'Bounty', plain: 'Weekly target' },
  note: { game: 'Chronicle', plain: 'Session note' },
  stats: { game: 'Almanac', plain: 'Stats' },
  freeze: { game: 'Ember shield', plain: 'Streak freeze' },
} as const satisfies Record<string, Word>;

/** What a screen reader says for a game word: both words ("Almanac, stats"). */
export function spoken(w: Word): string {
  return `${w.game}, ${w.plain.toLowerCase()}`;
}
