// KS_CLIENT_PREVIEW_APP_v1 - the Keystone Preview build (VITE_KS_PREVIEW=1, from client-app/.env.production.local
// written by scripts/preview/brand-preview.mjs, or from the shell). It changes index.html only:
//   - a Content-Security-Policy that lets the page load and connect to the app's own files and nothing else, so the
//     WebView itself refuses any outside request (src/preview/guard.ts refuses them in the app first)
//   - no Google Fonts, web manifest or canonical link (the app falls back to system fonts and makes no outside call)
// Without VITE_KS_PREVIEW=1 nothing changes.
import type { Plugin } from "vite";

/** vite's loadEnv, passed in by vite.config.ts (so this file and its tests do not load vite itself). */
type LoadEnv = (mode: string, root: string, prefix: string) => Record<string, string>;

const LOCAL = "'self' capacitor://localhost https://localhost http://localhost";

export const PREVIEW_CSP = [
  `default-src ${LOCAL}`,
  `script-src ${LOCAL}`,
  `style-src ${LOCAL} 'unsafe-inline'`,
  `img-src ${LOCAL} data: blob:`,
  `font-src ${LOCAL} data:`,
  `connect-src ${LOCAL} data: blob:`,
  `media-src ${LOCAL} data: blob:`,
  `worker-src ${LOCAL} blob:`,
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join("; ");

/** index.html for the preview: outside links removed, the CSP added. */
export function previewHtml(html: string): string {
  const stripped = html
    .replace(/<link[^>]*fonts\.(googleapis|gstatic)\.com[^>]*>\s*/g, "")
    .replace(/<link\s+rel="manifest"[^>]*>\s*/g, "")
    .replace(/<link\s+rel="canonical"[^>]*>\s*/g, "");
  const meta = `<meta http-equiv="Content-Security-Policy" content="${PREVIEW_CSP}" />`;
  // Right after the charset declaration (which must stay within the first 1024 bytes), else first in <head>.
  const charset = /<meta charset="[^"]*"\s*\/?>/i;
  if (charset.test(stripped)) return stripped.replace(charset, (m) => `${m}\n    ${meta}`);
  return stripped.replace(/<head>/i, `<head>\n    ${meta}`);
}

export function isPreviewEnv(mode: string, root: string, loadEnv: LoadEnv, env: Record<string, string | undefined> = process.env): boolean {
  const fromShell = String(env.VITE_KS_PREVIEW ?? "").trim();
  if (fromShell) return fromShell === "1";
  return String(loadEnv(mode, root, "VITE_").VITE_KS_PREVIEW ?? "").trim() === "1";
}

export function previewPlugin(mode: string, root: string, loadEnv: LoadEnv): Plugin | null {
  if (!isPreviewEnv(mode, root, loadEnv)) return null;
  return {
    name: "ks-preview",
    // Build only: in `vite dev` the CSP would also block Vite's own reload connection.
    apply: "build",
    transformIndexHtml: { order: "post", handler: (html) => previewHtml(html) },
  };
}
