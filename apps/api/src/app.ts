import { cors } from "@elysiajs/cors";
import { Elysia, t } from "elysia";
import { applicationRoutes } from "./applications";
import { authPlugin, createAuth } from "./auth";
import { createDb } from "./db";
import type { Env } from "./env";
import { createStaticHandler } from "./static";

// Largest accepted request body. Bun would otherwise buffer up to 128 MB.
export const MAX_BODY_BYTES = 64 * 1024;

export function createApp(env: Env) {
  const db = createDb(env.DATABASE_URL, env.MIGRATIONS_DIR);
  const auth = createAuth(db, env);
  const isProd = env.NODE_ENV === "production";

  const authRoutes = authPlugin(auth, env.TRUSTED_PROXY_HEADER);
  const serveWeb = env.WEB_DIST
    ? createStaticHandler(env.WEB_DIST, isProd)
    : undefined;

  return (
    new Elysia({ serve: { maxRequestBodySize: MAX_BODY_BYTES } })
      // Before the API header hook: static responses carry their own headers.
      .onRequest(({ request }) => serveWeb?.(request))
      .onRequest(({ set }) => {
        set.headers["x-content-type-options"] = "nosniff";
        set.headers["x-frame-options"] = "DENY";
        set.headers["referrer-policy"] = "no-referrer";
        set.headers["cross-origin-resource-policy"] = "same-site";
        set.headers["content-security-policy"] =
          "default-src 'none'; frame-ancestors 'none'";
        set.headers["cache-control"] = "no-store";
        if (isProd) {
          set.headers["strict-transport-security"] =
            "max-age=31536000; includeSubDomains";
        }
      })
      .use(
        cors({
          origin: env.WEB_ORIGIN,
          methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
          credentials: true,
          allowedHeaders: ["Content-Type"],
        }),
      )
      .onError(({ code, set }) => {
        if (code === "VALIDATION") {
          set.status = 422;
          return { error: "Invalid request" };
        }
        if (code === "PARSE") {
          set.status = 400;
          return { error: "Invalid request" };
        }
        if (code === "NOT_FOUND") {
          set.status = 404;
          return { error: "Not found" };
        }
        set.status = 500;
        return { error: "Internal server error" };
      })
      .get("/health", () => ({ status: "ok" as const }), {
        response: t.Object({ status: t.Literal("ok") }),
      })
      .use(authRoutes)
      .use(applicationRoutes(db, authRoutes))
      .get(
        "/me",
        ({ user }) => ({ id: user.id, email: user.email, name: user.name }),
        {
          auth: true,
          response: {
            200: t.Object({
              id: t.String(),
              email: t.String(),
              name: t.String(),
            }),
            401: t.Object({ error: t.String() }),
          },
        },
      )
  );
}

export type App = ReturnType<typeof createApp>;
