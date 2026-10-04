import { describe, expect, test } from "vitest";
import { buildCsp, cspPlugin, SECURITY_HEADERS } from "../../csp";

describe("buildCsp", () => {
  test("locks scripts and styles to self and allows only the API origin", () => {
    const csp = buildCsp("https://api.example.com/some/path");

    expect(csp).toContain("script-src 'self';");
    expect(csp).toContain("connect-src 'self' https://api.example.com;");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).not.toMatch(/unsafe-inline|unsafe-eval|\*/);
  });

  test("rejects an invalid API origin instead of weakening the policy", () => {
    expect(() => buildCsp("not a url")).toThrow();
  });

  test("without an API origin, connections are limited to self", () => {
    expect(buildCsp()).toContain("connect-src 'self';");
    expect(buildCsp()).not.toContain("http");
  });
});

describe("cspPlugin", () => {
  test("injects the policy as the first tag of the built page", () => {
    const plugin = cspPlugin("http://localhost:3000");
    const hook = plugin.transformIndexHtml as () => unknown[];

    expect(plugin.apply).toBe("build");
    expect(hook()).toEqual([
      expect.objectContaining({
        tag: "meta",
        injectTo: "head-prepend",
        attrs: expect.objectContaining({
          "http-equiv": "Content-Security-Policy",
          content: buildCsp("http://localhost:3000"),
        }),
      }),
    ]);
  });

  test("dev and preview servers send the basic hardening headers", () => {
    expect(SECURITY_HEADERS).toMatchObject({
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "X-Frame-Options": "DENY",
    });
  });
});
