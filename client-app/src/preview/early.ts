// KS_CLIENT_PREVIEW_APP_v1 - runs before any other app module in the preview build (main.tsx imports it right after
// the storage shims), so no module can capture the real fetch first. Storage is in memory: every launch starts again
// from the sample file and nothing from a real client app is ever read.
import { makeMemoryStorage } from "../bootStorageSafe";
import { installPreviewGuards, type PreviewLog } from "./guard";
import { isPreviewBuild } from "./mode";

export const PREVIEW = typeof window !== "undefined" && isPreviewBuild();

export let previewLog: PreviewLog | null = null;

if (PREVIEW) {
  const win = window as Window & typeof globalThis;
  const local = makeMemoryStorage();
  const session = makeMemoryStorage();
  try {
    Object.defineProperty(win, "localStorage", { configurable: true, get: () => local });
    Object.defineProperty(win, "sessionStorage", { configurable: true, get: () => session });
  } catch {
    /* the storage shim already made storage safe to call */
  }
  previewLog = installPreviewGuards(win).log;
  win.confirm = () => true;
}
