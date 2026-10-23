// KS_CLIENT_v11_LIVE_DEMO - runs before any other app module on /tour (main.tsx imports it second, right after the
// storage shim), because the application store reads storage the moment it loads.
//   - Storage is in memory for this page: the demo never reads or writes the visitor's real client-app data, and a
//     cross-site iframe (where storage can be partitioned or blocked) behaves the same as a normal tab.
//   - fetch goes to the demo's in-browser server (shim.ts, loaded on first use); nothing reaches a real server.
//   - sendBeacon (journey tracking) is a no-op and blocking dialogs are stubbed (confirm -> true).
import { makeMemoryStorage } from "../bootStorageSafe";
import { isLiveDemoPath } from "./mode";

function install(win: Window & typeof globalThis): void {
  const local = makeMemoryStorage();
  const session = makeMemoryStorage();
  try {
    Object.defineProperty(win, "localStorage", { configurable: true, get: () => local });
    Object.defineProperty(win, "sessionStorage", { configurable: true, get: () => session });
  } catch {
    /* the host refused: the storage shim already made storage safe to call */
  }
  const realFetch = win.fetch.bind(win);
  win.fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
    import("./shim").then((m) => m.demoFetch(input, init, realFetch))) as typeof fetch;
  try {
    if (win.navigator && "sendBeacon" in win.navigator) {
      Object.defineProperty(win.navigator, "sendBeacon", { configurable: true, value: () => true });
    }
  } catch {
    /* journey beacons then fail quietly against the network instead */
  }
  win.confirm = () => true;
  win.alert = () => undefined;
  win.prompt = () => null;
}

export const LIVE_DEMO = typeof window !== "undefined" && isLiveDemoPath(window.location.pathname);

if (LIVE_DEMO) install(window as Window & typeof globalThis);
