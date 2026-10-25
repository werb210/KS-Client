// KS_CLIENT_v4_BRANDING - the licensee's name and branding, from the Keystone server (GET /api/licensee).
// KS-Client was copied from BF-client, which wrote "Boreal Financial" into the text. Every Keystone copy belongs to one
// licensee, so the app reads that licensee's details at start-up instead. Until the server answers it uses the last
// value it saw (kept on the device) or the build's VITE_COMPANY_NAME, never Boreal's.
import { useSyncExternalStore } from "react";
import { SERVER_URL } from "./licensee";
import { LICENSEE_BUILD } from "./licenseeBuild";
import { applyBrandTheme } from "./brandTheme";

export type Brand = {
  company_name: string;
  legal_name: string;
  assistant_name: string;
  support_email: string;
  support_phone: string;
  logo_url: string;
  primary_color: string;
  accent_color: string;
  /** KS_CLIENT_v14_BRAND_FONT - "" = the app's own background / font. */
  background_color: string;
  font_family: string;
};

const CACHE_KEY = "ks_brand_v1";
const env = ((import.meta as any).env ?? {}) as Record<string, string | undefined>;

const KEYSTONE_BRAND: Brand = {
  company_name: String(env.VITE_COMPANY_NAME ?? "").trim() || "Keystone",
  legal_name: "",
  assistant_name: "Assistant",
  support_email: "",
  support_phone: "",
  logo_url: "",
  primary_color: "#0B1F3A",
  accent_color: "#2563EB",
  background_color: "",
  font_family: "",
};

// KS_CLIENT_v5_LICENSEE_APPS - a licensee's branded build (VITE_LICENSEE) starts from licensee.json, and keeps those
// values even when the server says otherwise: the app's name, colours and support contact were checked (contrast,
// store listing) for that build, and its web and phone versions must match. The server still fills what the build
// leaves empty (legal name, assistant name, logo).
export function brandFromBuild(build: typeof LICENSEE_BUILD, base: Brand = KEYSTONE_BRAND): { brand: Brand; pinned: Array<keyof Brand> } {
  if (!build) return { brand: { ...base }, pinned: [] };
  const fromBuild: Partial<Brand> = {
    company_name: build.company_name,
    support_email: build.support?.email,
    support_phone: build.support?.phone,
    primary_color: build.colors?.primary,
    accent_color: build.colors?.secondary,
    background_color: build.colors?.background,
    // licensee.json fonts.body is { family, google, weights } (older builds: a plain name).
    font_family: typeof build.fonts?.body === "string" ? build.fonts.body : (build.fonts?.body as { family?: string } | undefined)?.family,
  };
  const out = { ...base };
  const pinned: Array<keyof Brand> = [];
  for (const [k, v] of Object.entries(fromBuild) as Array<[keyof Brand, string | undefined]>) {
    const val = String(v ?? "").trim();
    if (val) { out[k] = val; pinned.push(k); }
  }
  return { brand: out, pinned };
}

const BUILD = brandFromBuild(LICENSEE_BUILD);
export const DEFAULT_BRAND: Brand = BUILD.brand;
const PINNED = new Set<keyof Brand>(BUILD.pinned);

function clean(raw: unknown): Brand {
  const src = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out = { ...DEFAULT_BRAND };
  for (const k of Object.keys(out) as Array<keyof Brand>) {
    const v = String(src[k] ?? "").trim();
    if (v && v.length <= 200) out[k] = v;
  }
  if (!/^https:\/\//i.test(out.logo_url)) out.logo_url = "";
  if (!/^#[0-9a-f]{6}$/i.test(out.primary_color)) out.primary_color = DEFAULT_BRAND.primary_color;
  if (!/^#[0-9a-f]{6}$/i.test(out.accent_color)) out.accent_color = DEFAULT_BRAND.accent_color;
  if (out.background_color && !/^#[0-9a-f]{6}$/i.test(out.background_color)) out.background_color = DEFAULT_BRAND.background_color;
  if (out.font_family && !/^[A-Za-z0-9][A-Za-z0-9 -]{0,59}$/.test(out.font_family)) out.font_family = DEFAULT_BRAND.font_family;
  for (const k of PINNED) out[k] = DEFAULT_BRAND[k];
  return out;
}

function readCache(): Brand {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    return raw ? clean(JSON.parse(raw)) : { ...DEFAULT_BRAND };
  } catch {
    return { ...DEFAULT_BRAND };
  }
}

let cached = false;
try { cached = Boolean(window.localStorage.getItem(CACHE_KEY)); } catch { cached = false; }
let current: Brand = readCache();
try { applyBrandTheme(current); } catch { /* no document */ }
/** True when an earlier visit saved the licensee's details on this device. */
export function hasCachedBrand(): boolean { return cached; }
const listeners = new Set<() => void>();

function set(next: Brand): void {
  current = next;
  try { window.localStorage.setItem(CACHE_KEY, JSON.stringify(next)); } catch { /* private mode */ }
  try { if (typeof document !== "undefined") document.title = next.company_name; } catch { /* no document */ }
  try { applyBrandTheme(next); } catch { /* no document */ }
  listeners.forEach((l) => l());
}

/** The licensee's details as last loaded. */
export function brand(): Brand { return current; }
/** The company name to show, e.g. "Keystone Demo Brokerage". */
export function brandName(): string { return current.company_name; }
/** The legal name for legal text; the company name when none is set. */
export function legalName(): string { return current.legal_name || current.company_name; }
/** "Name (Legal Name)" when the legal name differs, else just the name. */
export function nameWithLegal(): string {
  return current.legal_name && current.legal_name !== current.company_name
    ? `${current.company_name} (${current.legal_name})`
    : current.company_name;
}
export function assistantName(): string { return current.assistant_name; }

/** Fetches the licensee from the server. Never throws; keeps what it had on failure. */
export async function loadBrand(timeoutMs = 2500, fetchImpl: typeof fetch = fetch): Promise<Brand> {
  const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = setTimeout(() => ctrl?.abort(), timeoutMs);
  try {
    const res = await fetchImpl(`${SERVER_URL}/api/licensee`, { signal: ctrl?.signal });
    if (!res.ok) return current;
    const body = await res.json();
    if (!body?.licensee) return current;
    set(clean(body.licensee));
  } catch {
    /* offline or slow - keep the cached or default name */
  } finally {
    clearTimeout(timer);
  }
  return current;
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Re-renders the component when the licensee's details load. */
export function useBrand(): Brand {
  return useSyncExternalStore(subscribe, brand, brand);
}

/** For tests. */
export function __setBrandForTests(b: Partial<Brand>): void { set(clean({ ...current, ...b })); }
