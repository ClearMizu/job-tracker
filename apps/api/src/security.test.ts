import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createApp, MAX_BODY_BYTES } from "./app";
import { type Env, parseEnv } from "./env";

const ORIGIN = "http://localhost:5173";
const base = {
  NODE_ENV: "test",
  DATABASE_URL: ":memory:",
  BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret-123",
  BETTER_AUTH_URL: "http://localhost:3000",
  WEB_ORIGIN: ORIGIN,
};

function request(
  app: ReturnType<typeof createApp>,
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
) {
  return app.handle(
    new Request(`http://localhost:3000${path}`, {
      method: "POST",
      body: typeof body === "string" ? body : JSON.stringify(body),
      headers: {
        origin: ORIGIN,
        "content-type": "application/json",
        ...headers,
      },
    }),
  );
}

const wrongLogin = { email: "nobody@example.com", password: "wrong-pass-1" };

async function statuses(
  app: ReturnType<typeof createApp>,
  headersFor: (i: number) => Record<string, string>,
  count = 8,
) {
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    const res = await request(
      app,
      "/api/auth/sign-in/email",
      wrongLogin,
      headersFor(i),
    );
    out.push(res.status);
  }
  return out;
}

describe("rate limit cannot be dodged with forwarded headers", () => {
  test("rotating X-Forwarded-For still hits the limit", async () => {
    const app = createApp(parseEnv(base));
    const codes = await statuses(app, (i) => ({
      "x-forwarded-for": `9.9.9.${i}`,
    }));
    expect(codes).toContain(429);
  });

  test("a client-sent X-Client-IP is overwritten, not trusted", async () => {
    const app = createApp(parseEnv(base));
    const codes = await statuses(app, (i) => ({ "x-client-ip": `7.7.7.${i}` }));
    expect(codes).toContain(429);
  });

  test("with a trusted proxy header, buckets follow that header only", async () => {
    const env = parseEnv({ ...base, TRUSTED_PROXY_HEADER: "X-Real-IP" });
    expect(env.TRUSTED_PROXY_HEADER).toBe("x-real-ip");

    const distinct = await statuses(createApp(env), (i) => ({
      "x-real-ip": `5.5.5.${i}`,
    }));
    expect(distinct).not.toContain(429);

    const same = await statuses(createApp(env), (i) => ({
      "x-real-ip": "5.5.5.5",
      "x-forwarded-for": `9.9.9.${i}`,
    }));
    expect(same).toContain(429);
  });

  test("rejects a malformed TRUSTED_PROXY_HEADER", () => {
    expect(() =>
      parseEnv({ ...base, TRUSTED_PROXY_HEADER: "x real\nip" }),
    ).toThrow(/TRUSTED_PROXY_HEADER/);
  });
});

describe("request size limits", () => {
  test("the server refuses bodies over the cap before parsing them", async () => {
    const app = createApp(parseEnv(base)).listen(0);
    try {
      const url = `http://localhost:${app.server?.port}/applications`;
      const send = (size: number) =>
        fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json", origin: ORIGIN },
          body: JSON.stringify({ company: "x".repeat(size), role: "y" }),
        });

      expect((await send(MAX_BODY_BYTES * 2)).status).toBe(413);
      expect((await send(10)).status).toBe(401);
    } finally {
      await app.stop(true);
    }
  });

  test("sign-up rejects an oversized name or email", async () => {
    const app = createApp(parseEnv(base));
    const signUp = (name: string, email: string) =>
      request(app, "/api/auth/sign-up/email", {
        name,
        email,
        password: "correct-horse-1",
      });

    expect((await signUp("n".repeat(101), "a@example.com")).status).toBe(400);
    const longEmail = `${"e".repeat(250)}@example.com`;
    expect((await signUp("Ada", longEmail)).status).toBe(400);
    expect((await signUp("n".repeat(100), "ok@example.com")).status).toBe(200);
  });
});

describe("error handling", () => {
  test("malformed JSON is a 400 with no internals", async () => {
    const app = createApp(parseEnv(base));
    const res = await request(app, "/applications", "{oops");

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid request" });
  });
});

describe("production settings", () => {
  const prod = (): Env =>
    parseEnv({
      ...base,
      NODE_ENV: "production",
      BETTER_AUTH_URL: "https://api.example.com",
      WEB_ORIGIN: "https://app.example.com",
    });

  test("session cookie is Secure and HSTS is sent", async () => {
    const app = createApp(prod());
    const res = await request(
      app,
      "/api/auth/sign-up/email",
      { name: "Ada", email: "ada@example.com", password: "correct-horse-1" },
      { origin: "https://app.example.com" },
    );
    const cookie = res.headers
      .getSetCookie()
      .find((c) => c.includes("session_token"));

    expect(res.status).toBe(200);
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toMatch(/SameSite=Lax/i);

    const health = await app.handle(new Request("http://localhost/health"));
    expect(health.headers.get("strict-transport-security")).toContain(
      "max-age=",
    );
  });

  test("the example secret is refused", () => {
    expect(() =>
      parseEnv({
        ...base,
        NODE_ENV: "production",
        BETTER_AUTH_SECRET: "replace-with-a-long-random-string",
      }),
    ).toThrow(/placeholder/);
  });
});

describe("client address on a real connection", () => {
  test("is the socket address, never the spoofed header", async () => {
    const app = createApp(parseEnv(base)).listen(0);
    try {
      const origin = `http://localhost:${app.server?.port}`;
      const signUp = await fetch(`${origin}/api/auth/sign-up/email`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: ORIGIN,
          "x-forwarded-for": "6.6.6.6",
          "x-client-ip": "6.6.6.6",
        },
        body: JSON.stringify({
          name: "Ada",
          email: "ip@example.com",
          password: "correct-horse-1",
        }),
      });
      const cookie =
        (signUp.headers.getSetCookie()[0] ?? "").split(";")[0] ?? "";

      const session = await fetch(`${origin}/api/auth/get-session`, {
        headers: { cookie, origin: ORIGIN },
      });
      const { session: row } = (await session.json()) as {
        session: { ipAddress: string | null };
      };

      expect(row.ipAddress).toBeTruthy();
      expect(row.ipAddress).not.toContain("6.6.6.6");
      expect(row.ipAddress).not.toBe("unknown");
      // Loopback is stored as 127.0.0.1, or as an IPv6 /64 prefix when connected over ::1.
      expect(row.ipAddress).toMatch(/^(127\.0\.0\.1|[0-9a-f:]+)$/i);
    } finally {
      await app.stop(true);
    }
  });
});

describe("CI workflows", () => {
  test("every workflow declares least-privilege permissions", () => {
    const dir = join(import.meta.dir, "../../../.github/workflows");
    const files = readdirSync(dir).filter((f) => f.endsWith(".yml"));
    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      const text = readFileSync(join(dir, file), "utf8");
      expect(`${file}: ${/^permissions:/m.test(text)}`).toBe(`${file}: true`);
    }
  });
});
