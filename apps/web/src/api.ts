import { treaty } from "@elysiajs/eden";
import type { App } from "@job-tracker/api";

// In production the API serves this app, so same-origin is the default.
export const apiOrigin =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD ? window.location.origin : "http://localhost:3000");

export const api = treaty<App>(apiOrigin, {
  fetch: { credentials: "include" },
});
