// @vitest-environment node
// KS_CLIENT_v5_LICENSEE_APPS - scripts/brand-native.mjs brands a copy of the native projects and resets it cleanly.
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
// @ts-expect-error plain .mjs script
import * as bn from "../../../scripts/brand-native.mjs";

const ROOT = path.resolve(__dirname, "../../..");
const quiet = () => {};
const git = (cwd: string, ...args: string[]) =>
  execFileSync("git", ["-c", "user.name=test", "-c", "user.email=test@example.com", ...args], { cwd, encoding: "utf8" });

/** A small git repo holding every file brand-native touches, committed as the default. */
function fixtureRepo(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "ks-brand-"));
  const files = Object.keys(bn.rulesFor({
    ios: { bundle_id: "a.b.c" }, android: { application_id: "a.b.c" }, app_name: "X", client_web_url: "https://x.y",
  }, "")).concat(["client-app/android/app/google-services.json"], bn.GENERATED_DIRS);
  for (const rel of files) {
    mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    cpSync(path.join(ROOT, rel), path.join(dir, rel), { recursive: true });
  }
  cpSync(path.join(ROOT, "licensees"), path.join(dir, "licensees"), { recursive: true });
  git(dir, "init", "-q");
  git(dir, "add", "-A");
  git(dir, "commit", "-qm", "default");
  return dir;
}

function snapshot(dir: string): string {
  git(dir, "add", "-A");
  return git(dir, "diff", "--cached");
}

const read = (dir: string, rel: string) => readFileSync(path.join(dir, rel), "utf8");

describe("brand-native", () => {
  it("writes the licensee's ids, names, team and server, and is idempotent", () => {
    const dir = fixtureRepo();
    const opts = { root: dir, licenseesDir: path.join(dir, "licensees"), skipAssets: true, googleServicesJson: "", teamId: "ABCDE12345", log: quiet };
    bn.brandNative("keystone-demo", opts);

    const cap = read(dir, "client-app/capacitor.config.ts");
    expect(cap).toContain("appId: 'financial.boreal.keystone.demo'");
    expect(cap).toContain("appName: 'Keystone Demo'");

    const pbx = read(dir, "client-app/ios/App/App.xcodeproj/project.pbxproj");
    expect(pbx).not.toContain("com.borealfinancial.client");
    expect(pbx).toContain("PRODUCT_BUNDLE_IDENTIFIER = financial.boreal.keystone.demo;");
    expect(pbx).toContain("PRODUCT_BUNDLE_IDENTIFIER = financial.boreal.keystone.demo.share;");
    expect(pbx).toContain("PRODUCT_BUNDLE_IDENTIFIER = financial.boreal.keystone.demo.widget;");
    expect(pbx).not.toContain("76VAY7UJKJ");

    const plist = read(dir, "client-app/ios/App/App/Info.plist");
    expect(plist).toMatch(/<key>CFBundleDisplayName<\/key>\s*<string>Keystone Demo<\/string>/);
    expect(plist).not.toMatch(/<string>Boreal/);
    expect(read(dir, "client-app/ios/App/App/App.entitlements")).toContain("group.financial.boreal.keystone.demo");
    expect(read(dir, "client-app/ios/App/App/App.entitlements")).toContain("applinks:wonderful-island-0b68ae310.5.azurestaticapps.net");
    expect(read(dir, "client-app/ios/App/BorealShare/ShareViewController.swift")).toContain('"Keystone Demo"');
    expect(read(dir, "client-app/ios/App/ci/ExportOptions.plist")).toContain("<string>ABCDE12345</string>");

    expect(read(dir, "client-app/android/app/build.gradle")).toContain('applicationId "financial.boreal.keystone.demo"');
    expect(read(dir, "client-app/android/app/src/main/res/values/strings.xml")).toContain('<string name="app_name">Keystone Demo</string>');
    const gs = JSON.parse(read(dir, "client-app/android/app/google-services.json"));
    expect(gs.client[0].client_info.android_client_info.package_name).toBe("financial.boreal.keystone.demo");

    const env = read(dir, bn.ENV_FILE);
    expect(env).toContain("VITE_LICENSEE=keystone-demo");
    expect(env).toContain("VITE_API_URL=https://ks-server-dev-chb5htbwaue2hygk.canadacentral-01.azurewebsites.net");
    expect(readFileSync(path.join(dir, "client-app/assets/icon-only.png")).equals(readFileSync(path.join(dir, "licensees/keystone-demo/icon.png")))).toBe(true);

    const first = snapshot(dir);
    bn.brandNative("keystone-demo", opts);
    expect(snapshot(dir)).toBe(first);
  });

  it("--reset leaves the repo exactly as committed (the default Keystone client)", () => {
    const dir = fixtureRepo();
    bn.brandNative("keystone-demo", { root: dir, licenseesDir: path.join(dir, "licensees"), skipAssets: true, googleServicesJson: "", log: quiet });
    expect(git(dir, "status", "--porcelain")).not.toBe("");
    bn.resetNative({ root: dir, log: quiet });
    expect(git(dir, "status", "--porcelain")).toBe("");
    expect(existsSync(path.join(dir, bn.ENV_FILE))).toBe(false);
    expect(read(dir, "client-app/android/app/build.gradle")).toContain('applicationId "com.boreal.client"');
  });

  it("uses GOOGLE_SERVICES_JSON only when it is for this app", () => {
    const real = JSON.stringify({ client: [{ client_info: { android_client_info: { package_name: "com.acme.client" } } }] });
    expect(bn.googleServicesFor("com.acme.client", real).real).toBe(true);
    expect(bn.googleServicesFor("com.acme.client", Buffer.from(real).toString("base64")).real).toBe(true);
    expect(bn.googleServicesFor("com.other.client", real).real).toBe(false);
    expect(bn.googleServicesFor("com.acme.client", "").real).toBe(false);
  });

  it("stops when the native project no longer has the text it replaces", () => {
    expect(() => bn.applyRules("nothing here", [{ re: /applicationId "com\.boreal\.client"/g, to: 'applicationId "x.y.z"' }], "build.gradle"))
      .toThrow(/expected text not found/);
  });

  it("refuses a licensee that fails validation", () => {
    const dir = fixtureRepo();
    const lic = path.join(dir, "licensees", "keystone-demo", "licensee.json");
    const c = JSON.parse(readFileSync(lic, "utf8"));
    c.colors.text = "#AAAAAA";
    writeFileSync(lic, JSON.stringify(c));
    expect(() => bn.brandNative("keystone-demo", { root: dir, licenseesDir: path.join(dir, "licensees"), skipAssets: true, log: quiet }))
      .toThrow(/not ready/);
  });
});
