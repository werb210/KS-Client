// KS_CLIENT_LANGUAGES_v1 - the client app in English, French and Spanish.
// Every piece of text the client reads goes through t("English text"). The French and Spanish dictionaries are keyed by
// that English text (fr.ts, es.ts); anything missing falls back to English, so a new screen is never blank.
// The language is chosen on the welcome screen or in Settings, saved on this device (and on the client's profile by
// the server), and limited to the languages the brokerage offers (GET /api/licensee: client_languages).
// Changing language reloads the app once, so every screen redraws in the new language.
import { FR } from "./fr";
import { ES } from "./es";

export type Lang = "en" | "fr" | "es";
export const LANGS: readonly Lang[] = ["en", "fr", "es"];
export const LANG_NAMES: Record<Lang, string> = { en: "English", fr: "Français", es: "Español" };
const DICTS: Record<Lang, Record<string, string>> = { en: {}, fr: FR, es: ES };
const STORE_KEY = "ks_client_lang";

function readStored(): Lang | null {
  try {
    const v = globalThis.localStorage?.getItem(STORE_KEY);
    return v && (LANGS as readonly string[]).includes(v) ? (v as Lang) : null;
  } catch { return null; }
}

let current: Lang = readStored() ?? "en";

export function lang(): Lang { return current; }

/** The device's language when it is one we have, else null. */
export function deviceLang(nav: { languages?: readonly string[]; language?: string } | undefined = globalThis.navigator): Lang | null {
  const list = [...(nav?.languages ?? []), nav?.language ?? ""];
  for (const l of list) {
    const p = String(l).toLowerCase().slice(0, 2);
    if ((LANGS as readonly string[]).includes(p)) return p as Lang;
  }
  return null;
}

/** Translates English text; {name} placeholders are filled from vars. */
export function t(text: string, vars?: Record<string, string | number | null | undefined>): string {
  const out = (current === "en" ? text : DICTS[current][text] ?? text);
  if (!vars) return out;
  return out.replace(/\{(\w+)\}/g, (m, k: string) => (vars[k] === undefined || vars[k] === null ? m : String(vars[k])));
}

/** For tests and the first render: set without saving or reloading. */
export function setLangForTest(l: Lang): void { current = l; }

/** Saves the choice; reloads the app when it changes (so every screen redraws). */
export function chooseLang(l: Lang, opts: { reload?: boolean } = {}): void {
  try { globalThis.localStorage?.setItem(STORE_KEY, l); } catch { /* private mode: this visit only */ }
  const changed = l !== current;
  current = l;
  try { document.documentElement.lang = l === "fr" ? "fr-CA" : l === "es" ? "es" : "en-CA"; } catch { /* no document in tests */ }
  if (changed && opts.reload !== false) { try { globalThis.location?.reload(); } catch { /* tests */ } }
}

export function hasChosenLang(): boolean { return readStored() !== null; }

/** The languages the brokerage offers (English is always first). */
export function offeredLangs(raw: unknown): Lang[] {
  const list = (Array.isArray(raw) ? raw : typeof raw === "string" ? raw.split(",") : [])
    .map((x) => String(x).trim().toLowerCase()).filter((x): x is Lang => (LANGS as readonly string[]).includes(x));
  return ["en", ...LANGS.filter((l) => l !== "en" && list.includes(l))];
}

/**
 * Once the brokerage's languages are known: a saved choice the brokerage no longer offers falls back to English, and
 * a first visit on a French or Spanish phone starts in that language when offered. Returns the language to use.
 */
export function settleLang(offered: Lang[], opts: { reload?: boolean } = {}): Lang {
  const stored = readStored();
  if (stored && !offered.includes(stored)) { chooseLang("en", opts); return "en"; }
  if (!stored) {
    const d = deviceLang();
    if (d && d !== "en" && offered.includes(d)) { chooseLang(d, opts); return d; }
  }
  return current;
}

/** Numbers, money and dates in the client's language (Canadian formats for English and French). */
export function locale(): string { return current === "fr" ? "fr-CA" : current === "es" ? "es-US" : "en-CA"; }

/**
 * Adds X-Client-Language to requests to the brokerage's server (only when French or Spanish is in use), so the
 * server sends sign-in codes and records consent in the client's language. Other sites never get the header.
 */
export function installLanguageHeader(serverBase: string, w: { fetch?: typeof fetch } = globalThis as any): void {
  if (!w.fetch || (w.fetch as any).__ksLang) return;
  let origin = "";
  try { origin = new URL(serverBase, "https://localhost").origin; } catch { return; }
  const original = w.fetch.bind(w);
  const wrapped = ((input: RequestInfo | URL, init?: RequestInit) => {
    if (current === "en") return original(input, init);
    let url = "";
    try { url = typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url; } catch { url = ""; }
    let same = false;
    try { same = new URL(url, globalThis.location?.href ?? "https://localhost").origin === origin; } catch { same = false; }
    if (!same) return original(input, init);
    const headers = new Headers(init?.headers ?? (typeof input !== "string" && !(input instanceof URL) ? (input as Request).headers : undefined));
    if (!headers.has("X-Client-Language")) headers.set("X-Client-Language", current);
    return original(input, { ...init, headers });
  }) as typeof fetch;
  (wrapped as any).__ksLang = true;
  w.fetch = wrapped;
}
