// KS_CLIENT_v7_DEMO - adds the demo server (VITE_DEMO_SERVER_URL) to connect-src in the built
// staticwebapp.config.json, so the /demo/<code> page can reach it. Used by a Vite plugin in vite.config.ts.

/** The https origin of a URL, or null. */
export function httpsOrigin(raw: string | undefined | null): string | null {
  try {
    const u = new URL(String(raw ?? "").trim());
    return u.protocol === "https:" ? u.origin : null;
  } catch {
    return null;
  }
}

/** The policy with the origin added to connect-src (once). */
export function addConnectSrc(csp: string, origin: string): string {
  const parts = csp.split(";").map((p) => p.trim()).filter(Boolean);
  const i = parts.findIndex((p) => p.split(/\s+/)[0] === "connect-src");
  if (i < 0) return [...parts, `connect-src 'self' ${origin}`].join("; ");
  const words = parts[i]!.split(/\s+/);
  if (!words.includes(origin)) parts[i] = [...words, origin].join(" ");
  return parts.join("; ");
}

export function patchSwaConfig(json: string, origin: string): string {
  const cfg = JSON.parse(json) as { globalHeaders?: Record<string, string> };
  const headers = (cfg.globalHeaders ??= {});
  headers["Content-Security-Policy"] = addConnectSrc(headers["Content-Security-Policy"] ?? "default-src 'self'", origin);
  return JSON.stringify(cfg, null, 2) + "\n";
}
