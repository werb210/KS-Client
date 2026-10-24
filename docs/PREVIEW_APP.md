# Keystone Preview app (iOS and Android)

"Keystone Preview" is the Keystone client app running entirely on the phone with sample data. Licensees and prospects
can tap through the whole client experience:

- the 6-step application wizard (starts filled in with a sample file)
- documents
- the client mini-portal after submitting, with Home, Chat, More and Settings
- the loan calculator on the More tab

A small "Preview - sample data only" label stays at the top of the screen. "Start again" resets the sample.

**The app sends nothing to any server.** Every `/api` call is answered on the device by the live demo's sample
server. Every other request is refused inside the app: fetch, XMLHttpRequest, WebSocket, EventSource, beacons, and
the native push, widget, Live Activity and background-upload calls. The page's Content-Security-Policy allows only
the app's own files. Push auto-start, Firebase and universal/App Links are switched off. The test
`client-app/src/preview/__tests__/preview.offline.test.tsx` taps through the wizard, the portal and the calculator,
and fails if a single request leaves the app.

Apple usually rejects demo-only apps from the public App Store (guideline 4.2 / 2.1). So the plan is:

- **iPhone:** a TestFlight public link. It is never submitted for App Store review.
- **Android:** a Google Play testing track (internal testing first, then open testing for a public link).

| | |
| --- | --- |
| App name | Keystone Preview |
| iOS bundle id | `financial.boreal.keystone.preview` (plus `.share` and `.widget`; App Group `group.financial.boreal.keystone.preview`) |
| Android application id | `financial.boreal.keystone.preview` |
| Apple team | the company account, 2630108 Alberta Ltd (`76VAY7UJKJ`), the same team as "Upload iOS build" |
| Config | `preview/keystone-preview/` (licensee.json, icon.png, splash.png). This is not under `licensees/`, so licensee builds and deploys never pick it up. |
| Build | GitHub > Actions > **Build Keystone Preview** > Run workflow |

## What Todd sets up (once)

### 1. Apple (company Apple Developer account)

1. **Certificates, Identifiers & Profiles > Identifiers.** Register these App IDs (explicit, not wildcard):
   - `financial.boreal.keystone.preview`, with **App Groups** and **Push Notifications** turned on (the shared
     native project has them; the preview never uses push)
   - `financial.boreal.keystone.preview.share`, with App Groups
   - `financial.boreal.keystone.preview.widget`, with App Groups

   Register the App Group `group.financial.boreal.keystone.preview` and add it to all three.

   The App Store Connect API key below has the Admin role, so automatic signing can create these on the first run
   if you skip this step. Registering them by hand avoids a first-run failure. Do **not** turn on Associated Domains:
   the preview has none.
2. **App Store Connect > Apps > + New App.**
   - Platform iOS
   - Name **Keystone Preview** (if the name is taken, use "Keystone Preview App"; the name under the icon stays
     "Keystone Preview")
   - Bundle id `financial.boreal.keystone.preview`
   - SKU `keystone-preview`
   - Primary language English (Canada)
3. **Secrets.** The workflow uses the same repository secrets as "Upload iOS build": `ASC_KEY_ID`, `ASC_ISSUER_ID`
   and `ASC_KEY_P8`. They are already set if that workflow works. Nothing new is needed.
4. **TestFlight, after the first build is uploaded** (10 to 30 minutes after the run finishes):
   1. Fill in **Test Information**:
      - Beta app description, e.g. "Try the Keystone client app on sample data. Nothing you type leaves your phone."
      - Feedback email
      - Contact details
      - Privacy policy URL
      - Sign-in required: **No**
   2. Answer the **export compliance** question. It uses only standard encryption (HTTPS), so the answer is exempt.
   3. Open **TestFlight > External Testing > +**, create a group named "Public preview", and add the build. The first
      external build goes to a short Beta App Review (usually under a day).
   4. In that group, turn on **Public Link** and copy the link (`https://testflight.apple.com/join/XXXXXXXX`). Set a
      tester limit if you want one; the maximum is 10,000.
   5. Later builds: run the workflow, then add the new build to the group. Each build expires after 90 days, so
      upload a fresh one at least every 3 months.

### 2. Google Play (company Play Console account)

1. **Play Console > Create app.**
   - Name **Keystone Preview**
   - App, Free
   - Accept the declarations
2. **App content.** Complete these sections:
   - Privacy policy URL
   - App access: "All functionality is available without special access"
   - Ads: No
   - Content rating questionnaire
   - Target audience: 18+
   - Data safety: no data collected or shared (the app sends nothing)
   - Government apps: No
   - Financial features: "None of the above" (it is a preview with sample data)

   For the store listing, use a short and full description that say it is a preview with sample data, add
   screenshots, and use the icon from `preview/keystone-preview/icon.png`.
3. **Upload key.** Create it once and keep it in the company password manager:

   ```bash
   keytool -genkeypair -v -keystore keystone-preview-upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000
   base64 -i keystone-preview-upload.jks | pbcopy     # macOS; on Linux: base64 -w0 keystone-preview-upload.jks
   ```

   Play App Signing (on by default) holds the real signing key. This file is only the upload key.
4. **Service account for uploads.**
   1. In Google Cloud (the company project), create a service account and download its JSON key.
   2. In Play Console > Users and permissions, invite the service account's email.
   3. Give it **Release apps to testing tracks** (and View app information) for Keystone Preview.
5. **GitHub repository secrets** (KS-Client > Settings > Secrets and variables > Actions):

   | Secret | What goes in it |
   | --- | --- |
   | `PREVIEW_ANDROID_KEYSTORE_B64` | the `.jks` file, base64 |
   | `PREVIEW_ANDROID_KEYSTORE_PASSWORD` | keystore password |
   | `PREVIEW_ANDROID_KEY_ALIAS` | `upload` |
   | `PREVIEW_ANDROID_KEY_PASSWORD` | key password |
   | `PREVIEW_PLAY_SERVICE_ACCOUNT_JSON` | full text of the service account JSON key |

6. **First upload by hand.** Google accepts API uploads only after one bundle was uploaded in the Play Console.
   1. Run the workflow once with the signing secrets set.
   2. Download the `android-keystone-preview` artifact (an `.aab`).
   3. Upload it to **Testing > Internal testing > Create new release**.

   After that, the workflow uploads by itself.
7. **Sharing.**
   - **Internal testing** (up to 100 testers, no review): add testers' Google accounts or a Google Group, then
     share the **opt-in link** from the Testers tab.
   - **Open testing** (anyone with the link, short review): run the workflow with `play_track` = `beta` (Play's
     open testing track), promote the release in the Play Console, then share the link from Open testing > Testers
     (`https://play.google.com/apps/testing/financial.boreal.keystone.preview`).

## Running the workflow

GitHub > Actions > **Build Keystone Preview** > Run workflow. The inputs are:

- `play_track`: `internal` (default), `alpha` (closed testing) or `beta` (open testing)
- `play_status`: `draft` until the app has passed Google's first review, then `completed`

Each run builds both apps. If a secret is missing, that app is still built and kept as a run artifact
(`ios-keystone-preview`, `android-keystone-preview`). Its upload is skipped with a notice in the run summary, and
the run does not fail. Pull requests that change the preview build both apps unsigned as a check and never upload.

## Building it locally

```bash
node scripts/preview/brand-preview.mjs     # native projects become Keystone Preview, writes client-app/.env.production.local
npm run build && (cd client-app && npx cap sync)
node scripts/brand-native.mjs --reset      # back to the default client, clean git tree
```

`cd client-app && VITE_KS_PREVIEW=1 npm run dev` runs the preview in a browser.

## How it works (for developers)

- `client-app/src/preview/early.ts` runs before every other app module when `VITE_KS_PREVIEW=1`. It puts storage in
  memory and installs `guard.ts`.
- `guard.ts` handles the network:
  - `/api` calls go to `liveDemo/shim.ts`.
  - The app's own files load normally.
  - Everything else throws `PreviewNetworkError`.
  - It also covers XHR, WebSocket, EventSource and sendBeacon, and refuses the denied Capacitor plugin methods.
- `bootPreview.tsx` signs in the sample client with the live demo's sample file and renders `PreviewApp.tsx`: the
  real routes plus the label.
- `client-app/vite.preview.ts` adds the CSP and removes Google Fonts, the manifest and the canonical link from
  `index.html`.
- `scripts/preview/brand-preview.mjs` uses `brand-native.mjs` with `preview/keystone-preview`, then:
  - writes the preview `.env`, with the unreachable server `https://preview.keystone.invalid`
  - removes Associated Domains and the verified App Links filter
  - turns off Firebase auto-init and Analytics
