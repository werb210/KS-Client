# Licensee client apps — onboarding checklist

Each Keystone licensee (brokerage) gets **its own branded client app**: its name under the icon, its icon and splash
screen, its colours, fonts and wording, published in the App Store and Google Play **under the licensee's own
developer accounts**. All of them are built from this one codebase.

The licensee's clients never type a company code or anything else. Their app is already pointed at the licensee's
own Keystone server. (Staff are different: the Keystone dialler and iPad apps are shared, and staff sign in with
their work email or mobile number, which finds their company. Those apps are not built here.)

Why the licensee's own accounts: Apple's App Review Guideline 4.2.6 rejects apps made from a commercial template
when they are published by the template provider on behalf of clients. Each brokerage must publish its own app.

---

## 1. Collect from the licensee

| What | Notes |
| --- | --- |
| App name | Shown under the icon and in the stores. Short (about 12 characters show on iPhone). Letters, digits, spaces, `. , ( ) -` only — write "and", not "&". |
| Company name | As shown inside the app (headings, legal text). |
| App icon | 1024 x 1024 PNG, square, no rounded corners, no transparency. |
| Splash image | 2732 x 2732 PNG, logo centred on the background colour. Optional dark-mode version. |
| Colours | Primary (buttons, headings, links), secondary (accent fills), background, body text, and button-text colour (default white). |
| Fonts | A Google Fonts family name (and the weights it has), or font files (woff2 preferred) they are licensed to embed in apps. Optional separate heading font. |
| Wording changes | Optional. Any of the keys in `client-app/src/config/copy.defaults.json`, e.g. the welcome heading. |
| Support email and phone | Shown in the app. |
| Privacy policy and terms URLs | Their own pages, https. Both stores require a privacy policy URL. |
| Web address for the client app | Where the web version is served (their Azure Static Web App or custom domain). |

From Boreal's side: the licensee's **KS-server address** (from KS-Ops).

## 2. Accounts the licensee must create (in their own company's name)

1. **D-U-N-S number** for the company (free, from Dun & Bradstreet; Apple needs it for an organisation account; allow up to two weeks).
2. **Apple Developer Program** membership as an organisation (US$99/year). Then, in App Store Connect:
   - Users and Access > Integrations > App Store Connect API: create a key with the **Admin** role (automatic signing
     uses it to create the provisioning profiles). Send us the Key ID, Issuer ID and the `.p8` file.
   - Certificates: create an **Apple Distribution** certificate, export it from Keychain as a `.p12` with a password.
   - Identifiers: register the app's bundle id (e.g. `com.acmecapital.client`) and also `<bundle id>.share` and
     `<bundle id>.widget`, the App Group `group.<bundle id>`, and enable Push Notifications and Associated Domains on
     the main id. (Automatic signing can create these on the first run when the API key is Admin.)
   - Apps: create the app record with the same bundle id (name, primary language, SKU).
   - The Team ID (10 characters) from Membership details.
3. **Google Play Console** developer account as an organisation (US$25 one-off; identity verification can take days).
   - Create the app (package name = the Android application id, e.g. `com.acmecapital.client`).
   - Google Cloud: create a service account, download its JSON key, then in Play Console > Users and permissions
     invite that service account's email with release permissions for this app.
   - An **upload key**: we generate it (`keytool -genkeypair -v -keystore upload.jks -alias upload -keyalg RSA
     -keysize 2048 -validity 10000`) and keep it with the licensee's records; Play App Signing holds the real key.
   - Google only accepts API uploads after the first bundle was uploaded by hand: download the `android-<key>` AAB
     from the first workflow run and upload it to Internal testing in the Play Console once.
4. Optional, for push notifications on Android: a **Firebase** project with an Android app for the same package name;
   send us its `google-services.json`. (iPhone push uses an APNs key on the licensee's KS-server.)

## 3. Add the licensee to this repo

1. Create `licensees/<key>/` where `<key>` is the licensee's company code (e.g. `acme-capital`).
2. Copy `licensees/keystone-demo/licensee.json` there and fill it in. `$schema` gives editor hints; every field is
   described in `licensees/licensee.schema.json`.
3. Add `icon.png` (1024) and `splash.png` (2732) to the folder, plus any font files.
4. Check it: `node scripts/licensee/validate.mjs <key>`. It refuses bad ids, wrong image sizes, unknown wording keys
   and any text/background colour pair below WCAG AA 4.5:1 — pick darker or lighter colours until it passes.
5. Optional local check of the look: `cd client-app && VITE_LICENSEE=<key> npm run dev`.
6. Open a pull request; CI validates every licensee folder.

## 4. Add the secrets (GitHub > Settings > Environments > New environment named `<key>`)

| Secret | What goes in it |
| --- | --- |
| `APPLE_API_KEY_ID` | App Store Connect API Key ID |
| `APPLE_API_ISSUER_ID` | App Store Connect Issuer ID |
| `APPLE_API_KEY_P8` | Full text of the `.p8` file |
| `APPLE_TEAM_ID` | Apple Team ID |
| `IOS_DIST_CERT_P12` | Distribution certificate `.p12`, base64 (`base64 -i cert.p12 \| pbcopy`) |
| `IOS_DIST_CERT_PASSWORD` | The `.p12` password |
| `ANDROID_KEYSTORE_B64` | Upload keystore `.jks`, base64 |
| `ANDROID_KEYSTORE_PASSWORD` | Keystore password |
| `ANDROID_KEY_ALIAS` | Key alias (e.g. `upload`) |
| `ANDROID_KEY_PASSWORD` | Key password |
| `PLAY_SERVICE_ACCOUNT_JSON` | Full text of the service account JSON key |
| `GOOGLE_SERVICES_JSON` (optional) | Firebase `google-services.json` (text or base64) for Android push |
| `AZURE_STATIC_WEB_APPS_API_TOKEN` (optional) | Deploys the web build to the licensee's Static Web App |

Missing secrets never fail the run: the apps are still built and kept as run artifacts, and the upload is skipped
with a notice. So the first run can happen before the licensee's accounts are ready.

## 5. Build and publish

1. GitHub > Actions > **Build licensee apps** > Run workflow.
2. `licensee`: the key, or `all`. `play_track`: `internal` to start. `play_status`: `draft` until the app has passed
   Google's first review, then `completed`.
3. Results: run summary per platform; artifacts `web-<key>`, `ios-<key>` (archive) and `android-<key>` (AAB).
4. iOS: the build appears in the licensee's App Store Connect (TestFlight) after 10–30 minutes of processing. The
   licensee (or we, as a user on their account) fills in the store listing, privacy answers and screenshots, and
   submits for review.
5. Android: the release appears on the chosen track in the licensee's Play Console.

## How it works (for developers)

- `licensees/<key>/licensee.json` is the single source. `scripts/licensee/lib.mjs` loads and validates it.
- Web: `VITE_LICENSEE=<key>` makes `client-app/vite.licensee.ts` point the app at the licensee's server, pass the
  public settings to the app (`VITE_KS_LICENSEE`), swap Keystone's colours and fonts for the licensee's at build time,
  and set the title, manifest, icons and Static Web Apps server rewrite/CSP.
- In the app: `src/config/licenseeBuild.ts` reads those settings; `brand.ts` pins the name, colours and support
  contact from the build (the server's `GET /api/licensee` still fills the logo, legal name and assistant name);
  `copy.ts` (`t(key)`) applies wording overrides; `licensee.ts` gives the support and legal links.
- Native: `node scripts/brand-native.mjs <key>` rewrites the Capacitor config, iOS bundle ids, app group, display
  names, Info.plist wording, team, associated domain and Android application id, names, App Links host and
  google-services.json; generates icons and splash screens with `@capacitor/assets`; and writes
  `client-app/.env.production.local` (VITE_LICENSEE + server address). It always starts from the committed files,
  so it is safe to run twice or for another licensee. `node scripts/brand-native.mjs --reset` puts the default
  Keystone client back and leaves a clean git tree. Without a licensee nothing changes.
