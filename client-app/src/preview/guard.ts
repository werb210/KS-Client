// KS_CLIENT_PREVIEW_APP_v1 - the "Keystone Preview" app's network lock. The preview build runs the real client app on
// sample data and must never send anything to any server. Every way the page can reach the network is closed here,
// before any app module loads (see ./early.ts):
//   - fetch: /api/... is answered in the app by the live demo's sample server (src/liveDemo/shim.ts); the app's own
//     bundled files (same origin, blob:, data:) load as usual; ANY other request is refused with PreviewNetworkError
//     and never reaches the real fetch
//   - XMLHttpRequest to anything but the app's own files, WebSocket and EventSource throw; sendBeacon sends nothing
//   - the native plugins that talk to servers on their own (push registration, the home-screen widget's refresh, the
//     Live Activity registration, background uploads) are refused at the Capacitor bridge
// The build also carries a Content-Security-Policy with connect-src limited to the app itself (vite.preview.ts), so
// the WebView refuses an outside request even if something got past this file.
import { answer, createDemoState, isApiUrl, type DemoState } from "../liveDemo/shim";

export class PreviewNetworkError extends TypeError {
  constructor(what: string) {
    super(`Keystone Preview works offline on sample data: ${what} was not sent.`);
    this.name = "PreviewNetworkError";
  }
}

/** Native plugin methods that would reach a server by themselves ("*" = every method). */
export const PREVIEW_DENIED_PLUGINS: Record<string, "*" | string[]> = {
  PushNotifications: ["register"],
  ClientWidget: "*",
  ApplicationStatus: "*",
  BackgroundUpload: "*",
};

export function pluginDenied(plugin: string, method: string): boolean {
  const rule = PREVIEW_DENIED_PLUGINS[plugin];
  return rule === "*" || (Array.isArray(rule) && rule.includes(method));
}

export type PreviewLog = { blocked: string[]; answered: string[] };

type Loc = { protocol: string; host: string; href: string };

/** True for the app's own bundled files: same scheme and host as the page, or blob:/data: URLs made on the device. */
export function isLocalUrl(raw: string, page: Loc): boolean {
  let u: URL;
  try {
    u = new URL(raw, page.href);
  } catch {
    return false;
  }
  if (u.protocol === "blob:" || u.protocol === "data:") return true;
  return u.protocol === page.protocol && u.host === page.host;
}

function requestParts(input: RequestInfo | URL, init?: RequestInit): { url: string; method: string; body: unknown } {
  if (typeof input === "string") return { url: input, method: init?.method ?? "GET", body: init?.body };
  if (input instanceof URL) return { url: input.href, method: init?.method ?? "GET", body: init?.body };
  return { url: input.url, method: init?.method ?? input.method ?? "GET", body: init?.body };
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/**
 * The preview's fetch. Order matters: an /api/... path is answered from `state` whatever host it names (so the build's
 * server address is never contacted), then the app's own files go to the real fetch, and everything else is refused.
 */
export function createPreviewFetch(state: DemoState, realFetch: typeof fetch, page: Loc, log: PreviewLog): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const { url, method, body } = requestParts(input, init);
    if (isApiUrl(url)) {
      const res = answer(state, method, url, body);
      log.answered.push(`${method.toUpperCase()} ${new URL(url, page.href).pathname}`);
      return json(res.status, res.body);
    }
    if (isLocalUrl(url, page)) return realFetch(input as RequestInfo, init);
    log.blocked.push(`fetch ${url}`);
    throw new PreviewNetworkError(`a request to ${safeHost(url, page)}`);
  }) as typeof fetch;
}

function safeHost(url: string, page: Loc): string {
  try {
    return new URL(url, page.href).host || "an outside address";
  } catch {
    return "an outside address";
  }
}

type GuardWindow = Window & typeof globalThis;

/**
 * Closes every network path on `win` and returns the log of what was answered and refused. Runs once, before the app.
 * `realFetch` is the fetch the app's own files go to (the window's own by default).
 */
export function installPreviewGuards(win: GuardWindow, opts: { realFetch?: typeof fetch; state?: DemoState } = {}): { log: PreviewLog; state: DemoState } {
  const log: PreviewLog = { blocked: [], answered: [] };
  const state = opts.state ?? createDemoState();
  const page: Loc = win.location;
  const realFetch = opts.realFetch ?? win.fetch.bind(win);
  win.fetch = createPreviewFetch(state, realFetch, page, log);

  const RealXHR = win.XMLHttpRequest;
  if (RealXHR) {
    class PreviewXHR extends RealXHR {
      open(...args: unknown[]): void {
        const url = String(args[1] ?? "");
        if (!isLocalUrl(url, page)) {
          log.blocked.push(`xhr ${url}`);
          throw new PreviewNetworkError(`a request to ${safeHost(url, page)}`);
        }
        return (RealXHR.prototype.open as (...a: unknown[]) => void).apply(this, args);
      }
    }
    win.XMLHttpRequest = PreviewXHR as typeof XMLHttpRequest;
  }

  const refuse = (kind: string) =>
    function Refused(url: string | URL) {
      log.blocked.push(`${kind} ${String(url)}`);
      throw new PreviewNetworkError(`a ${kind} connection to ${safeHost(String(url), page)}`);
    } as unknown;
  try {
    win.WebSocket = refuse("websocket") as typeof WebSocket;
  } catch {
    /* the CSP still refuses it */
  }
  try {
    win.EventSource = refuse("eventsource") as typeof EventSource;
  } catch {
    /* the CSP still refuses it */
  }
  try {
    if (win.navigator && "sendBeacon" in win.navigator) {
      Object.defineProperty(win.navigator, "sendBeacon", {
        configurable: true,
        value: (url: string) => {
          log.blocked.push(`beacon ${url}`);
          return false;
        },
      });
    }
  } catch {
    /* the CSP still refuses it */
  }

  guardNativeBridge(win, log);
  return { log, state };
}

type Bridge = {
  nativePromise?: (plugin: string, method: string, options?: unknown) => Promise<unknown>;
  nativeCallback?: (plugin: string, method: string, options?: unknown, callback?: (r: unknown, e?: unknown) => void) => string;
};

/** Refuses the server-talking native plugin methods at the Capacitor bridge (native builds only; a no-op on the web). */
export function guardNativeBridge(win: unknown, log: PreviewLog): boolean {
  const cap = (win as { Capacitor?: Bridge }).Capacitor;
  if (!cap || typeof cap.nativePromise !== "function") return false;
  const promise = cap.nativePromise.bind(cap);
  cap.nativePromise = (plugin, method, options) => {
    if (pluginDenied(plugin, method)) {
      log.blocked.push(`native ${plugin}.${method}`);
      return Promise.reject(new PreviewNetworkError(`${plugin}.${method}`));
    }
    return promise(plugin, method, options);
  };
  if (typeof cap.nativeCallback === "function") {
    const callback = cap.nativeCallback.bind(cap);
    cap.nativeCallback = (plugin, method, options, cb) => {
      if (pluginDenied(plugin, method)) {
        log.blocked.push(`native ${plugin}.${method}`);
        cb?.(null, new PreviewNetworkError(`${plugin}.${method}`));
        return "";
      }
      return callback(plugin, method, options, cb);
    };
  }
  return true;
}
