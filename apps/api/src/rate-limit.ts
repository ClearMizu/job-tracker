type Rule = { window: number; max: number };
type Entry = { count: number; resetAt: number };

const SWEEP_AT = 10_000;

// Per-app fixed-window counter. Better Auth's default store is shared by every
// instance in the process; this one is isolated and bounded in size.
export function createRateLimitStorage(now: () => number = Date.now) {
  const entries = new Map<string, Entry>();

  const sweep = (at: number) => {
    for (const [key, entry] of entries) {
      if (entry.resetAt <= at) entries.delete(key);
    }
  };

  return {
    size: () => entries.size,
    consume: async (key: string, rule: Rule) => {
      const at = now();
      if (entries.size >= SWEEP_AT) sweep(at);

      let entry = entries.get(key);
      if (!entry || entry.resetAt <= at) {
        entry = { count: 0, resetAt: at + rule.window * 1000 };
        entries.set(key, entry);
      }
      entry.count += 1;

      if (entry.count > rule.max) {
        return {
          allowed: false,
          retryAfter: Math.max(1, Math.ceil((entry.resetAt - at) / 1000)),
        };
      }
      return { allowed: true, retryAfter: null };
    },
  };
}
