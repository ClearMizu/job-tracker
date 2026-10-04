import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "./app";
import { parseEnv } from "./env";

const SECRET = "TOP-SECRET-OUTSIDE-DIST";
let root: string;
let dist: string;

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "static-test-"));
  dist = join(root, "dist");
  mkdirSync(join(dist, "assets"), { recursive: true });
  writeFileSync(join(dist, "index.html"), "<!doctype html><title>SPA</title>");
  writeFileSync(join(dist, "assets", "app-abc.js"), "console.log(1)");
  writeFileSync(join(dist, ".hidden"), "nope");
  writeFileSync(join(root, "secret.txt"), SECRET);
});

afterAll(() => rmSync(root, { recursive: true, force: true }));

const env = () =>
  parseEnv({
    NODE_ENV: "production",
    DATABASE_URL: ":memory:",
    BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret-123",
    BETTER_AUTH_URL: "https://app.example.com",
    WEB_ORIGIN: "https://app.example.com",
    WEB_DIST: dist,
  });

const get = (path: string, init?: RequestInit) =>
  createApp(env()).handle(new Request(`https://app.example.com${path}`, init));

describe("serving the built web app", () => {
  test("the page is served with a real CSP, no-cache and HSTS", async () => {
    const res = await get("/");
    const csp = res.headers.get("content-security-policy") ?? "";

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(await res.text()).toContain("SPA");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("script-src 'self'");
    expect(res.headers.get("cache-control")).toBe("no-cache");
    expect(res.headers.get("x-frame-options")).toBe("DENY");
    expect(res.headers.get("strict-transport-security")).toContain("max-age=");
  });

  test("hashed assets are cached immutably and not sniffed", async () => {
    const res = await get("/assets/app-abc.js");

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("javascript");
    expect(res.headers.get("cache-control")).toContain("immutable");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  });

  test("unknown app routes fall back to the page; unknown files are 404", async () => {
    expect(await (await get("/some/client/route")).text()).toContain("SPA");

    const missing = await get("/assets/missing.js");
    expect(missing.status).toBe(404);
    expect(await missing.text()).not.toContain("SPA");
  });

  test("path traversal and dotfiles never leak files", async () => {
    for (const path of [
      "/..%2fsecret.txt",
      "/%2e%2e/secret.txt",
      "/assets/..%2f..%2fsecret.txt",
      "/%252e%252e/secret.txt",
      "/.hidden",
      "/assets/%2e%2e/.hidden",
    ]) {
      const body = await (await get(path)).text();
      expect(body).not.toContain(SECRET);
      expect(body).not.toBe("nope");
    }
    expect((await get("/.hidden")).status).toBe(404);
  });

  test("API paths are never answered with the page", async () => {
    const apps = await get("/applications");
    expect(apps.status).toBe(401);
    expect(await apps.json()).toEqual({ error: "Unauthorized" });

    const health = await get("/health");
    expect(await health.json()).toEqual({ status: "ok" });

    const session = await get("/api/auth/get-session");
    expect(session.headers.get("content-type")).not.toContain("text/html");
  });

  test("only GET and HEAD are served; HEAD has no body", async () => {
    const post = await get("/", { method: "POST", body: "{}" });
    expect(post.headers.get("content-type") ?? "").not.toContain("text/html");

    const head = await get("/", { method: "HEAD" });
    expect(head.status).toBe(200);
    expect(await head.text()).toBe("");
  });

  test("startup fails fast when WEB_DIST has no built app", () => {
    expect(() =>
      createApp({ ...env(), WEB_DIST: join(root, "missing") }),
    ).toThrow(/WEB_DIST/);
  });

  test("without WEB_DIST the API serves no pages", async () => {
    const app = createApp({ ...env(), WEB_DIST: undefined });
    const res = await app.handle(new Request("https://app.example.com/"));
    expect(res.status).toBe(404);
  });
});
