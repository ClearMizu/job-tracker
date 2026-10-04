import { Elysia } from "elysia";

export const app = new Elysia().get("/health", () => ({ status: "ok" }));

export type App = typeof app;

if (import.meta.main) {
  app.listen(3000);
}
