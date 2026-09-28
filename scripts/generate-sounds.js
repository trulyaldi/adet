#!/usr/bin/env node
// Synthesizes Adet's sound family into assets/sounds/*.wav (16-bit mono,
// 22.05 kHz). Every sound is built from the same few ingredients — soft sine
// and triangle tones on a C-major pentatonic palette, gentle attacks, quick
// exponential decays, and a little filtered noise for "air" — so they read as
// one family. Original and deterministic: run `node scripts/generate-sounds.js`.

const fs = require('fs');
const path = require('path');

const RATE = 22050;
const OUT = path.join(__dirname, '..', 'assets', 'sounds');

// ---------- building blocks ----------
const note = {
  C4: 261.63, E4: 329.63, G4: 392.0, A4: 440.0,
  C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880.0,
  C6: 1046.5, D6: 1174.66, E6: 1318.51, G6: 1567.98, C7: 2093.0, E7: 2637.02,
};

function buffer(seconds) {
  return new Float64Array(Math.ceil(seconds * RATE));
}

const sine = (ph) => Math.sin(2 * Math.PI * ph);
const tri = (ph) => 1 - 4 * Math.abs(((ph + 0.25) % 1) - 0.5);

/**
 * Add a tone. `freq` may be a function of time (s) for glides. Envelope: a
 * raised-cosine attack, then exponential decay with time constant `decay`.
 */
function tone(buf, { at = 0, freq, dur, gain = 0.5, attack = 0.008, decay = 0.2, wave = 'sine', partials = [] }) {
  const start = Math.floor(at * RATE);
  const n = Math.floor(dur * RATE);
  let ph = 0;
  const phs = partials.map(() => 0);
  for (let i = 0; i < n && start + i < buf.length; i++) {
    const t = i / RATE;
    const f = typeof freq === 'function' ? freq(t) : freq;
    ph += f / RATE;
    const a = t < attack ? 0.5 - 0.5 * Math.cos((Math.PI * t) / attack) : Math.exp(-(t - attack) / decay);
    // Fade the last 10 ms so nothing clicks.
    const tail = Math.min(1, (n - i) / (0.01 * RATE));
    let s = wave === 'tri' ? tri(ph) : sine(ph);
    partials.forEach(([ratio, g], k) => {
      phs[k] += (f * ratio) / RATE;
      s += g * sine(phs[k]);
    });
    buf[start + i] += s * a * tail * gain;
  }
}

// Deterministic noise.
let seed = 12345;
function rnd() {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff - 0.5;
}

/** Filtered noise ("air"): a band that sweeps from `from` to `to` Hz, bell-shaped in loudness. */
function air(buf, { at = 0, dur, from, to, gain = 0.2 }) {
  const start = Math.floor(at * RATE);
  const n = Math.floor(dur * RATE);
  let lp1 = 0;
  let lp2 = 0;
  for (let i = 0; i < n && start + i < buf.length; i++) {
    const t = i / n;
    const f = from + (to - from) * t;
    const k = 1 - Math.exp((-2 * Math.PI * f) / RATE);
    lp1 += k * (rnd() - lp1);
    lp2 += k * 0.5 * (lp1 - lp2);
    const band = lp1 - lp2; // crude band-pass
    const env = Math.sin(Math.PI * t) ** 2;
    buf[start + i] += band * env * gain * 4;
  }
}

function normalize(buf, peak) {
  let max = 0;
  for (const v of buf) max = Math.max(max, Math.abs(v));
  if (max > 0) for (let i = 0; i < buf.length; i++) buf[i] = (buf[i] / max) * peak;
  return buf;
}

function wav(buf) {
  const data = Buffer.alloc(buf.length * 2);
  for (let i = 0; i < buf.length; i++) data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, buf[i])) * 32767), i * 2);
  const h = Buffer.alloc(44);
  h.write('RIFF', 0);
  h.writeUInt32LE(36 + data.length, 4);
  h.write('WAVE', 8);
  h.write('fmt ', 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); // PCM
  h.writeUInt16LE(1, 22); // mono
  h.writeUInt32LE(RATE, 24);
  h.writeUInt32LE(RATE * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write('data', 36);
  h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

// ---------- the family ----------
const SOUNDS = {
  /** A very soft click: a tiny, fast-decaying high triangle. */
  tap() {
    const b = buffer(0.06);
    tone(b, { freq: note.E6, dur: 0.05, gain: 0.5, attack: 0.002, decay: 0.012, wave: 'tri' });
    return normalize(b, 0.28);
  },
  /** A soft rising two-note whoosh. */
  session_start() {
    const b = buffer(0.55);
    air(b, { dur: 0.42, from: 500, to: 2600, gain: 0.35 });
    tone(b, { at: 0.06, freq: note.E5, dur: 0.3, gain: 0.45, attack: 0.02, decay: 0.12, partials: [[2, 0.12]] });
    tone(b, { at: 0.18, freq: note.A5, dur: 0.36, gain: 0.5, attack: 0.02, decay: 0.16, partials: [[2, 0.12]] });
    return normalize(b, 0.6);
  },
  /** A bright chime: a bell-like pair with a shimmering overtone. */
  target_reached() {
    const b = buffer(1.2);
    tone(b, { freq: note.C6, dur: 1.15, gain: 0.5, attack: 0.004, decay: 0.38, partials: [[2.76, 0.18], [5.4, 0.06]] });
    tone(b, { at: 0.07, freq: note.G6, dur: 1.05, gain: 0.32, attack: 0.004, decay: 0.32, partials: [[2.76, 0.12]] });
    return normalize(b, 0.62);
  },
  /** A satisfying pop, then a round ding. */
  session_complete() {
    const b = buffer(0.8);
    tone(b, { freq: (t) => 900 - 5200 * Math.min(t, 0.08), dur: 0.08, gain: 0.7, attack: 0.002, decay: 0.03 });
    tone(b, { at: 0.06, freq: note.G5, dur: 0.72, gain: 0.5, attack: 0.004, decay: 0.24, partials: [[2, 0.2], [3, 0.06]] });
    return normalize(b, 0.66);
  },
  /** A short, cheerful five-note jingle up the pentatonic. */
  day_complete() {
    const b = buffer(1.35);
    const seq = [note.C5, note.E5, note.G5, note.A5, note.C6];
    seq.forEach((f, i) => {
      const last = i === seq.length - 1;
      tone(b, { at: i * 0.11, freq: f, dur: last ? 0.9 : 0.24, gain: last ? 0.55 : 0.45, attack: 0.006, decay: last ? 0.34 : 0.09, wave: 'tri', partials: [[2, 0.15]] });
    });
    tone(b, { at: 0.44, freq: note.E6, dur: 0.85, gain: 0.18, attack: 0.01, decay: 0.3 });
    return normalize(b, 0.64);
  },
  /** A quick airy fwoosh with a sparkle on top. */
  streak_up() {
    const b = buffer(0.75);
    air(b, { dur: 0.38, from: 300, to: 3200, gain: 0.5 });
    tone(b, { at: 0.26, freq: note.C7, dur: 0.3, gain: 0.25, attack: 0.003, decay: 0.07 });
    tone(b, { at: 0.33, freq: note.E7, dur: 0.36, gain: 0.22, attack: 0.003, decay: 0.09 });
    tone(b, { at: 0.2, freq: note.G5, dur: 0.5, gain: 0.3, attack: 0.02, decay: 0.16 });
    return normalize(b, 0.58);
  },
  /** A fuller celebratory arpeggio over a held chord. */
  milestone() {
    const b = buffer(1.45);
    const seq = [note.C5, note.E5, note.G5, note.C6, note.E6, note.G6];
    seq.forEach((f, i) => tone(b, { at: i * 0.075, freq: f, dur: 0.5, gain: 0.4, attack: 0.004, decay: 0.12, wave: 'tri' }));
    for (const f of [note.C5, note.E5, note.G5, note.C6]) {
      tone(b, { at: 0.45, freq: f, dur: 0.98, gain: 0.22, attack: 0.03, decay: 0.42, partials: [[2, 0.1]] });
    }
    air(b, { at: 0.42, dur: 0.5, from: 2000, to: 5000, gain: 0.12 });
    return normalize(b, 0.66);
  },
  /** A soft, low blip: gently downward, never harsh. */
  undo() {
    const b = buffer(0.22);
    tone(b, { freq: (t) => note.E4 - 180 * t, dur: 0.2, gain: 0.6, attack: 0.008, decay: 0.06, partials: [[2, 0.08]] });
    return normalize(b, 0.4);
  },
};

fs.mkdirSync(OUT, { recursive: true });
for (const [name, make] of Object.entries(SOUNDS)) {
  seed = 12345;
  const buf = make();
  const secs = buf.length / RATE;
  if (secs > 1.5) throw new Error(`${name} is ${secs.toFixed(2)}s (max 1.5s)`);
  fs.writeFileSync(path.join(OUT, `${name}.wav`), wav(buf));
  console.log(`${name}.wav  ${secs.toFixed(2)}s`);
}
