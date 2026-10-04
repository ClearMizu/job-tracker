import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { Elysia } from "elysia";
import { type Db, schema } from "./db";
import type { Env } from "./env";
import { createRateLimitStorage } from "./rate-limit";

export const CLIENT_IP_HEADER = "x-client-ip";
const MAX_NAME = 100;
const MAX_EMAIL = 254;

export function createAuth(db: Db, env: Env) {
  return betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [env.WEB_ORIGIN],
    database: drizzleAdapter(db, { provider: "sqlite", schema }),
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== "/sign-up/email") return;
        const body = ctx.body as
          | { name?: unknown; email?: unknown }
          | undefined;
        if (typeof body?.name === "string" && body.name.length > MAX_NAME) {
          throw new APIError("BAD_REQUEST", { message: "Name is too long" });
        }
        if (typeof body?.email === "string" && body.email.length > MAX_EMAIL) {
          throw new APIError("BAD_REQUEST", { message: "Email is too long" });
        }
      }),
    },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
    },
    advanced: {
      useSecureCookies: env.NODE_ENV === "production",
      defaultCookieAttributes: { httpOnly: true, sameSite: "lax" },
      // Only the header our server sets itself; client-sent forwarding headers are never read.
      ipAddress: { ipAddressHeaders: [CLIENT_IP_HEADER] },
    },
    rateLimit: {
      enabled: true,
      window: 60,
      max: 60,
      customRules: {
        "/sign-in/email": { window: 60, max: 5 },
        "/sign-up/email": { window: 60, max: 5 },
      },
      customStorage: createRateLimitStorage(),
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;

// Named, so Elysia registers the handler once however many plugins use it.
// Never trust client-sent X-Forwarded-For: use the socket address, or the header
// an operator has declared their proxy overwrites.
export const authPlugin = (auth: Auth, trustedProxyHeader?: string) =>
  new Elysia({ name: "better-auth" })
    .all(
      "/api/auth/*",
      ({ request, server }) => {
        const ip =
          (trustedProxyHeader
            ? request.headers.get(trustedProxyHeader)?.trim()
            : null) ||
          server?.requestIP(request)?.address ||
          "unknown";
        const headers = new Headers(request.headers);
        headers.set(CLIENT_IP_HEADER, ip);
        return auth.handler(new Request(request, { headers }));
      },
      // Better Auth reads the body itself.
      { parse: "none" },
    )
    .macro({
      auth: {
        async resolve({ status, request: { headers } }) {
          const current = await auth.api.getSession({ headers });
          if (!current) return status(401, { error: "Unauthorized" });
          return { user: current.user, session: current.session };
        },
      },
    });

export type AuthPlugin = ReturnType<typeof authPlugin>;
