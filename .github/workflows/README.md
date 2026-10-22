# Workflows

This directory is intentionally managed by Azure Static Web Apps integration.

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
