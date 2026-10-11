# Security notes

- Keep OpenAI, Gemini, and shared integration secrets in Cloudflare Worker secrets.
- Never expose `INTEGRATION_SHARED_SECRET` in browser JavaScript.
- Do not put production secrets in GitHub, `.dev.vars`, logs, screenshots, or support messages.
- Do not use Supabase `service_role` in this MVP. It bypasses RLS.
- Enable RLS and least-privilege policies on every table before adding database operations.
- Configure Cloudflare rate limiting before public exposure.
- Restrict CORS to exact trusted origins. CORS is not authentication.
- This code returns sanitized upstream errors and does not log provider response bodies.
- Rotate any secret that may have been exposed.
