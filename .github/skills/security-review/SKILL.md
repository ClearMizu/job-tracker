---
name: security-review
description: Review code for security problems before a pull request or merge. Use when the user asks for a security review, audit, hardening, or says "check security".
---

# Security review checklist

Review the current changes (or the whole repo if asked). For each item report PASS / FAIL / N/A with file and line references. Then list fixes in priority order. Do not invent issues; say PASS when it is fine.

## Authentication and sessions
- Auth is handled by Better Auth, not custom code.
- Cookies are HttpOnly, Secure (in production), and SameSite set.
- Login, signup, and password reset are rate limited.
- Passwords are never logged or returned.

## Authorization
- Every route that touches user data requires a session.
- Every query is scoped by the session's user id (check for IDOR: can user A read or edit user B's record by changing an id?).

## Input and output
- All routes validate body, params, and query with `t` schemas, with max lengths.
- No string-built SQL.
- React: no `dangerouslySetInnerHTML` with user content; links from user input are validated (http/https only).
- Errors do not leak stack traces or internals.

## Configuration
- No secrets in code, tests, logs, or git history. `.env` is gitignored; `.env.example` has placeholders only.
- Env vars are validated at startup; app fails fast if missing.
- CORS allows only the known frontend origin(s), never `*` with credentials.
- Security headers set (CSP, X-Content-Type-Options, Referrer-Policy, frame protection).

## Dependencies and pipeline
- Lockfile committed; CI installs with frozen lockfile.
- `bun audit` and CodeQL results reviewed; Dependabot enabled.
- Docker image runs as non-root and contains no dev secrets.

## Output format
1. Summary (one paragraph)
2. Table: item | status | location | note
3. Fixes in priority order, with code suggestions
4. Tests that should be added to prove each fix
