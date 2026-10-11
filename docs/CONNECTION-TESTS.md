# Connection test record

Do not mark an external service as PASS based only on configuration or a local unit test.

| Component | Current status in this package | Evidence needed |
|---|---|---|
| Worker unit tests | NOT RUN in this package-generation step | Output from `npm test` |
| Cloudflare Worker deployment | NOT TESTED | Deployment result and deployed URL |
| OpenAI API | NOT TESTED | Successful authenticated `POST /api/chat` response with `provider: openai` |
| Gemini API | NOT TESTED | Successful authenticated `POST /api/chat` response with `provider: gemini` |
| Supabase Auth endpoint | NOT TESTED | Successful authenticated `POST /api/supabase-check` response |
| Supabase schema and RLS | NOT TESTED | Tests against actual project tables and user roles |
| End-to-end integration | NOT TESTED | Sanitized request/response evidence for each component |

Record date, endpoint, HTTP status, and sanitized error. Never record API keys, bearer secrets, or sensitive user data.
