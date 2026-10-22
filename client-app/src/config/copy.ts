// KS_CLIENT_v5_LICENSEE_APPS - app wording a licensee can change (licensees/<key>/licensee.json "wording").
// Only text that carries the brand goes through here (product-name headings, support contact, legal links); the
// rest of the app keeps its own wording. Keys and Keystone's defaults: copy.defaults.json (the licensee validator
// rejects unknown keys). {name} = the company name, {year}, {support_email}, {support_phone}.
import DEFAULTS from "./copy.defaults.json";
import { brandName, brand } from "./brand";
import { LICENSEE_BUILD } from "./licenseeBuild";
import { SUPPORT_EMAIL } from "./licensee";

export type CopyKey = keyof typeof DEFAULTS;

let overrides: Record<string, string> = { ...(LICENSEE_BUILD?.wording ?? {}) };

export function fill(text: string, vars: Record<string, string>): string {
  return text.replace(/\{([a-z_]+)\}/g, (m, k: string) => (k in vars ? vars[k] ?? "" : m));
}

/** The text for `key`, with the licensee's override when it has one. */
export function t(key: CopyKey, vars: Record<string, string> = {}): string {
  const base = overrides[key] ?? DEFAULTS[key] ?? key;
  return fill(base, {
    name: brandName(),
    year: String(new Date().getFullYear()),
    support_email: SUPPORT_EMAIL,
    support_phone: brand().support_phone || "",
    ...vars,
  });
}

/** For tests. */
export function __setCopyOverridesForTests(next: Record<string, string>): void { overrides = { ...next }; }
