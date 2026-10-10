
# Connection Tests

Record the date, result, and evidence for each test.

Use only these statuses: NOT TESTED, PASS, FAIL, BLOCKED.

| Test | Expected result | Status |
|---|---|---|
| GitHub repository read | Repository contents can be read | PASS for repository access only |
| GitHub write | A test file can be committed using the intended connector | BLOCKED |
| Cloudflare API | Account details can be retrieved | PASS for account access only |
| Cloudflare Worker | Deployed endpoint returns a valid response | NOT TESTED |
| Supabase project | Project URL and API access are verified | NOT TESTED |
| Supabase RLS | Unauthorized data access is denied | NOT TESTED |
| OpenAI API | A real request returns a response | NOT TESTED |
| Gemini API | A real request returns a response | NOT TESTED |
| End-to-end integration | Worker successfully calls the selected provider | NOT TESTED |

## Test evidence

For each test, record:
- Date and time
- Endpoint or operation tested
- HTTP status or tool result
- Sanitized error message, if any
- Confirmation that secrets were not exposed

Never mark a test PASS based only on configuration or the existence of a file.
