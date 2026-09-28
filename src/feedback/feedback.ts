// One call per moment: plays the matching sound and haptic (see Ticket 3).

export type FeedbackEvent =
  | 'tap'
  | 'session_start'
  | 'target_reached'
  | 'session_complete'
  | 'day_complete'
  | 'streak_up'
  | 'milestone'
  | 'undo';

export function feedback(_event: FeedbackEvent): void {}
