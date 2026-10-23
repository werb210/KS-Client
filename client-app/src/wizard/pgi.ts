// KS_CLIENT_v8_PGI - Personal Guarantee Insurance details the client may give on Step 6 (all optional).
import type { PgiDetails } from "../types/application";

export const PGI_PARTNER_NAME = "Boreal Insurance";
export const PGI_LOAN_TYPES = ["Commercial Mortgage", "Other Secured Loan"] as const;

/** Only the details that were filled in, trimmed (empty answers are left out of the submission). */
export function cleanPgiDetails(d: PgiDetails | undefined): PgiDetails | undefined {
  if (!d) return undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(d)) {
    const t = typeof v === "string" ? v.trim() : "";
    if (t) out[k] = t;
  }
  return Object.keys(out).length ? (out as PgiDetails) : undefined;
}
