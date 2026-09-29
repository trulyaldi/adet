// The one way ceremonies are asked for: after the Loot sheet closes (opened
// or "Later"), on Quest tab focus (after the map's reveal) and on app
// foreground. The host mounted at the app root decides what, if anything,
// plays. Until it mounts, a request is a no-op.

type Evaluator = () => void;

let evaluator: Evaluator | null = null;

/** The host registers itself; returns the unregister. */
export function setCeremonyEvaluator(fn: Evaluator): () => void {
  evaluator = fn;
  return () => {
    if (evaluator === fn) evaluator = null;
  };
}

export const ceremonyHost = {
  evaluate(): void {
    evaluator?.();
  },
};
