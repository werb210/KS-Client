import { t as tr } from "@/i18n"; // KS_CLIENT_LANGUAGES_v1
// BF_CLIENT_v809_SMS_UPDATES_CONSENT - carriers require the client to choose texts with an unticked box. The
// sign-in code is always sent (the client asked for it); updates about the application need this box. The
// wording is stored with the choice (BF-Server SMS_UPDATES_CONSENT_TEXT) - keep the two identical.
// KS_CLIENT_LANGUAGES_v1 - shown through smsUpdatesConsentText() in the client's language; the server stores the same
// words in that language (KS-server clientLanguage/language.ts smsUpdatesConsentTextIn).
export const smsUpdatesConsentText = (): string => tr(SMS_UPDATES_CONSENT_TEXT);
export const SMS_UPDATES_CONSENT_TEXT =
  "Text me updates about my application: status updates, document requests and signing reminders. Message frequency varies. Message and data rates may apply. Reply STOP to opt out, HELP for help. Not required to apply.";
