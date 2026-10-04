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

async function setup() {
  const app = createApp(env);
  const request = (
    path: string,
    method = "GET",
    body?: unknown,
    cookie?: string,
  ) =>
    app.handle(
      new Request(`http://localhost:3000${path}`, {
        method,
        body: body === undefined ? undefined : JSON.stringify(body),
        headers: {
          origin: ORIGIN,
          // Fresh IP per request keeps auth rate limit buckets apart.
          "x-forwarded-for": `10.1.${Math.floor(++ipCounter / 250)}.${ipCounter % 250}`,
          ...(body === undefined ? {} : { "content-type": "application/json" }),
          ...(cookie ? { cookie } : {}),
        },
      }),
    );
  const signup = async (email: string) => {
    const res = await request("/api/auth/sign-up/email", "POST", {
      name: "Test",
      email,
      password: "correct-horse-1",
    });
    const raw = res.headers
      .getSetCookie()
      .find((c) => c.includes("session_token"));
    if (!raw) throw new Error("signup failed");
    return raw.split(";")[0] ?? "";
  };
  return { request, signup };
}

const valid = { company: "Acme", role: "Engineer" };

describe("applications", () => {
  test("create then get returns the record with an initial history row", async () => {
    const { request, signup } = await setup();
    const cookie = await signup("a@example.com");
    const created = await request(
      "/applications",
      "POST",
      { ...valid, url: "https://acme.test/jobs/1", notes: "referral" },
      cookie,
    );
    expect(created.status).toBe(201);
    const app = (await created.json()) as { id: string; status: string };
    expect(app.status).toBe("saved");

    const got = await request(
      `/applications/${app.id}`,
      "GET",
      undefined,
      cookie,
    );
    expect(got.status).toBe(200);
    const body = (await got.json()) as {
      company: string;
      history: { fromStatus: string | null; toStatus: string }[];
    };
    expect(body.company).toBe("Acme");
    expect(body.history).toHaveLength(1);
    expect(body.history[0]).toMatchObject({
      fromStatus: null,
      toStatus: "saved",
    });
  });

  test("list filters by status and paginates", async () => {
    const { request, signup } = await setup();
    const cookie = await signup("b@example.com");
    for (let i = 0; i < 3; i++) {
      await request(
        "/applications",
        "POST",
        { ...valid, company: `Co${i}` },
        cookie,
      );
    }
    await request(
      "/applications",
      "POST",
      { ...valid, status: "applied" },
      cookie,
    );

    const applied = await request(
      "/applications?status=applied",
      "GET",
      undefined,
      cookie,
    );
    expect(((await applied.json()) as { total: number }).total).toBe(1);

    const page = await request(
      "/applications?page=2&pageSize=3",
      "GET",
      undefined,
      cookie,
    );
    const pageBody = (await page.json()) as {
      items: unknown[];
      total: number;
      page: number;
    };
    expect(pageBody).toMatchObject({ total: 4, page: 2 });
    expect(pageBody.items).toHaveLength(1);
  });

  test("update records history only when status changes", async () => {
    const { request, signup } = await setup();
    const cookie = await signup("c@example.com");
    const created = await request("/applications", "POST", valid, cookie);
    const { id } = (await created.json()) as { id: string };

    const same = await request(
      `/applications/${id}`,
      "PATCH",
      { status: "saved", notes: "x" },
      cookie,
    );
    expect(same.status).toBe(200);
    const moved = await request(
      `/applications/${id}`,
      "PATCH",
      { status: "interview" },
      cookie,
    );
    expect(((await moved.json()) as { status: string }).status).toBe(
      "interview",
    );

    const got = await request(`/applications/${id}`, "GET", undefined, cookie);
    const { history } = (await got.json()) as {
      history: { fromStatus: string | null; toStatus: string }[];
    };
    expect(history.map((h) => h.toStatus)).toEqual(["saved", "interview"]);
    expect(history[1]?.fromStatus).toBe("saved");
  });

  test("update can clear nullable fields", async () => {
    const { request, signup } = await setup();
    const cookie = await signup("d@example.com");
    const created = await request(
      "/applications",
      "POST",
      { ...valid, notes: "hi", url: "http://acme.test" },
      cookie,
    );
    const { id } = (await created.json()) as { id: string };
    const res = await request(
      `/applications/${id}`,
      "PATCH",
      { notes: null, url: null },
      cookie,
    );
    expect(await res.json()).toMatchObject({ notes: null, url: null });
  });

  test("delete removes the record", async () => {
    const { request, signup } = await setup();
    const cookie = await signup("e@example.com");
    const created = await request("/applications", "POST", valid, cookie);
    const { id } = (await created.json()) as { id: string };
    const del = await request(
      `/applications/${id}`,
      "DELETE",
      undefined,
      cookie,
    );
    expect(del.status).toBe(204);
    const got = await request(`/applications/${id}`, "GET", undefined, cookie);
    expect(got.status).toBe(404);
  });

  test("rejects invalid input", async () => {
    const { request, signup } = await setup();
    const cookie = await signup("f@example.com");
    const bad = [
      { ...valid, url: "javascript:alert(1)" },
      { ...valid, url: "ftp://acme.test" },
      { ...valid, notes: "x".repeat(2001) },
      { ...valid, status: "ghosted" },
      { ...valid, company: "   " },
      { role: "Engineer" },
    ];
    for (const body of bad) {
      const res = await request("/applications", "POST", body, cookie);
      expect(res.status).toBe(422);
    }
    const size = await request(
      "/applications?pageSize=101",
      "GET",
      undefined,
      cookie,
    );
    expect(size.status).toBe(422);
    const empty = await request("/applications/abc", "PATCH", {}, cookie);
    expect(empty.status).toBe(422);
  });
});

describe("applications auth", () => {
  test("every route returns 401 without a session", async () => {
    const { request } = await setup();
    const calls: [string, string, unknown?][] = [
      ["GET", "/applications"],
      ["POST", "/applications", valid],
      ["GET", "/applications/x"],
      ["PATCH", "/applications/x", { notes: "n" }],
      ["DELETE", "/applications/x"],
    ];
    for (const [method, path, body] of calls) {
      const res = await request(path, method, body);
      expect(res.status).toBe(401);
    }
  });

  test("another user cannot read, change or delete a record", async () => {
    const { request, signup } = await setup();
    const alice = await signup("alice@example.com");
    const bob = await signup("bob@example.com");
    const created = await request("/applications", "POST", valid, alice);
    const { id } = (await created.json()) as { id: string };

    expect(
      (await request(`/applications/${id}`, "GET", undefined, bob)).status,
    ).toBe(404);
    expect(
      (await request(`/applications/${id}`, "PATCH", { status: "offer" }, bob))
        .status,
    ).toBe(404);
    expect(
      (await request(`/applications/${id}`, "DELETE", undefined, bob)).status,
    ).toBe(404);

    const list = await request("/applications", "GET", undefined, bob);
    expect(((await list.json()) as { total: number }).total).toBe(0);

    const still = await request(`/applications/${id}`, "GET", undefined, alice);
    expect(((await still.json()) as { status: string }).status).toBe("saved");
  });
});
