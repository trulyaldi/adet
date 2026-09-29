import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createSageClient, parseSuggestions } from './sageClient';

const payload = { habits: [{ id: 'h1', name: 'Writing', openTasks: [] }], entries: [] };
const fallback = { suggestions: [{ habitId: 'h1', title: 'Keep writing' }], insight: 'A little focus helps.' };

function setup(body: unknown) {
  const cache = new Map<string, string>();
  let calls = 0;
  const client = createSageClient({
    url: 'https://example.test', token: async () => 'jwt',
    storage: { getItem: async (key) => cache.get(key) ?? null, setItem: async (key, value) => { cache.set(key, value); } },
    fetcher: (async () => { calls++; return new Response(JSON.stringify(body), { status: 200 }); }) as typeof fetch,
    now: () => Date.UTC(2026, 8, 29),
  });
  return { client, calls: () => calls };
}

test('malformed AI output keeps the local suggestion', async () => {
  const { client } = setup({ suggestions: [{ habitId: 'h1', title: 'x'.repeat(61) }], insight: 'Fine' });
  assert.deepEqual(await client.suggest(payload, fallback), { value: fallback, source: 'local' });
});

test('unknown habit IDs are dropped', async () => {
  const { client } = setup({ suggestions: [{ habitId: 'unknown', title: 'Other' }, { habitId: 'h1', title: 'Write' }], insight: 'Mornings feel good.' });
  assert.deepEqual((await client.suggest(payload, fallback)).value.suggestions, [{ habitId: 'h1', title: 'Write' }]);
  assert.equal(parseSuggestions({ suggestions: [], insight: 'one two three four five six seven eight nine ten eleven twelve thirteen' }, new Set()), null);
});

test('a same-day cache hit avoids another request', async () => {
  const { client, calls } = setup({ suggestions: [{ habitId: 'h1', title: 'Write' }], insight: 'Mornings feel good.' });
  assert.equal((await client.suggest(payload, fallback)).source, 'ai');
  assert.equal((await client.suggest(payload, fallback)).source, 'ai');
  assert.equal(calls(), 1);
});

test('worker failure keeps the local recap', async () => {
  const client = createSageClient({
    url: 'https://example.test', token: async () => 'jwt',
    storage: { getItem: async () => null, setItem: async () => {} },
    fetcher: (async () => new Response('{"error":"bad_output"}', { status: 502 })) as typeof fetch,
    now: () => 0,
  });
  const answer = await client.recap({ biomeName: 'Forest', bossName: 'Fog Wisp', entries: [], sessionCount: 1, taskCount: 0 }, { recap: 'Well fought.' });
  assert.deepEqual(answer, { value: { recap: 'Well fought.' }, source: 'local' });
});
