// @vitest-environment node
// KS_CLIENT_v5_LICENSEE_APPS - the licensee validator (scripts/licensee/lib.mjs + validate.mjs).
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
// @ts-expect-error plain .mjs helper
import * as lib from "../../../scripts/licensee/lib.mjs";

const ROOT = path.resolve(__dirname, "../../..");
const DEMO_DIR = path.join(ROOT, "licensees", "keystone-demo");
const demo = () => JSON.parse(readFileSync(path.join(DEMO_DIR, "licensee.json"), "utf8"));

/** A PNG header with the given size (enough for the size check). */
function fakePng(w: number, h: number): Buffer {
  const b = Buffer.alloc(40);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0);
  b.writeUInt32BE(13, 8);
  b.write("IHDR", 12, "ascii");
  b.writeUInt32BE(w, 16);
  b.writeUInt32BE(h, 20);
  b[24] = 8; b[25] = 2;
  return b;
}

function tempLicensee(mut: (c: any) => void = () => {}, files: (dir: string) => void = () => {}) {
  const dir = mkdtempSync(path.join(tmpdir(), "ks-lic-"));
  copyFileSync(path.join(DEMO_DIR, "icon.png"), path.join(dir, "icon.png"));
  copyFileSync(path.join(DEMO_DIR, "splash.png"), path.join(dir, "splash.png"));
  files(dir);
  const c = demo();
  mut(c);
  return { c, dir };
}

describe("licensee validator", () => {
  it("accepts the keystone-demo licensee", () => {
    expect(lib.validateLicensee(demo(), { dir: DEMO_DIR, key: "keystone-demo" })).toEqual([]);
    expect(lib.listLicensees()).toContain("keystone-demo");
  });

  it("computes WCAG contrast ratios", () => {
    expect(lib.contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 1);
    expect(lib.contrastRatio("#FFFFFF", "#FFFFFF")).toBeCloseTo(1, 5);
    expect(lib.contrastRatio("#767676", "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
    expect(lib.contrastRatio("#777777", "#FFFFFF")).toBeLessThan(4.5);
  });

  it("rejects body text below WCAG AA 4.5:1", () => {
    const { c, dir } = tempLicensee((x) => { x.colors.text = "#999999"; });
    const errors = lib.validateLicensee(c, { dir, key: "keystone-demo" });
    expect(errors.join("\n")).toMatch(/text on background is 2\.\d+:1/);
  });

  it("rejects unreadable button text and primary-on-secondary pairs", () => {
    const { c, dir } = tempLicensee((x) => { x.colors.primary = "#7FB3FF"; x.colors.on_primary = "#FFFFFF"; });
    const errors = lib.validateLicensee(c, { dir }).join("\n");
    expect(errors).toMatch(/on_primary \(button text\) on primary/);
    expect(errors).toMatch(/primary \(headings, links\) on background/);
  });

  it("rejects bad ids, unknown fields and missing required fields", () => {
    const { c, dir } = tempLicensee((x) => {
      x.ios.bundle_id = "NotAnId";
      x.android.application_id = "single";
      x.server_url = "http://insecure.example.com";
      x.extra = true;
      delete x.legal;
    });
    const errors = lib.validateLicensee(c, { dir }).join("\n");
    expect(errors).toMatch(/ios\.bundle_id/);
    expect(errors).toMatch(/android\.application_id/);
    expect(errors).toMatch(/server_url/);
    expect(errors).toMatch(/extra: unknown field/);
    expect(errors).toMatch(/legal: required/);
  });

  it("rejects app names the stores or native files cannot take", () => {
    for (const bad of ["Smith & Co", "O'Brien Capital", "A", "This name is far too long for a phone icon label"]) {
      const { c, dir } = tempLicensee((x) => { x.app_name = bad; });
      expect(lib.validateLicensee(c, { dir }).join("\n")).toMatch(/app_name/);
    }
  });

  it("rejects unknown wording keys and placeholders", () => {
    const { c, dir } = tempLicensee((x) => { x.wording = { "no.such.key": "x", "welcome.title": "Hi {customer}" }; });
    const errors = lib.validateLicensee(c, { dir }).join("\n");
    expect(errors).toMatch(/wording\.no\.such\.key: unknown key/);
    expect(errors).toMatch(/\{customer\} is not available/);
  });

  it("checks icon and splash sizes and font files", () => {
    const { c, dir } = tempLicensee((x) => {
      x.assets = { icon: "small.png", splash: "splash.png", splash_dark: "missing.png" };
      x.fonts.body = { family: "Acme Sans", files: [{ file: "fonts/AcmeSans.woff2", weight: 400 }] };
    }, (d) => writeFileSync(path.join(d, "small.png"), fakePng(512, 512)));
    const errors = lib.validateLicensee(c, { dir }).join("\n");
    expect(errors).toMatch(/assets\.icon: small\.png is 512x512; needs 1024x1024/);
    expect(errors).toMatch(/assets\.splash_dark: missing\.png is missing/);
    expect(errors).toMatch(/fonts\.body: fonts\/AcmeSans\.woff2 is missing/);
  });

  it("requires the key to match its folder", () => {
    const { c, dir } = tempLicensee((x) => { x.key = "someone-else"; });
    expect(lib.validateLicensee(c, { dir, key: "keystone-demo" }).join("\n")).toMatch(/must match the folder name/);
  });

  it("builds the web env and Google Fonts link from licensee.json", () => {
    const env = lib.buildEnv(demo());
    expect(env.VITE_LICENSEE).toBe("keystone-demo");
    expect(env.VITE_API_URL).toBe("https://ks-server-dev-chb5htbwaue2hygk.canadacentral-01.azurewebsites.net");
    const runtime = JSON.parse(env.VITE_KS_LICENSEE);
    expect(runtime.company_name).toBe("Keystone Demo Brokerage");
    expect(runtime.colors.on_primary).toBe("#FFFFFF");
    expect(lib.googleFontsHref(demo())).toBe(
      "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Merriweather:wght@400;700&display=swap",
    );
  });

  it("swaps Keystone's colours and fonts for the licensee's", () => {
    const out = lib.swapTheme('a{color:#0B1F3A;box-shadow:0 0 0 2px rgba(11, 31, 58, 0.12);b:#bf9b49;font-family:"Public Sans"}', demo());
    expect(out).toBe('a{color:#1E3A5F;box-shadow:0 0 0 2px rgba(30, 58, 95, 0.12);b:#F2B544;font-family:"Inter"}');
  });

  it("the CLI exits 0 for good licensees and 1 for unknown ones", () => {
    const script = path.join(ROOT, "scripts", "licensee", "validate.mjs");
    expect(execFileSync("node", [script], { encoding: "utf8" })).toMatch(/ok keystone-demo/);
    let code = 0;
    try { execFileSync("node", [script, "no-such-licensee"], { stdio: "pipe" }); } catch (e: any) { code = e.status; }
    expect(code).toBe(1);
  });
});
