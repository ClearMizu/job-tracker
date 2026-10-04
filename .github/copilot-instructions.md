# Project: Job Application Tracker

## Stack
- Bun monorepo (workspaces): `apps/api` and `apps/web`
- API: ElysiaJS + TypeBox (`t`) validation + Drizzle ORM (SQLite via bun:sqlite)
- Web: React + Vite + TypeScript, anime.js for animation, Eden Treaty for typed API calls
- Auth: Better Auth (never hand-roll auth, sessions, or password hashing)
- Tests: `bun test` (API), Vitest + Testing Library (web), Playwright (E2E)

## Always
- TypeScript strict mode. No `any`, no `@ts-ignore` without a comment explaining why.
- Every API route validates body, params, and query with Elysia `t` schemas.
- Every query on user data is scoped by the authenticated user's id.
- Never build SQL with string concatenation. Use Drizzle.
- Never log, print, or commit secrets. Config comes from env vars validated at startup.
- Every feature ships with tests in the same change.
- Before saying a task is done, run: `bun run lint`, `bun run typecheck`, `bun test`. Fix failures; do not skip or delete tests to make them pass.
- Before using any library API, check its current docs/version. Do not rely on memory (anime.js v4, Elysia, Better Auth and Drizzle all change often).
- Add a dependency only when necessary, and say why.
- Keep changes small and focused. If a task is large, propose a plan first.

## UI
- Read `docs/DESIGN.md` before touching any UI. Follow the `design-system` skill.
- No default component-library look, no stock gradients, no emoji as icons.

## Skills to use
- UI work -> `design-system`
- New or changed API route / DB table -> `api-endpoint`
- Writing or fixing tests -> `testing`
- Before a PR / "review security" -> `security-review`
