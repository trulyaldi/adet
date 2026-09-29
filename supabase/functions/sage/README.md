# Aqyl the Sage — Edge Function

Optional. Quest Mode works fully without it: Aqyl gives local advice
(`src/domain/game/sageFallback.ts`), and AI stays off until the player turns it
on at the Scribe (with a one-line privacy note). This function is the only
server-side code, and `ANTHROPIC_API_KEY` is the only server-side secret. It
never goes in an `EXPO_PUBLIC_*` variable.

## What it does

`POST …/functions/v1/sage/suggest` and `POST …/functions/v1/sage/recap`,
with the user's Supabase access token (`Authorization: Bearer …`).

- **Auth:** every request is verified with Supabase Auth (`auth.getUser`), so
  both HS256 and asymmetric projects work.
- **CORS:** `ALLOWED_ORIGINS` (comma-separated) for the web build. Native apps
  send no Origin.
- **Limits:** a 32 KB body, 30 calls per user per UTC day (migration 007),
  `max_tokens` 300. A request that is oversized or invalid never spends a call.
- **Safety:** chronicle entries are wrapped in `<user_data>` and treated as
  untrusted data. Model output is validated (zod, then the shared contract in
  `../_shared/sageContract.ts`, which the app's client also uses). Fenced JSON
  is accepted, suggestions for unknown habits are dropped, and anything else
  returns `502 {"error":"bad_output"}`. The app then quietly keeps its local
  answer.

## Setup (not deployed by this repo)

1. Run `supabase/migrations/007_sage_usage.sql` in the SQL Editor (see
   `docs/quest/MIGRATIONS.md`).
2. Install the Supabase CLI and link the project:
   `supabase login`, then `supabase link --project-ref <ref>`.
3. Set the secrets:
   ```sh
   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
   supabase secrets set ALLOWED_ORIGINS=https://your-web-app.example
   # optional; default claude-haiku-4-5-20251001
   supabase secrets set SAGE_MODEL=claude-haiku-4-5-20251001
   ```
   `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are
   provided to Edge Functions automatically.
4. Deploy: `supabase functions deploy sage`.
   If the web build's CORS preflight is rejected by the gateway before the
   function runs, redeploy with `--no-verify-jwt`; the function verifies the
   token itself either way.
5. In the app's `.env`:
   `EXPO_PUBLIC_SAGE_URL=https://<ref>.supabase.co/functions/v1`
   (the client appends `/sage/suggest` or `/sage/recap`).

## Local development

```sh
supabase start                      # local stack (Docker)
supabase functions serve sage --env-file ./supabase/.env.local
# .env.local: ANTHROPIC_API_KEY=…, ALLOWED_ORIGINS=http://localhost:8081
```

Without the CLI, `deno check --config supabase/functions/sage/deno.json
supabase/functions/sage/index.ts` typechecks it (`npx deno` works).

## Tests

`npm test` covers the pure contract (`_shared/sageContract.test.ts`: routes,
fences, limits, unknown habits, the data delimiter) and the client
(`src/services/sageClient.test.ts`: malformed output, endpoint errors,
unreachable endpoint, cache). The handler itself has no automated test here.
It was smoke-tested locally under Deno for CORS preflight, the origin check,
unknown routes and missing or invalid tokens.
