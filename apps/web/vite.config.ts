import react from "@vitejs/plugin-react";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";
import { cspPlugin, SECURITY_HEADERS } from "./csp";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  // Unset means the API shares this page's origin, so 'self' is enough.
  const apiOrigin = env.VITE_API_URL || undefined;

  return {
    plugins: [react(), cspPlugin(apiOrigin)],
    server: { headers: SECURITY_HEADERS },
    preview: { headers: SECURITY_HEADERS },
    test: {
      environment: "jsdom",
      setupFiles: ["./src/test/setup.ts"],
    },
  };
});
