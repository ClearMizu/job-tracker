export type Env = {
  NODE_ENV: "development" | "test" | "production";
  DATABASE_URL: string;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  WEB_ORIGIN: string;
  // Header a trusted reverse proxy sets to the real client IP. Unset when exposed directly.
  TRUSTED_PROXY_HEADER: string | undefined;
  // Directory of the built web app. When set, the API serves it too (single origin).
  WEB_DIST: string | undefined;
  // Where the SQL migrations live. Defaults to the source tree; set for bundled builds.
  MIGRATIONS_DIR: string | undefined;
};

type Source = Record<string, string | undefined>;

const NODE_ENVS = ["development", "test", "production"] as const;

const isOrigin = (value: string): boolean => {
  try {
    const url = new URL(value);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      url.origin === value
    );
  } catch {
    return false;
  }
};

// Variables mirror .env.example. Throws with every problem listed; never echoes values.
export function parseEnv(source: Source): Env {
  const errors: string[] = [];
  const get = (key: string): string => {
    const value = source[key]?.trim();
    if (!value) errors.push(`${key} is required`);
    return value ?? "";
  };

  const nodeEnv = source.NODE_ENV?.trim() || "development";
  if (!NODE_ENVS.includes(nodeEnv as (typeof NODE_ENVS)[number])) {
    errors.push(`NODE_ENV must be one of ${NODE_ENVS.join(", ")}`);
  }

  const databaseUrl = get("DATABASE_URL");
  const secret = get("BETTER_AUTH_SECRET");
  const authUrl = get("BETTER_AUTH_URL");
  const webOrigin = get("WEB_ORIGIN");

  if (secret && secret.length < 32) {
    errors.push("BETTER_AUTH_SECRET must be at least 32 characters");
  }
  if (nodeEnv === "production" && secret.startsWith("replace-with")) {
    errors.push("BETTER_AUTH_SECRET must not be the example placeholder");
  }
  if (authUrl && !isOrigin(authUrl)) {
    errors.push("BETTER_AUTH_URL must be an origin like http://localhost:3000");
  }
  if (webOrigin && !isOrigin(webOrigin)) {
    errors.push("WEB_ORIGIN must be an origin like http://localhost:5173");
  }

  const proxyHeader = source.TRUSTED_PROXY_HEADER?.trim().toLowerCase();
  if (proxyHeader && !/^[a-z0-9-]+$/.test(proxyHeader)) {
    errors.push("TRUSTED_PROXY_HEADER must be a header name like x-real-ip");
  }

  if (errors.length > 0) {
    throw new Error(`Invalid environment:\n- ${errors.join("\n- ")}`);
  }

  return {
    NODE_ENV: nodeEnv as Env["NODE_ENV"],
    DATABASE_URL: databaseUrl,
    BETTER_AUTH_SECRET: secret,
    BETTER_AUTH_URL: authUrl,
    WEB_ORIGIN: webOrigin,
    TRUSTED_PROXY_HEADER: proxyHeader || undefined,
    WEB_DIST: source.WEB_DIST?.trim() || undefined,
    MIGRATIONS_DIR: source.MIGRATIONS_DIR?.trim() || undefined,
  };
}
