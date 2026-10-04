# First session: from zero to a deployed app

Work through these in order. **Commit after every step.** Do not move on until the check at the end of the step passes.

---

## Step 0: Install the tools (one time)

1. **VS Code** with the **GitHub Copilot** and **GitHub Copilot Chat** extensions; sign in to your GitHub account.
2. **Git**: https://git-scm.com
3. **Bun**: https://bun.sh (check with `bun --version`)
4. A **GitHub account** (the CI/CD pipeline runs there).
5. Optional: GitHub CLI (`gh`) to create repos from the terminal.

Check: `bun --version` and `git --version` both print a version.

## Step 1: Create the repo and drop in the starter pack

```bash
mkdir job-tracker && cd job-tracker
git init
```
Copy everything from this starter pack into the folder (including the hidden `.github` folder), then:

```bash
git add . && git commit -m "chore: add copilot config, CI, and design brief"
```
Create an empty repo on GitHub (no README) and push:
```bash
git remote add origin https://github.com/YOU/job-tracker.git
git branch -M main && git push -u origin main
```
Open the folder in VS Code (`code .`).

**Make DESIGN.md yours:** open `docs/DESIGN.md`, pick a concept, tweak the palette and fonts. 10 minutes here saves hours later.

Check: in Copilot Chat, switch to **Agent** mode and ask *"What skills and project instructions do you see?"* It should mention the 4 skills and your rules. If not, search VS Code settings for "agent skills" and make sure they are enabled; reload the window.

## Step 2: Scaffold the monorepo

Paste into Copilot Chat (Agent mode):

> Set up a Bun workspaces monorepo following .github/copilot-instructions.md. Create `apps/api` (ElysiaJS + TypeScript, with a `/health` route and one passing `bun test`) and `apps/web` (React + Vite + TypeScript, with Vitest + Testing Library and one passing test). At the root add scripts: `lint`, `typecheck`, `test` (runs api and web tests), `test:e2e` (placeholder that exits 0 for now), and `dev` (runs both apps). Use Biome for linting/formatting. Check each library's current docs for correct setup. Run all scripts and fix failures. Do not add any features yet.

Check: `bun install`, then `bun run lint`, `bun run typecheck`, `bun test`, and `bun run dev` all work. Visit the web app and `/health` in the browser.

## Step 3: Make CI go green

```bash
git add . && git commit -m "feat: scaffold monorepo" && git push
```
On GitHub, open the **Actions** tab. The CI workflow should run.

If it fails, copy the error log into Copilot Chat: *"CI failed with this error. Find the cause and fix it, then explain what was wrong."*

Common first-run issues: `bun audit` finding an advisory (update the package or document the exception), or `test:e2e` not existing yet (it should exist as a placeholder from Step 2).

Check: the Actions tab shows green for `test` and `security`.

## Step 4: Protect `main`

On GitHub: **Settings > Branches > Add branch protection rule** (or Rulesets):
- Branch: `main`
- Require a pull request before merging
- Require status checks to pass: select `test` and `security`
- Block force pushes

Also turn on, under **Settings > Code security**: Dependabot alerts, Dependabot security updates, and secret scanning (+ push protection if available).

From now on, work on branches: `git switch -c feat/auth`, push, open a PR, wait for green, merge.

## Step 5: Database and authentication

> Use the `api-endpoint` skill. Add Drizzle ORM with SQLite (bun:sqlite) in apps/api, with migrations. Add Better Auth with email + password sign up, login, logout, and session cookies (HttpOnly, SameSite, Secure in production). Validate env vars at startup using `.env.example` as the list of variables. Add rate limiting on the auth routes. Add CORS restricted to WEB_ORIGIN and security headers. Include tests: signup, login, wrong password, unauthenticated access to a protected `/me` route returns 401. Check Better Auth's current docs for the correct Elysia integration.

Check: tests pass; manually sign up and log in through the API (Copilot can give you curl commands).

## Step 6: Applications CRUD (the core feature)

Use the prompt file: in chat type `/new-feature` and enter:

> Job applications: fields are company, role, url (optional, http/https only), status (saved, applied, interview, offer, rejected), notes (optional, max 2000 chars), appliedAt, and timestamps. Endpoints: list (with status filter and pagination), create, get, update, delete. Also a status history table so I can see when each status changed.

Review the plan before approving it. Then check the tests include **cross-user access failing** (user A cannot read or edit user B's application).

## Step 7: Design tokens and the first screens

> Use the `design-system` skill. Read docs/DESIGN.md. First create `tokens.css` and load the fonts. Then build ONLY the applications list screen in the chosen concept, wired to the API with Eden Treaty. Include loading, empty, and error states. Add the anime.js status-change animation and the staggered load-in, with reduced-motion handling. Check anime.js's installed version docs before writing animation code.

Check: look at it in the browser. Does it look like *your* concept? If it drifts generic, say exactly what is off: *"Cards have soft shadows and rounded corners, but DESIGN.md says 1px borders and 2px radius. Fix."* Be specific; the agent responds well to concrete feedback.

Then repeat for: login/signup screen, add/edit application form, and detail view with status history.

## Step 8: End-to-end tests

> Use the `testing` skill. Set up Playwright in `e2e/` with a config that starts both apps against a fresh temporary database. Write E2E tests for: sign up, log in, create an application, change its status, delete it, log out. Wire `bun run test:e2e` to run them. Make sure the CI workflow passes.

Check: `bun run test:e2e` passes locally and in CI. Flaky tests are bugs; ask Copilot to fix them with proper waits, never retries-as-a-bandage.

## Step 9: Security review

> Use the `security-review` skill on the whole repository. Give me the table and the prioritized fixes. Then fix everything marked FAIL, adding a test for each fix.

Run this again before every release. Also try to attack your own app: change ids in URLs, send oversized inputs, submit scripts in the notes field. Ask Copilot to turn each attempt into an automated test.

## Step 10: Deploy (CD)

> Add a production Dockerfile for the API and a way to serve the built web app. Run as a non-root user, no dev dependencies, no secrets baked in. Put the SQLite file on a persistent volume. Then update `.github/workflows/deploy.yml` to deploy to [Fly.io / Railway] after CI passes on main. Check that host's current docs. List which secrets I must add in GitHub and the host's dashboard (never in code).

Add secrets under **GitHub > Settings > Secrets and variables > Actions**, and create a `production` environment (you can require manual approval there).

Check: merge a small change to `main`; CI goes green, the deploy job runs, and the live site updates.

---

## Working habits that make AI agents reliable

- **Small tasks.** One feature or one screen per prompt.
- **Plan first** for anything non-trivial: "Write a plan, wait for approval."
- **Review every diff** before accepting. Read the tests especially; AI sometimes writes tests that can't fail.
- **Fix the instructions, not just the output.** If Copilot repeats a mistake, add a rule to `copilot-instructions.md` or a skill so it never recurs.
- **Never paste secrets into chat.**
- **Commit often**, so you can always roll back.

## Later ideas

Email/calendar reminders for follow-ups, CSV import/export, a kanban view, resume versions per application, analytics (response rate by source), Sentry for error tracking, and a staging environment.
