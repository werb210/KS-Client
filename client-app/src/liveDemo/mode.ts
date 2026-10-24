// KS_CLIENT_v11_LIVE_DEMO - when the client app runs as the live demo, and how it talks to the page around it.
//
// The Keystone portal's /demo page shows this app in a phone frame: {CLIENT}/tour?embed=1&parent=<portal origin>.
// /tour runs the REAL client app (same components, CSS and routes) with an in-browser stand-in for the server and a
// guided tour on top. The portal origin arrives in the `parent` query parameter; messages go to that origin only, and
// only when it is one of the Keystone portal's own addresses.

export const LIVE_DEMO_TAG = "ks-live-demo";

/** The Keystone portal (KS-Portal) the demo hands over to. */
export const DEFAULT_PORTAL_ORIGIN = "https://thankful-wave-04964490f.2.azurestaticapps.net";

/** /tour and anything under it. */
export function isLiveDemoPath(pathname: string | null | undefined): boolean {
  return /^\/tour(?:\/|$)/.test(String(pathname ?? ""));
}

const env = ((import.meta as { env?: Record<string, unknown> }).env ?? {}) as Record<string, unknown>;

function originOf(raw: unknown): string | null {
  try {
    const u = new URL(String(raw ?? "").trim());
    return u.protocol === "https:" || u.protocol === "http:" ? u.origin : null;
  } catch {
    return null;
  }
}

/** Origins the demo may hand over to: the Keystone portal, plus a build-time portal address and local development. */
export function allowedParentOrigins(): string[] {
  const out = new Set<string>([DEFAULT_PORTAL_ORIGIN]);
  for (const key of ["VITE_KS_PORTAL_URL", "VITE_PORTAL_URL"]) {
    const o = originOf(env[key]);
    if (o) out.add(o);
  }
  return [...out];
}

function isLocalDev(origin: string): boolean {
  return /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

/**
 * The parent origin from `?parent=`, or null when it is missing, malformed, not an exact origin, or not one of the
 * portal's addresses. http is accepted only for localhost (development).
 */
export function parentOriginFrom(search: string, allowed: string[] = allowedParentOrigins()): string | null {
  let raw: string | null = null;
  try {
    raw = new URLSearchParams(search).get("parent");
  } catch {
    return null;
  }
  if (!raw) return null;
  const origin = originOf(raw);
  if (!origin) return null;
  // Only a bare origin is accepted ("https://host[:port]"), never a page address.
  if (raw.replace(/\/+$/, "") !== origin) return null;
  if (origin.startsWith("http:") && !isLocalDev(origin)) return null;
  if (allowed.includes(origin) || isLocalDev(origin)) return origin;
  return null;
}

/** Shown inside the portal's phone frame (an iframe with ?embed=1), rather than opened on its own. */
export function isEmbedded(search: string, win: Window = window): boolean {
  let embed = false;
  try {
    embed = new URLSearchParams(search).get("embed") === "1";
  } catch {
    embed = false;
  }
  let framed = false;
  try {
    framed = win.parent !== win;
  } catch {
    framed = true;
  }
  return embed && framed;
}

export type LiveDemoMessage =
  | {
      type: typeof LIVE_DEMO_TAG; event: "step"; step: string; title: string; text: string;
      // KS_CLIENT_v11_LIVE_DEMO side panel: what the portal's panel needs to draw the buttons itself.
      number?: number; total?: number; canBack?: boolean; final?: boolean; busy?: boolean;
    }
  | { type: typeof LIVE_DEMO_TAG; event: "client-done" };

/** Commands the portal's side panel sends into the frame (only from the parent origin). */
export type LiveDemoCommand = { type: typeof LIVE_DEMO_TAG; command: "next" | "back" | "broker" };

/**
 * KS_CLIENT_v11_LIVE_DEMO - ?panel=1: the portal shows the pop-up text and the Next/Back buttons in its side panel, so
 * the phone screen shows only the app (with the spotlight) and nothing covers the questions. Only when embedded.
 */
export function usesSidePanel(search: string, embedded: boolean): boolean {
  if (!embedded) return false;
  try {
    return new URLSearchParams(search).get("panel") === "1";
  } catch {
    return false;
  }
}

/**
 * KS_CLIENT_v12_PRESENTER - ?present=1: the staff "presenter mode" demo. The same app on the same sample data, with no
 * tour at all (no spotlight, no pop-ups, no messages to the parent): a salesperson taps through it live. Only when
 * embedded in the Keystone portal's presenter page.
 */
export function usesPresenterMode(search: string, embedded: boolean): boolean {
  if (!embedded) return false;
  try {
    return new URLSearchParams(search).get("present") === "1";
  } catch {
    return false;
  }
}

/** A command from the parent, or null (wrong origin, wrong shape). */
export function commandFrom(ev: { origin: string; data: unknown }, parentOrigin: string | null): LiveDemoCommand["command"] | null {
  if (!parentOrigin || ev.origin !== parentOrigin) return null;
  const d = ev.data as Partial<LiveDemoCommand> | null;
  if (!d || typeof d !== "object" || d.type !== LIVE_DEMO_TAG) return null;
  return d.command === "next" || d.command === "back" || d.command === "broker" ? d.command : null;
}

/** Sends a message to the portal around the demo. Does nothing unless embedded with a valid parent origin. */
export function postToParent(message: LiveDemoMessage, ctx: { origin: string | null; embedded: boolean; win?: Window }): boolean {
  const win = ctx.win ?? window;
  if (!ctx.embedded || !ctx.origin) return false;
  try {
    win.parent.postMessage(message, ctx.origin);
    return true;
  } catch {
    return false;
  }
}

/** Where "Show me the broker side" goes when the demo is open on its own (not in the portal's frame). */
export function brokerSideUrl(origin: string | null): string {
  return `${origin ?? DEFAULT_PORTAL_ORIGIN}/demo?broker=1`;
}
