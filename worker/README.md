# Aqyl Sage Worker

This service is optional. Quest Mode works with local advice when it is absent.
Chronicle text is sent only after the player enables AI Sage.

1. In `worker/`, run `npm install` and create a Cloudflare KV namespace with
   `npx wrangler kv namespace create SAGE_RATE`. Put its ID in `wrangler.toml`.
2. Set `SUPABASE_JWKS_URL` to the project's `/auth/v1/.well-known/jwks.json`
   for asymmetric JWTs. For HS256 projects, set `SUPABASE_JWT_SECRET` with
   `npx wrangler secret put SUPABASE_JWT_SECRET`. Configure exactly one method.
3. Run `npx wrangler secret put ANTHROPIC_API_KEY`. Set `ALLOWED_ORIGINS` to
   the deployed web origin (comma-separated; native Expo requests have no
   Origin). Set `SAGE_MODEL` if the default is unavailable for the account.
4. Test locally with `npm run dev`. Deploy only when ready with `npm run deploy`.
5. Set `EXPO_PUBLIC_SAGE_URL` in the app build. AI Sage remains off by default.

The worker verifies JWTs, limits each user to 30 calls per UTC day, accepts at
most 32 KB, and returns validated JSON. Do not put API keys in Expo variables.
