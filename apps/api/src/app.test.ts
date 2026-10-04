import { describe, expect, test } from "bun:test";
import { createApp } from "./app";
import { parseEnv } from "./env";

const ORIGIN = "http://localhost:5173";
const env = parseEnv({
  NODE_ENV: "test",
  DATABASE_URL: ":memory:",
  BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret-123",
  BETTER_AUTH_URL: "http://localhost:3000",
  WEB_ORIGIN: ORIGIN,
});

let ipCounter = 0;
// Each test gets its own client IP so rate limit buckets don't collide.
function client() {
  const app = createApp(env);
  const ip = `10.0.0.${++ipCounter}`;
  const call = (path: string, init: RequestInit = {}) =>
    app.handle(
      new Request(`http://localhost:3000${path}`, {
        ...init,
        headers: {
          origin: ORIGIN,
          "x-forwarded-for": ip,
          ...(init.body ? { "content-type": "application/json" } : {}),
          ...init.headers,
        },
      }),
    );
  const post = (path: string, body: unknown, headers: HeadersInit = {}) =>
    call(path, { method: "POST", body: JSON.stringify(body), headers });
  return { call, post };
}

const creds = {
  name: "Ada",
  email: "ada@example.com",
  password: "correct-horse-1",
};

function sessionCookie(res: Response): string {
  const raw = res.headers
    .getSetCookie()
    .find((c) => c.includes("session_token"));
  if (!raw) throw new Error("no session cookie");
  return raw;
}

describe("health and headers", () => {
  test("health is ok and has security headers", async () => {
    const { call } = client();
    const res = await call("/health");
    expect(res.status).toBe(200);
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("x-frame-options")).toBe("DENY");
    expect(res.headers.get("content-security-policy")).toContain(
      "default-src 'none'",
    );
  });

  test("CORS allows only WEB_ORIGIN", async () => {
    const { call } = client();
    const ok = await call("/health", { headers: { origin: ORIGIN } });
    expect(ok.headers.get("access-control-allow-origin")).toBe(ORIGIN);
    expect(ok.headers.get("access-control-allow-credentials")).toBe("true");
    const bad = await call("/health", {
      headers: { origin: "http://evil.test" },
    });
    expect(bad.headers.get("access-control-allow-origin")).not.toBe(
      "http://evil.test",
    );
  });
});

describe("auth", () => {
  test("signup sets an HttpOnly SameSite session cookie", async () => {
    const { post } = client();
    const res = await post("/api/auth/sign-up/email", creds);
    expect(res.status).toBe(200);
    const cookie = sessionCookie(res);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).not.toContain("Secure");
  });

  test("login succeeds and the cookie unlocks /me", async () => {
    const { post, call } = client();
    await post("/api/auth/sign-up/email", creds);
    const login = await post("/api/auth/sign-in/email", {
      email: creds.email,
      password: creds.password,
    });
    expect(login.status).toBe(200);
    const me = await call("/me", {
      headers: { cookie: sessionCookie(login).split(";")[0] ?? "" },
    });
    expect(me.status).toBe(200);
    expect(await me.json()).toMatchObject({ email: creds.email, name: "Ada" });
  });

  test("wrong password is rejected without a session", async () => {
    const { post } = client();
    await post("/api/auth/sign-up/email", creds);
    const res = await post("/api/auth/sign-in/email", {
      email: creds.email,
      password: "wrong-password-1",
    });
    expect(res.status).toBe(401);
    expect(
      res.headers.getSetCookie().some((c) => c.includes("session_token")),
    ).toBe(false);
  });

  test("logout invalidates the session", async () => {
    const { post, call } = client();
    const signup = await post("/api/auth/sign-up/email", creds);
    const cookie = sessionCookie(signup).split(";")[0] ?? "";
    const out = await post("/api/auth/sign-out", {}, { cookie });
    expect(out.status).toBe(200);
    const me = await call("/me", { headers: { cookie } });
    expect(me.status).toBe(401);
  });

  test("sign-in is rate limited", async () => {
    const { post } = client();
    let last = 0;
    for (let i = 0; i < 7; i++) {
      const res = await post("/api/auth/sign-in/email", {
        email: "nobody@example.com",
        password: "wrong-password-1",
      });
      last = res.status;
    }
    expect(last).toBe(429);
  });
});

describe("/me", () => {
  test("returns 401 without a session", async () => {
    const { call } = client();
    const res = await call("/me");
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });
});
