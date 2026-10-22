// KS_CLIENT_v5_LICENSEE_APPS - the licensee this build was made for (VITE_LICENSEE=<key>).
// The Vite config reads licensees/<key>/licensee.json and passes the public part here as VITE_KS_LICENSEE, so the
// web build and the iOS/Android apps of one licensee show the same name, colours, wording and links. A build
// without VITE_LICENSEE is the default Keystone client and this returns null.
export type LicenseeBuild = {
  key: string;
  app_name: string;
  company_name: string;
  colors: { primary: string; secondary: string; background: string; text: string; on_primary: string };
  fonts: { body: string; heading: string };
  wording: Record<string, string>;
  support: { email: string; phone: string };
  legal: { privacy_url: string; terms_url: string };
  ios_bundle_id: string;
  android_application_id: string;
};

export function parseLicenseeBuild(raw: unknown): LicenseeBuild | null {
  if (!raw) return null;
  try {
    const v = (typeof raw === "string" ? JSON.parse(raw) : raw) as LicenseeBuild;
    if (!v || typeof v !== "object" || typeof v.key !== "string" || !v.key) return null;
    return {
      ...v,
      wording: v.wording && typeof v.wording === "object" ? v.wording : {},
      support: { email: String(v.support?.email ?? ""), phone: String(v.support?.phone ?? "") },
      legal: { privacy_url: String(v.legal?.privacy_url ?? ""), terms_url: String(v.legal?.terms_url ?? "") },
    };
  } catch {
    return null;
  }
}

const env = ((import.meta as any).env ?? {}) as Record<string, string | undefined>;

/** This build's licensee, or null for the default Keystone client. */
export const LICENSEE_BUILD: LicenseeBuild | null = parseLicenseeBuild(env.VITE_KS_LICENSEE);
