// A one-shot guard for taps that must act once: Done on the timer, and the
// result buttons. The first take wins until it's released.

export interface Latch {
  /** True for the first call; false until released. */
  take(): boolean;
  release(): void;
}

export function createLatch(): Latch {
  let held = false;
  return {
    take() {
      if (held) return false;
      held = true;
      return true;
    },
    release() {
      held = false;
    },
  };
}
