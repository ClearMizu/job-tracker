import { afterEach, describe, expect, test, vi } from "vitest";
import { signIn, signOut } from "./auth";

vi.mock("../api", () => ({ apiOrigin: "http://api.test" }));

const respond = (status: number, body: unknown = {}) =>
  vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));

afterEach(() => vi.unstubAllGlobals());

describe("auth client", () => {
  test("posts credentials with cookies to the configured API origin", async () => {
    const fetchMock = respond(200);
    vi.stubGlobal("fetch", fetchMock);

    expect(await signIn("a@b.co", "pw-pw-pw-1")).toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://api.test/api/auth/sign-in/email");
    expect(init.credentials).toBe("include");
    expect(init.body).toBe(
      JSON.stringify({ email: "a@b.co", password: "pw-pw-pw-1" }),
    );
  });

  test("maps 401 and 429 to plain messages", async () => {
    vi.stubGlobal("fetch", respond(401));
    expect(await signIn("a@b.co", "x")).toEqual({
      ok: false,
      message: "Wrong email or password.",
    });
    vi.stubGlobal("fetch", respond(429));
    expect(await signIn("a@b.co", "x")).toMatchObject({
      ok: false,
      message: expect.stringContaining("Too many"),
    });
  });

  test("reports an unreachable API", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    expect(await signOut()).toEqual({
      ok: false,
      message: "Couldn't reach the API.",
    });
  });
});
