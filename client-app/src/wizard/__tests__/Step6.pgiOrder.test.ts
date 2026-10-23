import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe("BF_CLIENT_WIZARD_STEP6_PGI_v61 — Step 6 section order", () => {
  const src = readFileSync(join(__dirname, "../Step6_Review.tsx"), "utf8");



  it("renders sections in canonical order: PGI → T&C → checkboxes → signature → submit (KS_CLIENT_v8_PGI)", () => {
    // BF_CLIENT_BLOCK_v877_STEP6_ORDER_MARKERS_v1 — v721 rewrote T&C into
    // clause popups; the old checkbox-label markers no longer exist. Assert
    // the durable section order: PGI -> Terms heading -> signature -> submit.
    const pgi = src.indexOf("<PgiSection app={app} update={update} />");
    const terms = src.indexOf("Terms & Conditions</h2>");
    const sig = src.indexOf("Typed signature");
    const submit = src.indexOf("Submit Application");
    expect(pgi).toBeGreaterThan(-1);
    expect(pgi).toBeLessThan(terms);
    expect(terms).toBeGreaterThan(-1);
    expect(sig).toBeGreaterThan(-1);
    expect(submit).toBeGreaterThan(-1);
    expect(terms).toBeLessThan(sig);
    expect(sig).toBeLessThan(submit);
  });
});
// BF_CLIENT_WIZARD_STEP6_PGI_v61_TEST_ANCHOR
