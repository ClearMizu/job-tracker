import { defineConfig, devices } from "@playwright/test";

const API_PORT = 3100;
const WEB_PORT = 5174;
const API_URL = `http://localhost:${API_PORT}`;
const WEB_URL = `http://localhost:${WEB_PORT}`;
const CI = !!process.env.CI;

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  reporter: CI
    ? [
        ["github"],
        ["html", { outputFolder: "../playwright-report", open: "never" }],
      ]
    : [["list"]],
  outputDir: "../test-results",
  use: {
    baseURL: WEB_URL,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "bun src/index.ts",
      cwd: "../apps/api",
      url: `${API_URL}/health`,
      // Never reuse a running server: a fresh process means a fresh database.
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        NODE_ENV: "development",
        // In-memory SQLite is created empty on every start and vanishes on exit.
        DATABASE_URL: ":memory:",
        BETTER_AUTH_SECRET: "e2e-only-secret-e2e-only-secret-0123456789",
        BETTER_AUTH_URL: API_URL,
        WEB_ORIGIN: WEB_URL,
      },
    },
    {
      command: `bunx vite --host localhost --port ${WEB_PORT} --strictPort`,
      cwd: "../apps/web",
      url: WEB_URL,
      reuseExistingServer: false,
      timeout: 60_000,
      env: { VITE_API_URL: API_URL },
    },
  ],
});
