// KS_CLIENT_v1_LICENSEE - the web addresses of this copy of Keystone.
// KS-Client was copied from BF-client, which wrote Boreal's addresses (server/client/www.boreal.financial) into the
// code. Each Keystone copy sets its own at build time (VITE_API_URL, VITE_CLIENT_APP_URL, VITE_WEBSITE_URL,
// VITE_SUPPORT_EMAIL); when one is missing, the Keystone development copy's address is used - never Boreal's.
const DEV = {
  server: "https://ks-server-dev-chb5htbwaue2hygk.canadacentral-01.azurewebsites.net",
  client: "https://wonderful-island-0b68ae310.5.azurestaticapps.net",
};

const env = ((import.meta as any).env ?? {}) as Record<string, string | undefined>;

const clean = (v: unknown): string => {
  const s = String(v ?? "").trim();
  return /^https?:\/\/[^\s/]+/i.test(s) ? s.replace(/\/+$/, "") : "";
};

export const SERVER_URL: string =
  clean(env.VITE_API_BASE) || clean(env.VITE_API_BASE_URL) || clean(env.VITE_API_URL) || DEV.server;

export const CLIENT_URL: string = clean(env.VITE_CLIENT_APP_URL) || DEV.client;

/** The licensee's public website; their client app until they give one. */
export const WEBSITE_URL: string = clean(env.VITE_WEBSITE_URL) || CLIENT_URL;

export const SUPPORT_EMAIL: string = String(env.VITE_SUPPORT_EMAIL ?? "").trim() || "keystone@boreal.financial";

/** Host name only, e.g. for links the app opens itself. */
export const hostOf = (url: string): string => url.replace(/^https?:\/\//i, "").replace(/\/.*$/, "");
