import "./bootStorageSafe"; // BF_CLIENT_BLOCK_v867_STORAGE_SHIM — must be first
// KS_CLIENT_v11_LIVE_DEMO - second: on /tour, storage goes in memory and fetch to the sample server before any app
// module reads either (the application store reads storage as it loads).
import { LIVE_DEMO } from "./liveDemo/early";
// KS_CLIENT_PREVIEW_APP_v1 - third: the Keystone Preview build locks the network before any app module loads.
import { PREVIEW } from "./preview/early";
import { hydrateApplicationToken } from "@/auth/applicationToken";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import RouteTracker from "./components/RouteTracker";
import ConsentBanner from "./components/ConsentBanner";
// BF_CLIENT_BLOCK_v103_TAILWIND_PIPELINE_FIX_v1
// theme/global.css carries @tailwind base/components/utilities and the
// Boreal CSS variables. styles/global.css is the legacy reset-only file
// kept for the 13 lines of body/box-sizing rules. Both are imported.
import "./theme/global.css";
import "./styles/global.css";
import App from "./App";
import { captureAttribution } from "./lib/attribution";
import { initClarity } from "./lib/clarity"; // BF_CLIENT_CLARITY_LOADER_v163
import { loadGoogleTags } from "./lib/thirdPartyTags"; // BF_CLIENT_v789_ANALYTICS_GATES
import { startJourney } from "./lib/journey"; // BF_CLIENT_JOURNEY_BOOT_v185
import { initClientBehaviour } from "./lib/clientBehaviour"; // BF_CLIENT_BEHAVIOUR_v707
import { validateEnv } from "./env";
import { registerClientSW } from "./pwa/registerSW";
import { startPendingSubmitWatcher } from "./state/pendingSubmit";
// BF_UPLOAD_QUEUE_v51 — V1 upload-later retry queue
import { startUploadQueueWatcher } from "./state/uploadQueueWatcher";
// BF_CLIENT_BLOCK_v76_FORM_RESPONSE_QUEUE_AND_LP_CACHE_v1
import { startFormResponseQueueWatcher } from "./state/formResponseQueueWatcher";
import { validateBootToken } from "./state/validateBootToken";
import { hydrateToken } from "./auth/token";
import { startBorealRuntime } from "./native/borealRuntime";
import { hasCachedBrand, loadBrand } from "./config/brand"; // KS_CLIENT_v4_BRANDING

try {
  validateEnv();
} catch (err) {
  console.error("ENV ERROR IGNORED:", err);
}

// KS_CLIENT_v7_DEMO - /demo/<code> (and /d/<code>) is the self-serve demo's borrower page: it boots on its own, with
// no analytics, journey tracking, sign-in or service worker.
const IS_DEMO_BORROWER = !PREVIEW && !LIVE_DEMO && /^\/(?:demo|d)\//.test(window.location.pathname);

// BF_CLIENT_v789_ANALYTICS_GATES - Consent Mode defaults, GTM and the Google Ads
// tag, web only. Runs before anything can push to dataLayer.
if (!PREVIEW && !IS_DEMO_BORROWER && !LIVE_DEMO) loadGoogleTags();

// BF_CLIENT_JOURNEY_BOOT_v185 - ORDER MATTERS. startJourney mints and persists the
// journey session id and creates the server-side visitor_sessions row. It must run
// first so captureAttribution finds the id and forwards it to the server at start.
async function boot() {
try {
  await hydrateToken().then(() => hydrateApplicationToken());
} catch (error) {
  console.error(
    "Native credential hydration failed; continuing unauthenticated",
    error
  );
}
startJourney();
initClientBehaviour(); // BF_CLIENT_BEHAVIOUR_v707
captureAttribution(); // BF_CLIENT_BLOCK_v_ATTRIBUTION_v1 - first-touch, before render
// BF_CLIENT_CLARITY_LOADER_v163 / BF_CLIENT_v789_ANALYTICS_GATES - starts only
// when analytics were already accepted; ConsentBanner starts it on Accept.
initClarity();

// BF_LOCAL_FIRST_v35 — auto-retry pending submits on online/interval/boot.
startPendingSubmitWatcher();
// BF_UPLOAD_QUEUE_v51
startUploadQueueWatcher();
// BF_CLIENT_BLOCK_v76_FORM_RESPONSE_QUEUE_AND_LP_CACHE_v1
startFormResponseQueueWatcher();

// v131-bootstrap — start native push and durable uploads once authentication is hydrated.
void startBorealRuntime({
  navigate: (route) => window.location.assign(route),
});

void validateBootToken();

// KS_CLIENT_v4_BRANDING - the licensee's name before the first screen. First visit: wait for it (2.5s at most);
// later visits use the name saved on the device and refresh it in the background.
if (hasCachedBrand()) void loadBrand(); else await loadBrand();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <RouteTracker />
      <ConsentBanner />
      <App />
    </BrowserRouter>
  </React.StrictMode>
);

registerClientSW();
}

// KS_CLIENT_v11_LIVE_DEMO - /tour is the live demo (checked before the older /demo/<code> borrower page).
// KS_CLIENT_PREVIEW_APP_v1 - the Keystone Preview app runs only the preview (sample data, no network).
if (PREVIEW) void import("./preview/bootPreview").then((m) => m.bootPreview());
else if (LIVE_DEMO) void import("./liveDemo/bootLiveDemo").then((m) => m.bootLiveDemo());
else if (IS_DEMO_BORROWER) void import("./demo/bootDemo").then((m) => m.bootDemo());
else void boot();
