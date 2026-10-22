#!/usr/bin/env node
// KS_CLIENT_v5_LICENSEE_APPS - turns the iOS and Android projects into one licensee's branded client app.
//
//   node scripts/brand-native.mjs <licensee-key> [--skip-assets] [--team-id ABCDE12345]
//   node scripts/brand-native.mjs --reset          put everything back to the default Keystone client
//
// What it writes for <licensee-key> (licensees/<key>/licensee.json):
//   - client-app/capacitor.config.ts       appId, appName
//   - iOS: bundle ids (app, .share, .widget), app group, display names, Info.plist wording, team id, associated
//     domain (applinks:<client web host>), ExportOptions.plist team
//   - Android: applicationId, app_name, widget label, notification titles, App Links host, google-services.json
//     (GOOGLE_SERVICES_JSON env when it matches the package, otherwise a build-only placeholder)
//   - client-app/assets/{icon-only,splash,splash-dark}.png, then @capacitor/assets generates every icon and splash
//     size into the native projects (skipped with --skip-assets)
//   - client-app/.env.production.local     VITE_LICENSEE=<key> + the licensee's server address for the web build
//
// Idempotent: every file is rebuilt from the committed (git HEAD) version, so running it twice, or for licensee B
// after licensee A, gives the same result as one clean run. The committed default (the Keystone client) is never
// edited in git: `--reset` restores the touched files from HEAD and removes the generated ones, leaving a clean tree.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, copyFileSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { REPO_ROOT, buildEnv, loadLicensee, validateLicensee } from "./licensee/lib.mjs";

// The committed (default) identity these rules replace.
export const DEFAULT_IDS = {
  iosBundle: "com.borealfinancial.client",
  iosTeam: "76VAY7UJKJ",
  android: "com.boreal.client",
  appName: "Boreal Financial",
  linkHost: "client.boreal.financial",
};

const IOS = "client-app/ios/App";
const AND = "client-app/android/app";

/** Folders @capacitor/assets writes into; restored and cleaned on --reset. */
export const GENERATED_DIRS = [
  "client-app/assets",
  `${IOS}/App/Assets.xcassets`,
  `${AND}/src/main/res`,
];
export const ENV_FILE = "client-app/.env.production.local";
const GOOGLE_SERVICES = `${AND}/google-services.json`;

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const all = (from, to, opts = {}) => ({ re: new RegExp(esc(from), "g"), to, ...opts });

/** Every text edit, per file. `optional` rules may find nothing; the rest must match or the script stops. */
export function rulesFor(c, teamId) {
  const B = c.ios.bundle_id;
  const A = c.android.application_id;
  const N = c.app_name;
  const host = new URL(c.client_web_url).host;
  const team = teamId ? [all(`DEVELOPMENT_TEAM = ${DEFAULT_IDS.iosTeam};`, `DEVELOPMENT_TEAM = ${teamId};`)] : [];
  const swiftName = all(`"${DEFAULT_IDS.appName}"`, `"${N}"`);
  return {
    "client-app/capacitor.config.ts": [
      { re: /appId: '[^']*'/, to: `appId: '${A}'` },
      { re: /appName: '[^']*'/, to: `appName: '${N}'` },
    ],
    [`${IOS}/App.xcodeproj/project.pbxproj`]: [all(DEFAULT_IDS.iosBundle, B), ...team],
    [`${IOS}/App/App.entitlements`]: [all(DEFAULT_IDS.iosBundle, B), all(`applinks:${DEFAULT_IDS.linkHost}`, `applinks:${host}`)],
    [`${IOS}/ClientWidget/ClientWidget.entitlements`]: [all(DEFAULT_IDS.iosBundle, B)],
    [`${IOS}/BorealShare/BorealShare.entitlements`]: [all(DEFAULT_IDS.iosBundle, B)],
    [`${IOS}/App/AppDelegate.swift`]: [all(DEFAULT_IDS.iosBundle, B), swiftName],
    [`${IOS}/ClientWidget/ClientWidget.swift`]: [all(DEFAULT_IDS.iosBundle, B), swiftName],
    [`${IOS}/BorealShare/ShareViewController.swift`]: [all(DEFAULT_IDS.iosBundle, B), swiftName],
    [`${IOS}/App/Info.plist`]: [
      { re: /(<key>CFBundleDisplayName<\/key>\s*<string>)[^<]*(<\/string>)/, to: (_m, a, b) => a + N + b },
      all(DEFAULT_IDS.iosBundle, B, { optional: true }),
      { re: /<string>Boreal Financial /g, to: `<string>${N} `, optional: true },
      { re: /<string>Boreal /g, to: `<string>${N} `, optional: true },
    ],
    [`${IOS}/BorealShare/Info.plist`]: [{ re: /(<key>CFBundleDisplayName<\/key><string>)[^<]*(<\/string>)/, to: (_m, a, b) => a + N + b }],
    [`${IOS}/ClientWidget/Info.plist`]: [{ re: /(<key>CFBundleDisplayName<\/key><string>)[^<]*(<\/string>)/, to: (_m, a, b) => a + N + b }],
    [`${IOS}/ci/ExportOptions.plist`]: teamId ? [all(`<string>${DEFAULT_IDS.iosTeam}</string>`, `<string>${teamId}</string>`)] : [],
    [`${AND}/build.gradle`]: [all(`applicationId "${DEFAULT_IDS.android}"`, `applicationId "${A}"`)],
    [`${AND}/src/main/res/values/strings.xml`]: [
      { re: /(<string name="app_name">)[^<]*(<\/string>)/, to: (_m, a, b) => a + N + b },
      { re: /(<string name="title_activity_main">)[^<]*(<\/string>)/, to: (_m, a, b) => a + N + b },
    ],
    [`${AND}/src/main/res/layout/client_widget.xml`]: [{ re: /android:text="Boreal"/, to: `android:text="${N}"` }],
    [`${AND}/src/main/AndroidManifest.xml`]: [all(`android:host="${DEFAULT_IDS.linkHost}"`, `android:host="${host}"`, { optional: true })],
    [`${AND}/src/main/java/com/boreal/client/BorealMessagingService.java`]: [all(`"${DEFAULT_IDS.appName}"`, `"${N}"`)],
    [`${AND}/src/main/java/com/boreal/client/ApplicationStatusNotifier.java`]: [all(`"${DEFAULT_IDS.appName}`, `"${N}`)],
  };
}

function git(root, args, opts = {}) {
  return execFileSync("git", args, { cwd: root, stdio: ["ignore", "pipe", "pipe"], ...opts });
}

/** The committed text of a file (so every run starts from the default), or the file on disk outside git. */
function pristine(root, rel) {
  try {
    return git(root, ["show", `HEAD:${rel}`]).toString("utf8");
  } catch {
    return readFileSync(path.join(root, rel), "utf8");
  }
}

export function applyRules(text, rules, rel) {
  let out = text;
  for (const r of rules) {
    const before = out;
    out = out.replace(r.re, r.to);
    if (!r.optional && before === out && !(typeof r.to === "string" && before.includes(r.to))) {
      throw new Error(`${rel}: expected text not found (${r.re}). The native project changed; update scripts/brand-native.mjs.`);
    }
  }
  return out;
}

function placeholderGoogleServices(pkg) {
  return JSON.stringify({
    project_info: { project_number: "000000000000", project_id: "ks-licensee-placeholder", storage_bucket: "ks-licensee-placeholder.appspot.com" },
    client: [{
      client_info: { mobilesdk_app_id: "1:000000000000:android:0000000000000000000000", android_client_info: { package_name: pkg } },
      oauth_client: [],
      api_key: [{ current_key: "AIzaSyKSLICENSEEPLACEHOLDERKEY00000000000" }],
      services: { appinvite_service: { other_platform_oauth_client: [] } },
    }],
    configuration_version: "1",
  }, null, 2) + "\n";
}

/** google-services.json for this package: the GOOGLE_SERVICES_JSON secret (raw or base64) when it is for this app. */
export function googleServicesFor(pkg, secret) {
  const raw = String(secret || "").trim();
  if (raw) {
    let text = raw;
    if (raw[0] !== "{") { try { text = Buffer.from(raw, "base64").toString("utf8").trim(); } catch { text = ""; } }
    try {
      const parsed = JSON.parse(text);
      const names = (parsed.client || []).map((x) => x?.client_info?.android_client_info?.package_name);
      if (names.includes(pkg)) return { json: text + "\n", real: true };
    } catch { /* fall through to the placeholder */ }
  }
  return { json: placeholderGoogleServices(pkg), real: false };
}

export function envFileText(c) {
  const env = buildEnv(c);
  return [
    "# Written by scripts/brand-native.mjs - remove with: node scripts/brand-native.mjs --reset",
    `VITE_LICENSEE=${env.VITE_LICENSEE}`,
    `VITE_API_BASE=${env.VITE_API_BASE}`,
    `VITE_API_BASE_URL=${env.VITE_API_BASE_URL}`,
    `VITE_API_URL=${env.VITE_API_URL}`,
    `VITE_CLIENT_APP_URL=${env.VITE_CLIENT_APP_URL}`,
    `VITE_WEBSITE_URL=${env.VITE_WEBSITE_URL}`,
    `VITE_SUPPORT_EMAIL=${env.VITE_SUPPORT_EMAIL}`,
    "",
  ].join("\n");
}

/**
 * Brands the native projects under `root` for licensee `key`. Returns the list of files written.
 * opts: { root, licenseesDir, teamId, skipAssets, googleServicesJson, log }
 */
export function brandNative(key, opts = {}) {
  const root = opts.root || REPO_ROOT;
  const log = opts.log || ((m) => console.log(m));
  const { config: c, dir } = loadLicensee(key, opts.licenseesDir || path.join(root, "licensees"));
  const errors = validateLicensee(c, { dir, key });
  if (errors.length) throw new Error(`licensees/${key} is not ready:\n  - ${errors.join("\n  - ")}`);
  const teamId = opts.teamId || c.ios.team_id || "";

  const written = [];
  for (const [rel, rules] of Object.entries(rulesFor(c, teamId))) {
    const abs = path.join(root, rel);
    if (!existsSync(abs)) throw new Error(`${rel} is missing`);
    const next = applyRules(pristine(root, rel), rules, rel);
    if (readFileSync(abs, "utf8") !== next) writeFileSync(abs, next);
    written.push(rel);
  }

  const gs = googleServicesFor(c.android.application_id, opts.googleServicesJson ?? process.env.GOOGLE_SERVICES_JSON);
  writeFileSync(path.join(root, GOOGLE_SERVICES), gs.json);
  written.push(GOOGLE_SERVICES);
  if (!gs.real) log(`note: no GOOGLE_SERVICES_JSON for ${c.android.application_id} - Android builds, but push notifications need the licensee's Firebase file.`);

  writeFileSync(path.join(root, ENV_FILE), envFileText(c));
  written.push(ENV_FILE);

  // Icon and splash sources in the place @capacitor/assets reads them from.
  const assetsDir = path.join(root, "client-app", "assets");
  mkdirSync(assetsDir, { recursive: true });
  copyFileSync(path.join(dir, c.assets.icon), path.join(assetsDir, "icon-only.png"));
  copyFileSync(path.join(dir, c.assets.splash), path.join(assetsDir, "splash.png"));
  copyFileSync(path.join(dir, c.assets.splash_dark || c.assets.splash), path.join(assetsDir, "splash-dark.png"));
  written.push("client-app/assets/icon-only.png", "client-app/assets/splash.png", "client-app/assets/splash-dark.png");

  if (!opts.skipAssets) {
    const bg = c.colors.background;
    log("Generating icons and splash screens with @capacitor/assets ...");
    execFileSync("npx", ["--yes", "@capacitor/assets@3.0.5", "generate", "--ios", "--android",
      "--iconBackgroundColor", bg, "--iconBackgroundColorDark", bg,
      "--splashBackgroundColor", bg, "--splashBackgroundColorDark", bg],
    { cwd: path.join(root, "client-app"), stdio: "inherit" });
  }
  log(`Branded the native apps for ${c.app_name} (iOS ${c.ios.bundle_id}, Android ${c.android.application_id}, server ${c.server_url}).`);
  return written;
}

/** Puts every file brandNative touches back to the committed default and removes what it generated. */
export function resetNative(opts = {}) {
  const root = opts.root || REPO_ROOT;
  const tracked = Object.keys(rulesFor({
    ios: { bundle_id: "a.b.c" }, android: { application_id: "a.b.c" }, app_name: "X", client_web_url: "https://x.y",
  }, "")).concat([GOOGLE_SERVICES], GENERATED_DIRS);
  git(root, ["checkout", "HEAD", "--", ...tracked]);
  git(root, ["clean", "-fdq", "--", ...GENERATED_DIRS]);
  rmSync(path.join(root, ENV_FILE), { force: true });
  (opts.log || console.log)("Native projects reset to the default Keystone client.");
}

function main(argv) {
  const args = argv.slice(2);
  const flag = (n) => args.includes(n);
  const value = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
  if (flag("--reset")) return resetNative();
  const key = args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--team-id");
  if (!key || key === "default") {
    console.log("No licensee given: the committed default (Keystone client) is used as is. Nothing to do.");
    return;
  }
  brandNative(key, { teamId: value("--team-id") || process.env.APPLE_TEAM_ID, skipAssets: flag("--skip-assets") });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main(process.argv);
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  }
}
