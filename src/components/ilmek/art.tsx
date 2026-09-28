import React from 'react';
import { Circle, ClipPath, Defs, Ellipse, G, Path, Rect } from 'react-native-svg';

import { ILMEK_CHEEK, ILMEK_INK, ILMEK_TONGUE, IlmekTones } from '../../theme/mascot';

/**
 * Ilmek's parts, drawn from assets/mascot/*.svg on a 200×200 canvas. Each part
 * keeps its SVG group name so it can move on its own (see Ilmek.tsx).
 */
export type IlmekState = 'idle' | 'focused' | 'sleepy' | 'cheering' | 'celebrating' | 'relaxed' | 'waving';

export const ILMEK_STATES: IlmekState[] = ['idle', 'focused', 'sleepy', 'cheering', 'celebrating', 'relaxed', 'waving'];

const round = { strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' } as const;

// ---------- rig ----------

/** The rig's resting transform per state: lifted off the ground, or leaning. */
export const RIG: Record<IlmekState, { lift: number; rot: number }> = {
  idle: { lift: 0, rot: 0 },
  focused: { lift: 0, rot: 0 },
  sleepy: { lift: 0, rot: -5 },
  cheering: { lift: 0, rot: 0 },
  celebrating: { lift: -14, rot: 0 },
  relaxed: { lift: 0, rot: -5 },
  waving: { lift: 0, rot: 0 },
};

/** Ground shadow; it shrinks while Ilmek is in the air (celebrating's pose is mid-hop). */
export function Shadow({ color, opacity }: { color: string; opacity: number }) {
  return (
    <G id="shadow">
      <Ellipse cx={100} cy={186} rx={46} ry={7} fill={color} opacity={opacity} />
    </G>
  );
}
export const SHADOW_IN_AIR = 34 / 46;

export function Feet({ tones }: { tones: IlmekTones }) {
  return (
    <G id="feet">
      <Ellipse cx={80} cy={176} rx={17} ry={9} fill={tones.shade} />
      <Ellipse cx={120} cy={176} rx={17} ry={9} fill={tones.shade} />
    </G>
  );
}

/** The head curl: the Adet mark. Always drawn. */
export function Tuft({ tones, small }: { tones: IlmekTones; small?: boolean }) {
  return (
    <G id="tuft">
      <Path d="M100.1 52.8L111 44.1A14 14 0 1 0 97 44.1L110.4 51.8L126 30" stroke={tones.body} strokeWidth={small ? 11 : 9} {...round} />
    </G>
  );
}

export function Body({ tones, small }: { tones: IlmekTones; small?: boolean }) {
  return (
    <G id="body">
      <Path d="M100 50C140 50 164 78 164 116C164 152 136 176 100 176C64 176 36 152 36 116C36 78 60 50 100 50Z" fill={tones.body} />
      <Path d="M164 114C164 152 136 176 100 176C70 176 46 158 38 132C54 152 80 162 108 158C136 154 158 136 164 114Z" fill={tones.shade} />
      {!small && (
        <>
          <Ellipse cx={66} cy={80} rx={11} ry={6.5} transform="rotate(-35 66 80)" fill={tones.gloss} />
          <Path d="M62 146C70 136 84 132 100 132C116 132 130 136 138 146C130 161 116 168 100 168C84 168 70 161 62 146Z" fill={tones.belly} />
        </>
      )}
    </G>
  );
}

export function Cheeks() {
  return (
    <G id="cheeks">
      <Ellipse cx={56} cy={120} rx={9} ry={5.5} fill={ILMEK_CHEEK} />
      <Ellipse cx={144} cy={120} rx={9} ry={5.5} fill={ILMEK_CHEEK} />
    </G>
  );
}

// ---------- face ----------

/** An open eye: white, pupil and two catchlights, offset from the left eye's layout. */
function OpenEye({ dx, pupil, r }: { dx: number; pupil: [number, number]; r: number }) {
  const [px, py] = pupil;
  return (
    <>
      <Ellipse cx={78 + dx} cy={96} rx={17} ry={19} fill="#FFFFFF" />
      <Circle cx={px + dx} cy={py} r={r} fill={ILMEK_INK} />
      <Circle cx={px + 3.5 + dx} cy={py - 4} r={3.6} fill="#FFFFFF" />
      <Circle cx={px - 2.5 + dx} cy={py + 4} r={1.7} fill="#FFFFFF" />
    </>
  );
}

function EyePair({ render }: { render(dx: number): React.ReactNode }) {
  return (
    <G id="eyes">
      <G id="eye-left">{render(0)}</G>
      <G id="eye-right">{render(44)}</G>
    </G>
  );
}

export function Eyes({ state, tones }: { state: IlmekState; tones: IlmekTones }) {
  switch (state) {
    case 'idle':
      return <EyePair render={(dx) => <OpenEye dx={dx} pupil={[81, 99]} r={9.5} />} />;
    case 'waving':
      return <EyePair render={(dx) => <OpenEye dx={dx} pupil={[80, 97]} r={10} />} />;
    case 'focused':
      // Looking down toward the timer, lids half lowered (body-colored, so they follow a tint).
      return (
        <EyePair
          render={(dx) => (
            <>
              <OpenEye dx={dx} pupil={[81, 104]} r={9} />
              <Path d={`M${59 + dx} 75L${97 + dx} 75L${97 + dx} 89Q${78 + dx} 93 ${59 + dx} 89Z`} fill={tones.body} />
              <Path d={`M${62 + dx} 85Q${78 + dx} 89 ${94 + dx} 85`} stroke={ILMEK_INK} strokeWidth={4} {...round} />
            </>
          )}
        />
      );
    case 'cheering':
    case 'celebrating':
      // Happy upturned arcs.
      return <EyePair render={(dx) => <Path d={`M${65 + dx} 101Q${78 + dx} 85 ${91 + dx} 101`} stroke={ILMEK_INK} strokeWidth={6} {...round} />} />;
    case 'sleepy':
    case 'relaxed':
      // Closed and content.
      return <EyePair render={(dx) => <Path d={`M${65 + dx} 98Q${78 + dx} 107 ${91 + dx} 98`} stroke={ILMEK_INK} strokeWidth={5} {...round} />} />;
  }
}

const BROWS: Partial<Record<IlmekState, [string, string]>> = {
  idle: ['M62 72Q74 65 88 70', 'M112 70Q126 65 138 72'],
  focused: ['M62 70Q74 63 88 68', 'M112 68Q126 63 138 70'],
  sleepy: ['M63 76Q75 73 87 76', 'M113 76Q125 73 137 76'],
  cheering: ['M62 66Q74 57 88 63', 'M112 63Q126 57 138 66'],
  celebrating: ['M62 66Q74 57 88 63', 'M112 63Q126 57 138 66'],
  waving: ['M62 66Q74 57 88 63', 'M112 63Q126 57 138 66'],
};

export function hasBrows(state: IlmekState): boolean {
  return !!BROWS[state];
}

export function Brows({ state }: { state: IlmekState }) {
  const b = BROWS[state];
  if (!b) return null;
  return (
    <G id="brows">
      <G id="brow-left">
        <Path d={b[0]} stroke={ILMEK_INK} strokeWidth={5} {...round} />
      </G>
      <G id="brow-right">
        <Path d={b[1]} stroke={ILMEK_INK} strokeWidth={5} {...round} />
      </G>
    </G>
  );
}

const GRIN = 'M84 115Q100 142 116 115Q100 121 84 115Z';
const GRIN_TONGUE = 'M92 128Q100 122 108 128Q100 135 92 128Z';

export function Mouth({ state }: { state: IlmekState }) {
  const open = (d: string, tongue?: string) => (
    <>
      <Path d={d} fill={ILMEK_INK} stroke={ILMEK_INK} strokeWidth={3} strokeLinejoin="round" />
      {tongue && <Path d={tongue} fill={ILMEK_TONGUE} />}
    </>
  );
  let m: React.ReactNode;
  switch (state) {
    case 'idle':
      m = <Path d="M88 118Q100 130 112 118" stroke={ILMEK_INK} strokeWidth={5} {...round} />;
      break;
    case 'focused':
      m = <Path d="M93 121Q100 124 107 121" stroke={ILMEK_INK} strokeWidth={5} {...round} />;
      break;
    case 'sleepy':
      m = <Ellipse cx={100} cy={122} rx={5} ry={6} fill={ILMEK_INK} />;
      break;
    case 'cheering':
    case 'waving':
      m = open(GRIN, GRIN_TONGUE);
      break;
    case 'celebrating':
      m = open('M80 113Q100 150 120 113Q100 120 80 113Z', 'M89 131Q100 122 111 131Q100 142 89 131Z');
      break;
    case 'relaxed':
      m = open('M84 115Q100 136 116 115Q100 120 84 115Z');
      break;
  }
  return <G id="mouth">{m}</G>;
}

// ---------- small (below 40px): body, curl and eyes only ----------

export function SmallEyes() {
  return (
    <EyePair
      render={(dx) => (
        <>
          <Ellipse cx={78 + dx} cy={98} rx={19} ry={21} fill="#FFFFFF" />
          <Circle cx={82 + dx} cy={102} r={11} fill={ILMEK_INK} />
        </>
      )}
    />
  );
}

// ---------- arms ----------

export const ARMS: Record<IlmekState, [string, string]> = {
  idle: ['M44 124Q30 136 36 152', 'M156 124Q170 136 164 152'],
  focused: ['M44 124Q44 150 70 156', 'M156 124Q156 150 130 156'],
  sleepy: ['M44 126Q34 142 44 156', 'M156 126Q166 142 156 156'],
  cheering: ['M46 116Q30 102 30 84', 'M154 116Q174 90 178 60'],
  celebrating: ['M46 112Q22 92 26 62', 'M154 112Q178 92 174 62'],
  // Hands behind the head (drawn behind the body).
  relaxed: ['M48 112Q28 86 58 72', 'M152 112Q172 86 142 72'],
  waving: ['M44 124Q30 136 36 152', 'M154 116Q174 100 172 72'],
};

/** An arm's shoulder (its pivot) is where its stroke starts. */
export function shoulder(d: string): [number, number] {
  const [x, y] = d.slice(1).split(/[Q ]/).map(Number);
  return [x, y];
}

export function Arm({ id, d, tones }: { id: 'arm-left' | 'arm-right'; d: string; tones: IlmekTones }) {
  return (
    <G id={id}>
      <Path d={d} stroke={tones.shade} strokeWidth={18} {...round} />
    </G>
  );
}

// ---------- props: each belongs to exactly one state ----------

/** Focused: an open book held in both hands. */
export function Book() {
  return (
    <G id="book">
      <Path d="M66 150L100 158L134 150L134 176L100 184L66 176Z" fill="#FFFFFF" stroke="#FF9500" strokeWidth={5} strokeLinejoin="round" />
      <Path d="M100 158L100 184" stroke="#FF9500" strokeWidth={4} {...round} />
      <Path d="M74 160L92 164" stroke="#D1D1D6" strokeWidth={3} {...round} />
      <Path d="M108 164L126 160" stroke="#D1D1D6" strokeWidth={3} {...round} />
      <Path d="M74 168L92 172" stroke="#D1D1D6" strokeWidth={3} {...round} />
    </G>
  );
}

/** Focused: the right-hand page, which turns over the spine now and then. */
export function Page() {
  return (
    <G id="page">
      <Path d="M100 158L134 150L134 176L100 184Z" fill="#FFFFFF" stroke="#FF9500" strokeWidth={3} strokeLinejoin="round" />
    </G>
  );
}
export const BOOK_CENTER: [number, number] = [100, 167];

/** Sleepy: a small sleep bubble at the mouth. */
export function SleepBubble() {
  return (
    <G id="sleep-bubble">
      <Circle cx={118} cy={126} r={9} fill="#CFE4FF" opacity={0.85} />
      <Circle cx={121} cy={122} r={2.5} fill="#FFFFFF" />
    </G>
  );
}
export const BUBBLE_CENTER: [number, number] = [118, 126];

/** Celebrating: confetti around the character. */
export function Confetti() {
  return (
    <G id="confetti">
      <Rect x={18} y={30} width={9} height={5} rx={2.5} fill="#FF9500" transform="rotate(-25 22 32)" />
      <Circle cx={60} cy={16} r={4} fill="#34C759" />
      <Rect x={146} y={20} width={9} height={5} rx={2.5} fill="#FF2D55" transform="rotate(30 150 22)" />
      <Circle cx={186} cy={104} r={3.5} fill="#AF52DE" />
      <Circle cx={12} cy={110} r={3.5} fill="#30B0C7" />
      <Rect x={176} y={36} width={8} height={5} rx={2.5} fill="#FFCC00" transform="rotate(-40 180 38)" />
      <Path d="M130 12l2.4 5 5 2.4-5 2.4-2.4 5-2.4-5-5-2.4 5-2.4z" fill="#FFCC00" />
      <Path d="M34 70l1.8 3.8 3.8 1.8-3.8 1.8-1.8 3.8-1.8-3.8-3.8-1.8 3.8-1.8z" fill="#FFCC00" />
    </G>
  );
}

/** Waving: motion arcs beside the waving hand. */
export function WaveArcs() {
  return (
    <G id="motion-arcs">
      <Path d="M186 58Q192 68 188 80" stroke="#8E8E93" strokeWidth={4} {...round} />
      <Path d="M178 48Q184 44 190 46" stroke="#8E8E93" strokeWidth={4} {...round} />
    </G>
  );
}

const LENS_L = 'M56 84Q56 80 60 80L96 80Q100 80 100 84L98 100Q96 112 80 112Q62 112 58 100Z';
const LENS_R = 'M144 84Q144 80 140 80L104 80Q100 80 100 84L102 100Q104 112 120 112Q138 112 142 100Z';

/** Relaxed: sunglasses. `glint` is the sweeping highlight, clipped to the lenses. */
export function Sunglasses({ glint }: { glint?: React.ReactNode }) {
  return (
    <G id="sunglasses">
      <Defs>
        <ClipPath id="ilmek-lenses">
          <Path d={LENS_L} />
          <Path d={LENS_R} />
        </ClipPath>
      </Defs>
      <Path d={LENS_L} fill={ILMEK_INK} />
      <Path d={LENS_R} fill={ILMEK_INK} />
      <Path d="M64 88L74 88" stroke="#FFFFFF" strokeWidth={3} {...round} />
      <Path d="M108 88L118 88" stroke="#FFFFFF" strokeWidth={3} {...round} />
      <Path d="M56 84L44 80" stroke={ILMEK_INK} strokeWidth={4} {...round} />
      <Path d="M144 84L156 80" stroke={ILMEK_INK} strokeWidth={4} {...round} />
      {glint && <G clipPath="url(#ilmek-lenses)">{glint}</G>}
    </G>
  );
}
