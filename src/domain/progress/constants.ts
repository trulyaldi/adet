// Thresholds for the Trail's verdicts (v2 N4). Neutral words only: a habit is
// rising, steady or resting, never "falling" or "behind".

/** Focused minutes up at least this share on last week (to the same moment). */
export const RISE_MINUTES = 0.15;
/** Measure per focused hour up at least this share. */
export const RISE_PER_HOUR = 0.1;
/** How many of the four signals make a habit "rising". */
export const RISE_SIGNALS = 2;
/** Weeks in the Trail's bar series (this one included). */
export const SERIES_WEEKS = 4;
