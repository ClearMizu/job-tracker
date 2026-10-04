---
name: testing
description: Write, fix, or extend automated tests (bun test for API, Vitest and Testing Library for React, Playwright for end-to-end). Use when adding tests, debugging failing tests, or improving coverage.
---

# Testing workflow

## Choose the right level
- Business logic and API routes: `bun test` in `apps/api`. Use an isolated in-memory SQLite database per test file.
- React components and hooks: Vitest + Testing Library in `apps/web`. Query by role/label, not by class names or test ids unless unavoidable.
- Critical user journeys: Playwright in `e2e/` (sign up, log in, add an application, change its status, log out).

## Rules
- Test behavior, not implementation details.
- Each test is independent: no shared state, no required order.
- No real network calls or real secrets in tests.
- Never delete, skip, or loosen a test just to make it pass. If a test is wrong, explain why and fix it.
- A bug fix starts with a failing test that reproduces the bug.
- Keep E2E tests few and stable; wait on visible conditions, never fixed sleeps.

## Done when
`bun run lint`, `bun run typecheck`, `bun test`, and (if UI changed) `bun run test:e2e` all pass.
