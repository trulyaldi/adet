import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

import { SOUND_FILES } from '../assets/sounds.generated';
import { AVAILABLE_SFX, feedbackAllowed, hasSfxFile, SFX_IDS } from './gate';

const root = join(__dirname, '..', '..', '..');
/** Ids allowed to have no file, each with a reason (music today). */
const NEEDS_AUDIO: Record<string, string> = JSON.parse(readFileSync(join(root, 'assets/game/needs-audio.json'), 'utf8'));

test('running and paused sessions mute all Quest feedback', () => {
  for (const context of ['quest', 'loot', 'ceremony', 'timer'] as const) assert.equal(feedbackAllowed(context, true), false);
  assert.equal(feedbackAllowed('timer', false), false);
  assert.equal(feedbackAllowed('quest', false), true);
  assert.equal(feedbackAllowed('loot', false), true);
});

test('every SFX id has a built, small, short file (or an allowlisted reason)', () => {
  const missing = SFX_IDS.filter((id) => !(id in SOUND_FILES) && !(id in NEEDS_AUDIO));
  assert.deepEqual(missing, []);
  for (const id of SFX_IDS.filter((i) => i in SOUND_FILES)) {
    const f = join(root, 'assets/game/audio', SOUND_FILES[id].file);
    assert.ok(existsSync(f), `${id}: ${f} is missing`);
    assert.ok(f.endsWith('.m4a'), `${id}: iOS needs AAC/MP3, not ${f}`);
    assert.ok(statSync(f).size <= 60 * 1024, `${id} is over 60 KB`);
    assert.ok(SOUND_FILES[id].seconds <= 2.5, `${id} is longer than 2.5 s`);
  }
  assert.equal(AVAILABLE_SFX.size, SFX_IDS.filter((i) => i in SOUND_FILES).length);
  for (const [id, why] of Object.entries(NEEDS_AUDIO)) assert.ok(why.length > 10, `${id} needs a reason`);
});

test('an id without a file is a silent no-op', () => {
  assert.equal(hasSfxFile('boss_defeat', new Set(['ui_tap'])), false);
  assert.equal(hasSfxFile('ui_tap', new Set(['ui_tap'])), true);
  assert.equal(hasSfxFile('chest_open', new Set()), false);
});
