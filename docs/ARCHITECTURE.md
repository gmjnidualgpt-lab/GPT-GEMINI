
# TriadBridge Architecture

## Goal

Build a secure integration between OpenAI GPT, Google Gemini, Cloudflare Workers and Supabase.

## Planned request flow

1. A client sends a request to a Cloudflare Worker.
2. The Worker validates the request and applies rate limits.
3. The Worker calls the selected AI provider through its server-side API.
4. The Worker returns the provider response to the client.
5. If required, the Worker accesses Supabase using a restricted server-side configuration.

## Components

- GitHub: source code, version history and CI/CD.
- Cloudflare Workers: server-side API and request validation.
- Cloudflare AI Gateway: optional AI traffic observability and gateway features.
- OpenAI API: GPT model access.
- Google Gemini API: Gemini model access.
- Supabase: database, authentication and Row Level Security (RLS).

## Security requirements

- Never expose API keys in browser code.
- Store production secrets in server-side secret storage.
- Never commit `.env` files.
- Enable and test RLS for tables exposed through Supabase APIs.
- Validate input and restrict request sizes.
- Apply rate limits and timeouts.
- Do not log API keys, access tokens or sensitive user data.

## Current verification status

The presence of this document does not prove that the services are connected.

- GitHub repository: exists.
- Cloudflare Worker deployment: not verified.
- Supabase project and schema: not verified.
- Live GPT API call: not verified.
- Live Gemini API call: not verified.
- End-to-end GPT/Gemini integration: not verified.

Update this section only after running real tests and recording their results.
