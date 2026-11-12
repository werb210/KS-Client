// KS_CLIENT_v1_LICENSEE - the web addresses of this copy of Keystone.
// KS-Client was copied from BF-client, which wrote Boreal's addresses (server/client/www.boreal.financial) into the
// code. Each Keystone copy sets its own at build time (VITE_API_URL, VITE_CLIENT_APP_URL, VITE_WEBSITE_URL,
// VITE_SUPPORT_EMAIL); when one is missing, the Keystone development copy's address is used - never Boreal's.
// KS_CLIENT_v5_LICENSEE_APPS - a licensee's branded build (VITE_LICENSEE) also carries its support and legal links.
import { LICENSEE_BUILD } from "./licenseeBuild";

const DEV = {
  server: "https://ks-demo-server.azurewebsites.net",
  client: "https://wonderful-island-0b68ae310.5.azurestaticapps.net",
};

const env = ((import.meta as any).env ?? {}) as Record<string, string | undefined>;

const clean = (v: unknown): string => {
  const s = String(v ?? "").trim();
  return /^https?:\/\/[^\s/]+/i.test(s) ? s.replace(/\/+$/, "") : "";
};

// KS_SHARED_APP_BUILD_v1 - one build serves every brokerage. The shared web host answers /ks-config.js (loaded by
// index.html before the app) with this brokerage's addresses; without it, a <code>.app.<domain> address implies
// <code>.api.<domain>. A build's own VITE_* settings come after both (branded native apps, the development copy).
type RuntimeConfig = { code?: string; server_url?: string; portal_url?: string; client_url?: string };

export function runtimeConfig(w: unknown = typeof window === "undefined" ? undefined : window): RuntimeConfig {
  const c = (w as { __KS_CONFIG__?: unknown } | undefined)?.__KS_CONFIG__;
  return c && typeof c === "object" ? (c as RuntimeConfig) : {};
}

export function addressesFromHost(host: string | undefined): { server: string; client: string } | null {
  const m = /^([a-z0-9-]+)\.app\.([a-z0-9.-]+\.[a-z]{2,})$/i.exec(String(host ?? "").toLowerCase());
  return m ? { server: `https://${m[1]}.api.${m[2]}`, client: `https://${m[1]}.app.${m[2]}` } : null;
}

const RT = runtimeConfig();
const FROM_HOST = addressesFromHost(typeof window === "undefined" ? undefined : window.location?.hostname);

export const SERVER_URL: string =
  clean(RT.server_url) || FROM_HOST?.server || clean(env.VITE_API_BASE) || clean(env.VITE_API_BASE_URL) || clean(env.VITE_API_URL) || DEV.server;

export const CLIENT_URL: string = clean(RT.client_url) || FROM_HOST?.client || clean(env.VITE_CLIENT_APP_URL) || DEV.client;

/** The licensee's public website; their client app until they give one. */
export const WEBSITE_URL: string = clean(env.VITE_WEBSITE_URL) || CLIENT_URL;

export const SUPPORT_EMAIL: string =
  LICENSEE_BUILD?.support.email || String(env.VITE_SUPPORT_EMAIL ?? "").trim() || "support@keystonecrm.online";

/** The licensee's support phone, or "" when it has none. */
export const SUPPORT_PHONE: string = LICENSEE_BUILD?.support.phone || "";

/** Privacy policy and terms: the licensee's own pages, else /privacy and /terms on its website. */
export const PRIVACY_URL: string = clean(LICENSEE_BUILD?.legal.privacy_url) ? String(LICENSEE_BUILD?.legal.privacy_url) : `${WEBSITE_URL}/privacy`;
export const TERMS_URL: string = clean(LICENSEE_BUILD?.legal.terms_url) ? String(LICENSEE_BUILD?.legal.terms_url) : `${WEBSITE_URL}/terms`;

/** Host name only, e.g. for links the app opens itself. */
export const hostOf = (url: string): string => url.replace(/^https?:\/\//i, "").replace(/\/.*$/, "");
