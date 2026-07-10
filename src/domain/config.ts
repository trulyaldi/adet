// App-level configuration — the design exposed these as editor "props".
// Defaults match the Streak v2 design file.

export interface AppConfig {
  /** Accent color. Design options: #0A84FF, #34C759, #FF9F0A, #FF375F. */
  accent: string;
  /** Motivational quote shown on the timer. */
  timerQuote: string;
  /** Base number of weeks shown in the activity heatmap (collapsed). */
  heatmapWeeks: number;
  /** Hour thresholds for each stage; must align with STAGES length. */
  stageHours: number[];
}

export const DEFAULT_CONFIG: AppConfig = {
  accent: '#0A84FF',
  timerQuote: 'Small steps, every day.',
  heatmapWeeks: 10,
  stageHours: [0, 10, 25, 75, 150, 300, 600],
};
