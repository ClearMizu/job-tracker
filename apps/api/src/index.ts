import { createApp } from "./app";
import { parseEnv } from "./env";

export type { App } from "./app";

if (import.meta.main) {
  const env = parseEnv(process.env);
  createApp(env).listen(Number(new URL(env.BETTER_AUTH_URL).port) || 3000);
}
