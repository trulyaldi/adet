// Aqyl the Sage: an optional AI proxy, as a Supabase Edge Function (Deno).
// POST …/sage/suggest and …/sage/recap, with the user's Supabase access
// token. The app works fully without it (local advice); see README.md.
//
// Order matters: auth → size → validation → daily limit → model. A request
// that is oversized or invalid never spends one of the day's calls.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'npm:zod@4';

import {
  DEFAULT_SAGE_MODEL,
  parseModelJson,
  parseRecap,
  parseSuggestions,
  SAGE_LIMITS,
  SAGE_SYSTEM,
  SageRoute,
  sageRoute,
  UNTRUSTED_NOTE,
  wrapUserData,
} from '../_shared/sageContract.ts';

const env = (k: string) => Deno.env.get(k) ?? '';
const SUPABASE_URL = env('SUPABASE_URL');
const admin = createClient(SUPABASE_URL, env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
const authClient = createClient(SUPABASE_URL, env('SUPABASE_ANON_KEY'), { auth: { persistSession: false } });

const title = z.string().trim().min(1).max(SAGE_LIMITS.titleChars);
const INPUT = {
  suggest: z.object({
    habits: z.array(z.object({ id: z.string().min(1).max(100), name: z.string().max(80), openTasks: z.array(title).max(10) })).max(30),
    entries: z.array(z.object({ habitId: z.string().max(100), text: z.string().max(500), at: z.string().max(40) })).max(20),
  }).strict(),
  recap: z.object({
    biomeName: z.string().max(80),
    bossName: z.string().min(1).max(80),
    entries: z.array(z.string().max(500)).max(20),
    sessionCount: z.number().int().min(0).max(100000),
    taskCount: z.number().int().min(0).max(100000),
  }).strict(),
} as const;
const OUTPUT = {
  suggest: z.object({ suggestions: z.array(z.object({ habitId: z.string(), title })).max(SAGE_LIMITS.maxSuggestions), insight: z.string() }).strict(),
  recap: z.object({ recap: z.string() }).strict(),
} as const;

const allowedOrigins = () => env('ALLOWED_ORIGINS').split(',').map((s) => s.trim()).filter(Boolean);
function corsHeaders(origin: string | null): HeadersInit {
  return origin && allowedOrigins().includes(origin)
    ? {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
        Vary: 'Origin',
      }
    : {};
}
const json = (value: unknown, status: number, headers: HeadersInit) =>
  new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json', ...headers } });

async function userIdOf(req: Request): Promise<string | null> {
  const token = /^Bearer (.+)$/i.exec(req.headers.get('Authorization') ?? '')?.[1];
  if (!token) return null;
  // Verified by Supabase Auth itself (works for HS256 and asymmetric keys).
  const { data, error } = await authClient.auth.getUser(token);
  return error || !data.user ? null : data.user.id;
}

/** One of today's calls, atomically (migration 007). False once the limit is reached. */
async function takeCall(userId: string): Promise<boolean> {
  const { data, error } = await admin.rpc('sage_take_call', { p_user: userId, p_limit: SAGE_LIMITS.callsPerDay });
  return !error && data === true;
}

async function askModel(route: SageRoute, data: unknown): Promise<unknown> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': env('ANTHROPIC_API_KEY'), 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: env('SAGE_MODEL') || DEFAULT_SAGE_MODEL,
      max_tokens: SAGE_LIMITS.maxTokens,
      system: `${SAGE_SYSTEM[route]} ${UNTRUSTED_NOTE}`,
      messages: [{ role: 'user', content: wrapUserData(data) }],
    }),
  });
  if (!res.ok) throw new Error('model_unavailable');
  const raw = (await res.json()) as { content?: { type: string; text?: string }[] };
  const text = raw.content?.find((c) => c.type === 'text')?.text;
  if (!text) throw new Error('bad_output');
  return parseModelJson(text);
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  const headers = corsHeaders(origin);
  // Native apps send no Origin; a browser must be on the allow-list.
  if (origin && !allowedOrigins().includes(origin)) return json({ error: 'origin' }, 403, headers);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  const route = sageRoute(new URL(req.url).pathname);
  if (req.method !== 'POST' || !route) return json({ error: 'not_found' }, 404, headers);

  const userId = await userIdOf(req);
  if (!userId) return json({ error: 'unauthorized' }, 401, headers);

  if (Number(req.headers.get('Content-Length') ?? 0) > SAGE_LIMITS.bodyBytes) return json({ error: 'too_large' }, 413, headers);
  const body = await req.text();
  if (new TextEncoder().encode(body).byteLength > SAGE_LIMITS.bodyBytes) return json({ error: 'too_large' }, 413, headers);
  let raw: unknown;
  try {
    raw = JSON.parse(body);
  } catch {
    return json({ error: 'bad_request' }, 400, headers);
  }
  const input = INPUT[route].safeParse(raw);
  if (!input.success) return json({ error: 'bad_request' }, 400, headers);

  if (!(await takeCall(userId))) return json({ error: 'rate_limited' }, 429, headers);

  try {
    const answer = await askModel(route, input.data);
    if (route === 'suggest') {
      const shaped = OUTPUT.suggest.safeParse(answer);
      const allowed = new Set((input.data as z.infer<typeof INPUT.suggest>).habits.map((h) => h.id));
      const valid = shaped.success ? parseSuggestions(shaped.data, allowed) : null;
      return valid ? json(valid, 200, headers) : json({ error: 'bad_output' }, 502, headers);
    }
    const shaped = OUTPUT.recap.safeParse(answer);
    const valid = shaped.success ? parseRecap(shaped.data) : null;
    return valid ? json(valid, 200, headers) : json({ error: 'bad_output' }, 502, headers);
  } catch {
    return json({ error: 'bad_output' }, 502, headers);
  }
});
