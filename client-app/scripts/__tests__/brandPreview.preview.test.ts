// @vitest-environment node
// KS_CLIENT_PREVIEW_APP_v1 - scripts/preview/brand-preview.mjs makes the native projects the offline Keystone Preview app.
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
// @ts-expect-error plain .mjs script
import * as bn from "../../../scripts/brand-native.mjs";
// @ts-expect-error plain .mjs script
import * as bp from "../../../scripts/preview/brand-preview.mjs";
// @ts-expect-error plain .mjs script
import { listLicensees } from "../../../scripts/licensee/lib.mjs";

const ROOT = path.resolve(__dirname, "../../..");
const quiet = () => {};
const git = (cwd: string, ...args: string[]) =>
  execFileSync("git", ["-c", "user.name=test", "-c", "user.email=test@example.com", ...args], { cwd, encoding: "utf8" });

function fixtureRepo(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "ks-preview-"));
  const files = Object.keys(bn.rulesFor({
    ios: { bundle_id: "a.b.c" }, android: { application_id: "a.b.c" }, app_name: "X", client_web_url: "https://x.y",
  }, "")).concat(["client-app/android/app/google-services.json"], bn.GENERATED_DIRS);
  for (const rel of files) {
    mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    cpSync(path.join(ROOT, rel), path.join(dir, rel), { recursive: true });
  }
  cpSync(path.join(ROOT, "licensees"), path.join(dir, "licensees"), { recursive: true });
  cpSync(path.join(ROOT, "preview"), path.join(dir, "preview"), { recursive: true });
  git(dir, "init", "-q");
  git(dir, "add", "-A");
  git(dir, "commit", "-qm", "default");
  return dir;
}

const read = (dir: string, rel: string) => readFileSync(path.join(dir, rel), "utf8");

describe("brand-preview", () => {
  it("brands the apps as Keystone Preview, offline, with no outside link or start-up call", () => {
    const dir = fixtureRepo();
    const opts = { root: dir, skipAssets: true, log: quiet };
    bp.brandPreview(opts);

    expect(read(dir, "client-app/capacitor.config.ts")).toContain("appId: 'financial.boreal.keystone.preview'");
    expect(read(dir, "client-app/capacitor.config.ts")).toContain("appName: 'Keystone Preview'");
    expect(read(dir, "client-app/ios/App/App.xcodeproj/project.pbxproj")).toContain("PRODUCT_BUNDLE_IDENTIFIER = financial.boreal.keystone.preview;");
    expect(read(dir, "client-app/ios/App/App/Info.plist")).toMatch(/<key>CFBundleDisplayName<\/key>\s*<string>Keystone Preview<\/string>/);
    expect(read(dir, "client-app/android/app/build.gradle")).toContain('applicationId "financial.boreal.keystone.preview"');

    const env = read(dir, bn.ENV_FILE);
    expect(env).toContain("VITE_KS_PREVIEW=1");
    expect(env).not.toContain("VITE_LICENSEE");
    expect(env).toContain("VITE_API_URL=https://preview.keystone.invalid");
    expect(env).not.toMatch(/azurewebsites|azurestaticapps/);

    const ent = read(dir, "client-app/ios/App/App/App.entitlements");
    expect(ent).not.toContain("associated-domains");
    expect(ent).toContain("group.financial.boreal.keystone.preview");
    const manifest = read(dir, "client-app/android/app/src/main/AndroidManifest.xml");
    expect(manifest).not.toContain('android:autoVerify="true"');
    expect(manifest).toContain('android:name="firebase_messaging_auto_init_enabled" android:value="false"');
    expect(readFileSync(path.join(dir, "client-app/assets/icon-only.png")).equals(readFileSync(path.join(ROOT, "preview/keystone-preview/icon.png")))).toBe(true);

    git(dir, "add", "-A");
    const first = git(dir, "diff", "--cached");
    bp.brandPreview(opts);
    git(dir, "add", "-A");
    expect(git(dir, "diff", "--cached")).toBe(first);

    git(dir, "reset", "-q"); // unstage the snapshots above; --reset works on the working tree
    bn.resetNative({ root: dir, log: quiet });
    expect(git(dir, "status", "--porcelain")).toBe("");
    expect(existsSync(path.join(dir, bn.ENV_FILE))).toBe(false);
  });

  it("is not a licensee: the licensee builds and deploys never pick it up", () => {
    expect(listLicensees()).not.toContain("keystone-preview");
  });
});
