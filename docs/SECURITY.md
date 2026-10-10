
# Security Policy

## Secrets

- Store OpenAI and Gemini API keys as server-side secrets.
- Store Cloudflare credentials in an approved secret store.
- Keep Supabase service-role credentials on the server only.
- Never commit credentials, tokens, passwords or production `.env` files.
- Rotate any secret that may have been exposed.

## Supabase

- Enable Row Level Security on tables exposed through client APIs.
- Grant users only the permissions they need.
- Test access with both authorized and unauthorized users.
- Never assume that hiding a key in frontend code provides security.

## Cloudflare Worker

- Validate request bodies and allowed methods.
- Apply rate limiting, timeouts and request size limits.
- Restrict cross-origin requests to known origins where applicable.
- Avoid logging secrets or sensitive request data.
- Return sanitized errors to clients.

## AI provider access

- Call providers from trusted server-side code.
- Apply quotas and usage limits.
- Treat model output as untrusted input.
- Do not claim a provider is connected until a real API request succeeds.

## Incident response

If a secret is exposed, revoke or rotate it immediately, review logs, and investigate possible unauthorized use.
