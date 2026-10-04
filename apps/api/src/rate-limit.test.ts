import { describe, expect, test } from "bun:test";
import { createRateLimitStorage } from "./rate-limit";

const rule = { window: 60, max: 3 };

describe("createRateLimitStorage", () => {
  test("allows up to max, then blocks with a retry hint", async () => {
    const store = createRateLimitStorage(() => 0);
    for (let i = 0; i < 3; i++) {
      expect((await store.consume("ip", rule)).allowed).toBe(true);
    }
    expect(await store.consume("ip", rule)).toEqual({
      allowed: false,
      retryAfter: 60,
    });
  });

  test("keys are independent and the window resets", async () => {
    let now = 0;
    const store = createRateLimitStorage(() => now);
    for (let i = 0; i < 4; i++) await store.consume("a", rule);

    expect((await store.consume("b", rule)).allowed).toBe(true);
    now = 61_000;
    expect((await store.consume("a", rule)).allowed).toBe(true);
  });

  test("two stores do not share counters", async () => {
    const one = createRateLimitStorage();
    const two = createRateLimitStorage();
    for (let i = 0; i < 4; i++) await one.consume("ip", rule);

    expect((await two.consume("ip", rule)).allowed).toBe(true);
  });

  test("expired entries are swept so memory stays bounded", async () => {
    let now = 0;
    const store = createRateLimitStorage(() => now);
    for (let i = 0; i < 10_000; i++) await store.consume(`ip-${i}`, rule);
    expect(store.size()).toBe(10_000);

    now = 61_000;
    await store.consume("fresh", rule);
    expect(store.size()).toBe(1);
  });
});
