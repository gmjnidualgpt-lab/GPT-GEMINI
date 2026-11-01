# Most Nowy Cleaner, Cloudflare Worker

Production Worker name: `google-drive-cleaner-ai`

Public panel: https://google-drive-cleaner-ai.arobert9944.workers.dev/

## Current functions
- Google OAuth sign-in with a secure HttpOnly session cookie.
- Full paginated scan of Google Drive, up to 20 pages of 1,000 files.
- Exact duplicate detection by MD5 checksum and size.
- Large file review, threshold 100 MB.
- Server-side scan snapshot with 2-hour expiry.
- Moving selected files to Google Drive Trash only after an explicit UI confirmation and only if they were present in the latest scan.
- No permanent deletion and no automatic trashing.

## Cloudflare bindings
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET` (secret binding)
- `OAUTH_KV` (session and scan snapshot storage)

## OAuth
Authorized redirect URI must include:
`https://google-drive-cleaner-ai.arobert9944.workers.dev/oauth/callback`

The Worker requests Google Drive scope. A user must complete Google consent once in the browser.

## Known limits
Google Photos is not covered by the Drive API. Since March 31, 2025, the Google Photos Library API is restricted to media created by the calling app. The Picker API only exposes media the user explicitly selects. Local Android storage is handled by the separate native companion app.
