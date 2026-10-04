import { describe, expect, test } from "bun:test";
import { parseEnv } from "./env";

const valid = {
  NODE_ENV: "development",
  DATABASE_URL: "./data/app.db",
  BETTER_AUTH_SECRET: "a".repeat(32),
  BETTER_AUTH_URL: "http://localhost:3000",
  WEB_ORIGIN: "http://localhost:5173",
};

describe("parseEnv", () => {
  test("accepts a valid environment", () => {
    expect(parseEnv(valid).WEB_ORIGIN).toBe("http://localhost:5173");
  });

  test("rejects missing and malformed variables without echoing values", () => {
    const attempt = () =>
      parseEnv({ ...valid, BETTER_AUTH_SECRET: "short", WEB_ORIGIN: "" });
    expect(attempt).toThrow(/BETTER_AUTH_SECRET must be at least 32/);
    expect(attempt).toThrow(/WEB_ORIGIN is required/);
    expect(attempt).not.toThrow(/short"/);
  });

  test("rejects WEB_ORIGIN with a path", () => {
    expect(() => parseEnv({ ...valid, WEB_ORIGIN: "http://x.com/a" })).toThrow(
      /WEB_ORIGIN must be an origin/,
    );
  });
});
