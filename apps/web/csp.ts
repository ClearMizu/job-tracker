import type { Plugin } from "vite";

export function buildCsp(apiOrigin?: string): string {
  const connect = apiOrigin ? `'self' ${new URL(apiOrigin).origin}` : "'self'";
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "font-src 'self' data:",
    "img-src 'self' data:",
    `connect-src ${connect}`,
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");
}

// frame-ancestors only works as a real response header, so the host must also send it.
export const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Frame-Options": "DENY",
};

// Production builds only: the dev server needs inline scripts for HMR.
export function cspPlugin(apiOrigin?: string): Plugin {
  return {
    name: "job-tracker-csp",
    apply: "build",
    transformIndexHtml() {
      return [
        {
          tag: "meta",
          attrs: {
            "http-equiv": "Content-Security-Policy",
            content: buildCsp(apiOrigin),
          },
          injectTo: "head-prepend",
        },
      ];
    },
  };
}
