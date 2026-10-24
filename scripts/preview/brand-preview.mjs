#!/usr/bin/env node
// KS_CLIENT_PREVIEW_APP_v1 - turns the iOS and Android projects into the "Keystone Preview" app: the client app on
// sample data, fully offline, for licensees and prospects to tap through (TestFlight and Google Play testing tracks).
//
//   node scripts/preview/brand-preview.mjs [--skip-assets] [--team-id ABCDE12345]
//   node scripts/brand-native.mjs --reset          puts everything back to the default Keystone client
//
// It reuses scripts/brand-native.mjs with preview/keystone-preview/licensee.json (bundle id
// financial.boreal.keystone.preview, name "Keystone Preview", its own icon and splash), then:
//   - writes client-app/.env.production.local with VITE_KS_PREVIEW=1 (the app boots the preview and locks the
//     network, see client-app/src/preview) and an unreachable .invalid server address instead of a real one
//   - iOS: removes the Associated Domains entitlement (no universal links, so iOS never fetches a site file for it)
//   - Android: removes the verified App Links filter (Android would fetch assetlinks.json) and turns off Firebase
//     Messaging's automatic token fetch and Analytics collection, so nothing contacts Google at start-up
// Like brand-native, every file is rebuilt from the committed version, so running it twice gives the same result.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ENV_FILE, brandNative } from "../brand-native.mjs";
import { REPO_ROOT, loadLicensee } from "../licensee/lib.mjs";

export const PREVIEW_KEY = "keystone-preview";
export const PREVIEW_DIR = "preview";
export const PREVIEW_SERVER = "https://preview.keystone.invalid";
const ENTITLEMENTS = "client-app/ios/App/App/App.entitlements";
const MANIFEST = "client-app/android/app/src/main/AndroidManifest.xml";

export function previewEnvText(c) {
  return [
    "# Written by scripts/preview/brand-preview.mjs - remove with: node scripts/brand-native.mjs --reset",
    "VITE_KS_PREVIEW=1",
    // Never contacted: the preview answers every /api call on the device. .invalid can never resolve (RFC 2606).
    `VITE_API_BASE=${PREVIEW_SERVER}`,
    `VITE_API_BASE_URL=${PREVIEW_SERVER}`,
    `VITE_API_URL=${PREVIEW_SERVER}`,
    `VITE_CLIENT_APP_URL=${PREVIEW_SERVER}`,
    `VITE_WEBSITE_URL=${PREVIEW_SERVER}`,
    `VITE_SUPPORT_EMAIL=${c.support.email}`,
    "",
  ].join("\n");
}

/** App.entitlements without the Associated Domains key. */
export function previewEntitlements(text) {
  const out = text.replace(/\s*<key>com\.apple\.developer\.associated-domains<\/key>\s*<array>[\s\S]*?<\/array>/, "");
  if (out.includes("associated-domains")) throw new Error(`${ENTITLEMENTS}: could not remove Associated Domains`);
  return out;
}

const FIREBASE_OFF =
  '\n        <!-- KS_CLIENT_PREVIEW_APP_v1 - the preview never contacts Firebase. -->' +
  '\n        <meta-data android:name="firebase_messaging_auto_init_enabled" android:value="false" />' +
  '\n        <meta-data android:name="firebase_analytics_collection_deactivated" android:value="true" />';

/** AndroidManifest.xml without the verified App Links filter, and with Firebase's start-up calls off. */
export function previewManifest(text) {
  let out = text.replace(/\s*<intent-filter android:autoVerify="true">[\s\S]*?<\/intent-filter>/, "");
  if (out.includes('android:autoVerify="true"')) throw new Error(`${MANIFEST}: could not remove the App Links filter`);
  if (!out.includes("firebase_messaging_auto_init_enabled")) {
    const at = out.search(/<application\b[^>]*>/);
    if (at < 0) throw new Error(`${MANIFEST}: no <application> element`);
    const end = out.indexOf(">", at) + 1;
    out = out.slice(0, end) + FIREBASE_OFF + out.slice(end);
  }
  return out;
}

/** Brands the native projects under `root` as Keystone Preview. Returns the files written. */
export function brandPreview(opts = {}) {
  const root = opts.root || REPO_ROOT;
  const log = opts.log || ((m) => console.log(m));
  const dir = opts.previewDir || path.join(root, PREVIEW_DIR);
  const written = brandNative(PREVIEW_KEY, { ...opts, root, licenseesDir: dir, log, googleServicesJson: "" });
  const { config } = loadLicensee(PREVIEW_KEY, dir);
  writeFileSync(path.join(root, ENV_FILE), previewEnvText(config));
  for (const [rel, fn] of [[ENTITLEMENTS, previewEntitlements], [MANIFEST, previewManifest]]) {
    const abs = path.join(root, rel);
    writeFileSync(abs, fn(readFileSync(abs, "utf8")));
  }
  log(`Keystone Preview: offline build (VITE_KS_PREVIEW=1), iOS ${config.ios.bundle_id}, Android ${config.android.application_id}.`);
  return written;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const value = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
  try {
    brandPreview({ teamId: value("--team-id") || process.env.APPLE_TEAM_ID, skipAssets: args.includes("--skip-assets") });
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  }
}
