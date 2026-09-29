// Accessibility and dead controls, by a static scan of Quest JSX (the node
// test runner can't render React Native or Skia). Every interactive element
// names itself for VoiceOver, and no control has a handler that does nothing.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { test } from 'node:test';

const root = join(__dirname, '..', '..', '..');
const DIRS = ['src/screens/Quest', 'src/game/ui', 'src/game/render'];
const INTERACTIVE = ['Pressable', 'PixelButton', 'TouchableOpacity', 'Switch', 'TextInput'];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : f.endsWith('.tsx') ? [p] : [];
  });
}

/** Opening tags of `tag` in `src`, with their attributes (braces balanced). */
export function openingTags(src: string, tag: string): string[] {
  const out: string[] = [];
  const re = new RegExp(`<${tag}(?=[\\s/>])`, 'g');
  for (let m = re.exec(src); m; m = re.exec(src)) {
    let depth = 0;
    let i = m.index + m[0].length;
    for (; i < src.length; i++) {
      const c = src[i];
      if (c === '{') depth++;
      else if (c === '}') depth--;
      else if (c === '>' && depth === 0 && src[i - 1] !== '=') break;
    }
    out.push(src.slice(m.index, i + 1));
  }
  return out;
}

const tags = () =>
  DIRS.flatMap((d) => files(join(root, d))).flatMap((f) => {
    const src = readFileSync(f, 'utf8');
    return INTERACTIVE.flatMap((t) => openingTags(src, t).map((tag) => ({ file: relative(root, f), tag })));
  });

test('every interactive Quest element has an accessibilityLabel', () => {
  const all = tags();
  assert.ok(all.length > 30, `found ${all.length}`);
  // `{...rest}` passes the caller's label through (the kit's own wrappers).
  const missing = all.filter(({ tag }) => !/accessibilityLabel\s*=/.test(tag) && !/accessible=\{false\}/.test(tag) && !/\{\.\.\.(rest|props)\}/.test(tag));
  assert.deepEqual(missing.map(({ file, tag }) => `${file}: ${tag.slice(0, 80)}`), []);
});

test('no enabled control has a handler that does nothing', () => {
  const dead = tags().filter(({ tag }) => /on(Press|Tap|ValueChange|RequestClose)=\{\(\) => \{\s*\}\}/.test(tag) && !/\bdisabled\b/.test(tag));
  assert.deepEqual(dead.map(({ file, tag }) => `${file}: ${tag.slice(0, 80)}`), []);
  const anyFile = DIRS.flatMap((d) => files(join(root, d))).filter((f) => /onRequestClose=\{\(\) => \{\s*\}\}|\? \(\) => \{\s*\}/.test(readFileSync(f, 'utf8')));
  assert.deepEqual(anyFile.map((f) => relative(root, f)), []);
});

test('the scanner reads multi-line tags with nested braces', () => {
  const src = `<Pressable onPress={() => { go(); }} style={{ a: 1 }}\n  accessibilityLabel="Go"><Text/></Pressable><Pressable onPress={x}>`;
  assert.deepEqual(openingTags(src, 'Pressable'), [
    '<Pressable onPress={() => { go(); }} style={{ a: 1 }}\n  accessibilityLabel="Go">',
    '<Pressable onPress={x}>',
  ]);
});
