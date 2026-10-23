// BF_CLIENT_v789_SECURITY_HEADERS - the Static Web App sends a CSP and the
// standard hardening headers on every response. Reads public/ and index.html,
// which are deployment config, not application source.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const config = JSON.parse(readFileSync(join(root, "public", "staticwebapp.config.json"), "utf8")) as {
  globalHeaders?: Record<string, string>;
  routes?: Array<{ route: string; rewrite?: string; headers?: Record<string, string> }>;
};
const headers = config.globalHeaders ?? {};
const csp = headers["Content-Security-Policy"] ?? "";
const directiveOf = (policy: string, name: string): string[] => {
  const part = policy.split(";").map((p) => p.trim()).find((p) => p.startsWith(name + " "));
  return part ? part.split(/\s+/).slice(1) : [];
};
const directive = (name: string): string[] => directiveOf(csp, name);

describe("staticwebapp.config.json globalHeaders", () => {
  it("sends the hardening headers", () => {
    expect(headers["Strict-Transport-Security"]).toMatch(/max-age=\d{7,}/);
    expect(headers["X-Frame-Options"]).toBe("DENY");
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["Permissions-Policy"]).toBe("microphone=(self), camera=(self)");
  });

  it("never allows eval or inline script", () => {
    expect(csp).not.toContain("unsafe-eval");
    expect(directive("script-src")).not.toContain("'unsafe-inline'");
    expect(directive("frame-ancestors")).toEqual(["'none'"]);
    expect(directive("object-src")).toEqual(["'none'"]);
  });

  it("allows the API, Twilio, Google tags and Clarity", () => {
    const connect = directive("connect-src");
    expect(connect).toContain("https://ks-server-dev-chb5htbwaue2hygk.canadacentral-01.azurewebsites.net");
    expect(connect).toContain("wss://*.twilio.com");
    expect(connect).toContain("https://*.google-analytics.com");
    expect(connect).toContain("https://*.clarity.ms");
    const script = directive("script-src");
    expect(script).toContain("https://*.googletagmanager.com");
    expect(script).toContain("https://*.googleadservices.com");
    expect(script).toContain("https://*.clarity.ms");
  });

  it("allows the signing and bank-connection frames", () => {
    const frames = directive("frame-src");
    expect(frames).toContain("https://*.signnow.com");
    expect(frames).toContain("https://*.flinksapp.io");
  });
});

// KS_CLIENT_v11_LIVE_DEMO - the live demo (/tour) is shown inside the Keystone portal's phone frame, so that path
// alone may be framed, and only by the portal. Every other path keeps frame-ancestors 'none' and X-Frame-Options DENY.
describe("the live demo path can be framed by the Keystone portal only", () => {
  const PORTAL = "https://thankful-wave-04964490f.2.azurestaticapps.net";
  const routes = config.routes ?? [];
  const tourRoutes = routes.filter((r) => r.route === "/tour" || r.route === "/tour/*");

  it("has a rule for /tour and /tour/* that serves the app", () => {
    expect(tourRoutes.map((r) => r.route).sort()).toEqual(["/tour", "/tour/*"]);
    for (const r of tourRoutes) expect(r.rewrite).toBe("/index.html");
  });

  it("lets only the portal (and the app itself) frame /tour", () => {
    for (const r of tourRoutes) {
      const policy = r.headers?.["Content-Security-Policy"] ?? "";
      expect(directiveOf(policy, "frame-ancestors")).toEqual(["'self'", PORTAL]);
      // Same policy as every other page apart from who may frame it.
      expect(policy.replace(/frame-ancestors [^;]+/, "")).toBe(csp.replace(/frame-ancestors [^;]+/, ""));
      expect(policy).not.toContain("unsafe-eval");
      expect(directiveOf(policy, "script-src")).not.toContain("'unsafe-inline'");
    }
  });

  it("keeps framing refused everywhere else", () => {
    expect(headers["X-Frame-Options"]).toBe("DENY");
    expect(directive("frame-ancestors")).toEqual(["'none'"]);
    for (const r of routes.filter((x) => !tourRoutes.includes(x))) {
      expect(r.headers?.["Content-Security-Policy"]).toBeUndefined();
      expect(r.headers?.["X-Frame-Options"]).toBeUndefined();
    }
  });
});

describe("index.html carries no inline script for the CSP to allow", () => {
  const html = readFileSync(join(root, "index.html"), "utf8");
  it("every <script> has a src", () => {
    const scripts = html.match(/<script\b[^>]*>/g) ?? [];
    expect(scripts.length).toBeGreaterThan(0);
    for (const tag of scripts) expect(tag).toMatch(/\ssrc=/);
  });
  it("has no inline event handlers", () => {
    expect(html).not.toMatch(/\son(load|error|click)=/i);
  });
});
