---
name: api-endpoint
description: Add or modify an ElysiaJS API route, Drizzle database table or migration, or any auth-protected resource in apps/api.
---

# Adding or changing an endpoint

1. Schema first: update the Drizzle schema and generate a migration. Never edit the database by hand.
2. Route: validate `body`, `params`, `query`, and `response` with Elysia `t` schemas.
3. Auth: require a valid session. Derive the user id from the session, never from client input.
4. Authorization: every read/update/delete query includes `userId = session.user.id`. Accessing another user's record must return 404 (not 403) so existence isn't leaked.
5. Errors: consistent JSON error shape. No stack traces, SQL, or internal details in responses.
6. Limits: set sensible max lengths on strings and page sizes on lists.
7. Types: export the app type so `apps/web` can use Eden Treaty.
8. Tests (required): success, validation failure (400/422), unauthenticated (401), and cross-user access (must fail).
9. Run lint, typecheck, and tests before finishing.
