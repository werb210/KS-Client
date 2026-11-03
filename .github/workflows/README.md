# Workflows

This directory is intentionally managed by Azure Static Web Apps integration (the development copy's deploy;
brokerages are published to the shared web host - see "Brokerage web deploys" below).

After recreating/re-linking the Static Web App in Azure Portal, Azure should generate an
`azure-static-web-apps-*.yml` workflow here automatically.

Do not add a separate deploy workflow that conflicts with Azure-triggered deployments.

## Upload iOS build (BF_CLIENT_v813_IOS_UPLOAD)

`ios-upload.yml` builds the iPhone/iPad app on a GitHub Mac and uploads it to App Store Connect. It only runs when
started by hand (Actions > Upload iOS build > Run workflow) and needs the repository secrets `ASC_KEY_ID`,
`ASC_ISSUER_ID` and `ASC_KEY_P8` (an App Store Connect API key with the Admin role, from the company account).

## Build licensee apps (KS_CLIENT_v5_LICENSEE_APPS)

`build-licensee-apps.yml` builds each licensee's own branded client app (web, iOS, Android) from `licensees/<key>/`
and uploads it to that licensee's App Store Connect and Google Play accounts. Run it by hand with a licensee key or
`all`. Credentials come from the GitHub Environment named after the licensee key; see `docs/LICENSEE_APPS.md`.

## Build Keystone Preview (KS_CLIENT_PREVIEW_APP_v1)

`build-preview-app.yml` builds "Keystone Preview": the client app offline on sample data, for TestFlight (public link)
and Google Play testing tracks. Run it by hand; pull requests that touch the preview build it unsigned as a check.
Uploads run only when their secrets exist (`ASC_KEY_ID`/`ASC_ISSUER_ID`/`ASC_KEY_P8`, `PREVIEW_ANDROID_*`,
`PREVIEW_PLAY_SERVICE_ACCOUNT_JSON`); see `docs/PREVIEW_APP.md`.

## Brokerage web deploys (KS_SHARED_HOSTING_v1)

`azure-static-web-apps.yml` deploys two kinds of web build after its gates pass on `main`:

- **The development copy** - uploaded to its own Azure Static Web App, unchanged.
- **Each brokerage** in `deploy/licensees.json` (enabled, listing `client`) - built exactly as before (the
  `VITE_*` variables of its GitHub environment `ks-<code>`, including `VITE_LICENSEE` for a branded build), then
  published by `deploy/publish-site.mjs` to the shared web host's storage: blob container `sites`, folder
  `<code>/client/`. Every file gets an explicit content type (hashed `assets/*` cached for a year, everything else
  `no-cache`), `index.html` is uploaded last, and files the previous build left behind are deleted. The secret is
  `KS_SITES_STORAGE_CONNECTION_STRING`. Brokerages no longer have a Static Web App of their own.

The shared web host (`ks-shared-web`, code in KS-Ops `web-host/`) picks the brokerage by host name, serves the files,
falls back to `index.html` for app routes, and applies the headers in the build's `staticwebapp.config.json` (CSP
etc.). It serves files only - no `/api` rewrite and no `/.auth` - so the app calls KS-server at its absolute address
(`client-app/src/config/licensee.ts`).

Check a build locally: `npm run build && node deploy/publish-site.mjs client <code> client-app/dist --dry-run`.
Script tests: `node --test deploy/*.test.mjs`.
