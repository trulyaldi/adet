import { useEffect, useMemo } from 'react';
import {
  cancelAnimation,
  Easing,
  SharedValue,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { IlmekState, RIG, SHADOW_IN_AIR } from './art';

/**
 * Ilmek's motion (assets/mascot/ILMEK_SPEC.md, "Motion"). Every value is a
 * shared value read by native view transforms, so nothing re-renders per frame.
 * With `run` false every value holds the state's static pose.
 */
export interface IlmekMotion {
  /** Rig: lift in canvas units, lean in degrees, squash and stretch. */
  lift: SharedValue<number>;
  rot: SharedValue<number>;
  sx: SharedValue<number>;
  sy: SharedValue<number>;
  /** Curl rotation (deg), around (100,52). */
  tuft: SharedValue<number>;
  /** Arm rotations (deg), around each shoulder. */
  armL: SharedValue<number>;
  armR: SharedValue<number>;
  /** Eyes: vertical scale for blinks, horizontal gaze drift in units. */
  blink: SharedValue<number>;
  gaze: SharedValue<number>;
  /** Brows: vertical offset in units. */
  brow: SharedValue<number>;
  /** Ground shadow scale. */
  shadow: SharedValue<number>;
  /** The state's prop: book tilt, bubble size, confetti burst, glint sweep, arc fade. */
  fx: SharedValue<number>;
  /** A second prop channel: page turn, bubble opacity. */
  fx2: SharedValue<number>;
}

const sine = Easing.inOut(Easing.sin);

/** Neutral value of the prop channels for each state's static pose. */
function restFx(state: IlmekState): [number, number] {
  switch (state) {
    case 'sleepy':
      return [1, 1]; // bubble at full size, visible
    case 'waving':
      return [1, 0]; // arcs visible
    default:
      return [0, 0]; // book level, no page turning, confetti whole, glint off the lenses
  }
}

export function useIlmekMotion(state: IlmekState, run: boolean): IlmekMotion {
  const lift = useSharedValue(0);
  const rot = useSharedValue(0);
  const sx = useSharedValue(1);
  const sy = useSharedValue(1);
  const tuft = useSharedValue(0);
  const armL = useSharedValue(0);
  const armR = useSharedValue(0);
  const blink = useSharedValue(1);
  const gaze = useSharedValue(0);
  const brow = useSharedValue(0);
  const shadow = useSharedValue(1);
  const fx = useSharedValue(0);
  const fx2 = useSharedValue(0);
  const m = useMemo(
    () => ({ lift, rot, sx, sy, tuft, armL, armR, blink, gaze, brow, shadow, fx, fx2 }),
    [lift, rot, sx, sy, tuft, armL, armR, blink, gaze, brow, shadow, fx, fx2],
  );

  useEffect(() => {
    const all = Object.values(m);
    all.forEach(cancelAnimation);
    const rig = RIG[state];
    const [f1, f2] = restFx(state);
    m.lift.value = run && state === 'celebrating' ? 0 : rig.lift;
    m.rot.value = rig.rot;
    m.sx.value = 1;
    m.sy.value = 1;
    m.tuft.value = 0;
    m.armL.value = 0;
    m.armR.value = 0;
    m.blink.value = 1;
    m.gaze.value = 0;
    m.brow.value = 0;
    m.shadow.value = state === 'celebrating' && !run ? SHADOW_IN_AIR : 1;
    m.fx.value = f1;
    m.fx2.value = f2;
    if (!run) return;

    const timers: ReturnType<typeof setTimeout>[] = [];
    const later = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));
    const every = (ms: number, fn: () => void) => timers.push(setInterval(fn, ms));
    /** Blink (eyes to 0.1 for 120ms) at random intervals. */
    const blinks = (min: number, max: number) => {
      const next = () =>
        later(min + Math.random() * (max - min), () => {
          m.blink.value = withSequence(withTiming(0.1, { duration: 60 }), withTiming(1, { duration: 60 }));
          next();
        });
      next();
    };
    /** Breathing: the rig's scaleY rises from the feet and back over one cycle. */
    const breathe = (amount: number, cycleMs: number) => {
      m.sy.value = withRepeat(withTiming(1 + amount, { duration: cycleMs / 2, easing: sine }), -1, true);
    };
    /** A value swinging between a and b, one full cycle per `cycleMs`, starting from where it is. */
    const swing = (v: SharedValue<number>, a: number, b: number, cycleMs: number, delay = 0) => {
      v.value = withDelay(
        delay,
        withSequence(withTiming(a, { duration: cycleMs / 4, easing: sine }), withRepeat(withTiming(b, { duration: cycleMs / 2, easing: sine }), -1, true)),
      );
    };

    switch (state) {
      case 'idle':
        breathe(0.03, 3200);
        swing(m.tuft, -1, 1, 3200); // curl bobs 2° per breath
        swing(m.armL, 3, -3, 3200); // arms sway ±3°, a quarter cycle apart
        swing(m.armR, -3, 3, 3200, 800);
        blinks(4000, 6000);
        break;

      case 'focused': {
        breathe(0.015, 4000);
        blinks(7000, 9000);
        swing(m.fx, 1, -1, 5000); // book tilts ±1°
        let right = true;
        every(8000, () => {
          m.gaze.value = withTiming(right ? 1 : 0, { duration: 700, easing: sine });
          right = !right;
        });
        every(20000, () => {
          m.fx2.value = withSequence(withTiming(1, { duration: 520, easing: Easing.inOut(Easing.quad) }), withTiming(0, { duration: 0 }));
        });
        break;
      }

      case 'sleepy':
        breathe(0.03, 5000);
        swing(m.rot, -4, -7, 5000); // slow nod
        // The bubble grows 0.6 → 1.1, pops, and reforms: one cycle every 6s.
        m.fx.value = withRepeat(
          withSequence(
            withTiming(0.6, { duration: 0 }),
            withTiming(1.1, { duration: 5400, easing: Easing.out(Easing.quad) }),
            withTiming(1.35, { duration: 160 }),
            withTiming(1.35, { duration: 440 }),
          ),
          -1,
        );
        m.fx2.value = withRepeat(
          withSequence(
            withTiming(0, { duration: 0 }),
            withTiming(1, { duration: 400 }),
            withTiming(1, { duration: 5000 }),
            withTiming(0, { duration: 160 }),
            withTiming(0, { duration: 440 }),
          ),
          -1,
        );
        break;

      case 'cheering': {
        // One cheer every 2.6s (1.6s of motion, 1s rest): arms spring up into the V,
        // pump twice, then ease down; brows lift and the body squashes and stretches.
        const DOWN = 62;
        const cheer = () => {
          const pump = (dir: number) =>
            withSequence(
              withSpring(0, { damping: 12, stiffness: 220 }),
              withTiming(8 * dir, { duration: 140 }),
              withTiming(-8 * dir, { duration: 140 }),
              withTiming(8 * dir, { duration: 140 }),
              withTiming(0, { duration: 140 }),
              withDelay(260, withTiming(-DOWN * dir, { duration: 700, easing: sine })),
            );
          m.armL.value = pump(-1);
          m.armR.value = pump(1);
          m.brow.value = withSequence(withTiming(0, { duration: 180 }), withDelay(1100, withTiming(3, { duration: 700, easing: sine })));
          m.sy.value = withSequence(withTiming(0.96, { duration: 120 }), withSpring(1.04, { damping: 12, stiffness: 220 }), withTiming(1, { duration: 360, easing: sine }));
          m.sx.value = withSequence(withTiming(1.03, { duration: 120 }), withSpring(0.98, { damping: 12, stiffness: 220 }), withTiming(1, { duration: 360, easing: sine }));
        };
        // Start from the V (the static pose, or where celebrating left off): ease down, then cheer.
        // The left arm lowers counterclockwise, the right clockwise.
        m.armL.value = withDelay(300, withTiming(-DOWN, { duration: 700, easing: sine }));
        m.armR.value = withDelay(300, withTiming(DOWN, { duration: 700, easing: sine }));
        m.brow.value = withDelay(300, withTiming(3, { duration: 700, easing: sine }));
        later(1000, () => {
          cheer();
          every(2600, cheer);
        });
        break;
      }

      case 'celebrating': {
        // Three hops in 1.2s (Ilmek.tsx then settles into cheering).
        const hops = (seq: () => number) => withRepeat(seq(), 3);
        m.lift.value = hops(() =>
          withSequence(
            withTiming(-10, { duration: 170, easing: Easing.out(Easing.quad) }),
            withTiming(0, { duration: 170, easing: Easing.in(Easing.quad) }),
            withTiming(0, { duration: 60 }),
          ),
        );
        // Squash on landing.
        m.sy.value = hops(() => withSequence(withTiming(1, { duration: 340 }), withTiming(0.9, { duration: 30 }), withTiming(1, { duration: 30 })));
        m.sx.value = hops(() => withSequence(withTiming(1, { duration: 340 }), withTiming(1.08, { duration: 30 }), withTiming(1, { duration: 30 })));
        m.shadow.value = hops(() => withSequence(withTiming(0.7, { duration: 170 }), withTiming(1, { duration: 170 }), withTiming(1, { duration: 60 })));
        // Arms shake ±12°, the curl whips 15°.
        const shake = (dir: number) =>
          withRepeat(withSequence(withTiming(12 * dir, { duration: 50 }), withTiming(-12 * dir, { duration: 100 }), withTiming(0, { duration: 50 })), 6);
        m.armL.value = shake(-1);
        m.armR.value = shake(1);
        m.tuft.value = hops(() =>
          withSequence(withTiming(-15, { duration: 170 }), withTiming(15, { duration: 120 }), withTiming(0, { duration: 110 })),
        );
        // Confetti bursts on each hop and fades out in 60ms steps (see Ilmek.tsx).
        m.fx.value = hops(() => withSequence(withTiming(0, { duration: 0 }), withTiming(1, { duration: 300, easing: Easing.linear }), withTiming(1, { duration: 100 })));
        break;
      }

      case 'relaxed':
        breathe(0.015, 5000);
        swing(m.rot, -7, -4, 5000); // leans back and forth
        // A glint sweeps across the lenses every 6s.
        m.fx.value = withRepeat(withSequence(withDelay(5400, withTiming(1, { duration: 600, easing: Easing.inOut(Easing.quad) })), withTiming(0, { duration: 0 })), -1);
        break;

      case 'waving': {
        // Three swings of the right arm in 1.1s around the shoulder, then 1.5s rest.
        // The motion arcs fade in at the outer end of each swing; the body bobs 1 unit.
        const S = 183;
        m.armR.value = withRepeat(
          withSequence(
            withTiming(-18, { duration: S / 2, easing: sine }),
            withTiming(10, { duration: S, easing: sine }),
            withTiming(-18, { duration: S, easing: sine }),
            withTiming(10, { duration: S, easing: sine }),
            withTiming(-18, { duration: S, easing: sine }),
            withTiming(10, { duration: S, easing: sine }),
            withTiming(0, { duration: S / 2, easing: sine }),
            withTiming(0, { duration: 1500 }),
          ),
          -1,
        );
        m.fx.value = withRepeat(
          withSequence(
            withTiming(0, { duration: S / 2 }),
            withTiming(1, { duration: S }),
            withTiming(0.15, { duration: S }),
            withTiming(1, { duration: S }),
            withTiming(0.15, { duration: S }),
            withTiming(1, { duration: S }),
            withTiming(0, { duration: S / 2 }),
            withTiming(0, { duration: 1500 }),
          ),
          -1,
        );
        swing(m.lift, -1, 0, 1300);
        break;
      }
    }

    return () => {
      timers.forEach((t) => {
        clearTimeout(t);
        clearInterval(t);
      });
      all.forEach(cancelAnimation);
    };
  }, [state, run, m]);

  return m;
}
