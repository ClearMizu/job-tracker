import { existsSync, statSync } from "node:fs";
import { join, resolve, sep } from "node:path";

// Paths owned by the API; everything else is the web app.
const API_PATHS = [
  /^\/api(\/|$)/,
  /^\/me$/,
  /^\/applications(\/|$)/,
  /^\/health$/,
];

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "font-src 'self' data:",
  "img-src 'self' data:",
  "connect-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
].join("; ");

const isFile = (path: string) => {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
};

// Serves the built web app (hashed assets + SPA fallback). Returns undefined for
// requests that belong to the API so the router handles them.
export function createStaticHandler(root: string, hsts: boolean) {
  const base = resolve(root);
  const indexPath = join(base, "index.html");
  if (!existsSync(indexPath)) {
    throw new Error(
      "WEB_DIST must point to a built web app (index.html missing)",
    );
  }

  const headers = (file: string, type: string): Record<string, string> => {
    const isHtml = file === indexPath;
    return {
      "content-type": type,
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
      "x-frame-options": "DENY",
      "cross-origin-resource-policy": "same-origin",
      "cache-control": file.startsWith(join(base, "assets") + sep)
        ? "public, max-age=31536000, immutable"
        : "no-cache",
      ...(isHtml ? { "content-security-policy": CSP } : {}),
      ...(hsts
        ? { "strict-transport-security": "max-age=31536000; includeSubDomains" }
        : {}),
    };
  };

  return (request: Request): Response | undefined => {
    if (request.method !== "GET" && request.method !== "HEAD") return undefined;

    const { pathname } = new URL(request.url);
    if (API_PATHS.some((pattern) => pattern.test(pathname))) return undefined;

    let decoded: string;
    try {
      decoded = decodeURIComponent(pathname);
    } catch {
      return new Response("Bad request", { status: 400 });
    }
    if (decoded.includes("\0"))
      return new Response("Bad request", { status: 400 });

    const target = resolve(base, `.${decoded}`);
    const inside = target === base || target.startsWith(base + sep);
    const segments = decoded.split("/");
    const hidden = segments.some((segment) => segment.startsWith("."));
    if (!inside || hidden) return new Response("Not found", { status: 404 });

    let file = target;
    if (!isFile(file)) {
      // A missing asset must not be answered with HTML; extensionless paths are app routes.
      if (/\.[a-z0-9]+$/i.test(segments.at(-1) ?? "")) {
        return new Response("Not found", { status: 404 });
      }
      file = indexPath;
    }

    const bunFile = Bun.file(file);
    const responseHeaders = headers(file, bunFile.type);
    return request.method === "HEAD"
      ? new Response(null, { headers: responseHeaders })
      : new Response(bunFile, { headers: responseHeaders });
  };
}
