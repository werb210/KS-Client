// KS_CLIENT_PREVIEW_APP_v1 - "Keystone Preview": a build of the client app for iOS and Android that runs entirely on
// the device on sample data, for licensees and prospects to tap through. Built with VITE_KS_PREVIEW=1 (written by
// scripts/preview/brand-preview.mjs). See docs/PREVIEW_APP.md.
export const PREVIEW_BANNER_TEXT = "Preview - sample data only";

export function isPreviewBuild(env: Record<string, unknown> | undefined = (import.meta as { env?: Record<string, unknown> }).env): boolean {
  return String(env?.VITE_KS_PREVIEW ?? "").trim() === "1";
}
