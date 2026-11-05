// BF_CLIENT_v802_SETTINGS - the phone Settings tab (item 23): sign-in and security, notifications, your
// details, your file, help and legal, Sign out, the app version, and Delete account last, in plain text.
import { t } from "@/config/copy"; // KS_CLIENT_v5_LICENSEE_APPS
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import FaceIdSignInToggle from "@/components/FaceIdSignInToggle";
import PasskeySignInToggle from "@/components/PasskeySignInToggle";
import { wipeSession } from "@/auth/logout";
import { openExternal } from "@/native/openExternal"; // BF_CLIENT_v805_PHONE_FIXES
import { CmpMoreFooter } from "@/components/CmpPhone";
import { apiCall } from "@/api/client"; // BF_CLIENT_v809_SMS_UPDATES_CONSENT
import { smsUpdatesConsentText } from "@/lib/smsUpdatesConsent";
import { Icon } from "./icons";
import { ANDROID_PLAY_STORE_URL, iosAppStoreUrl } from "@/lib/appStoreLinks"; // BF_CLIENT_v817
import "./cmp.css";
import { offeredLangs, t as tr } from "@/i18n"; // KS_CLIENT_LANGUAGES_v1
import LanguagePicker from "@/i18n/LanguagePicker";
import { PRIVACY_URL, TERMS_URL } from "@/config/licensee"; // KS_CLIENT_v1_LICENSEE + v5
import { brandName, useBrand } from "@/config/brand"; // KS_CLIENT_v4_BRANDING

type PushState = "checking" | "on" | "off" | "blocked" | "web";

/** Item 24 - whether this phone gets notifications, and a way to turn them on. */
export function usePushStatus(): { state: PushState; turnOn: () => Promise<void>; note: string | null } {
  const [state, setState] = useState<PushState>("checking");
  const [note, setNote] = useState<string | null>(null);
  const check = useCallback(async () => {
    try {
      const { Capacitor } = await import("@capacitor/core");
      if (!Capacitor.isNativePlatform()) { setState("web"); return; }
      const { PushNotifications } = await import("@capacitor/push-notifications");
      const p = await PushNotifications.checkPermissions();
      setState(p.receive === "granted" ? "on" : p.receive === "denied" ? "blocked" : "off");
    } catch {
      setState("web");
    }
  }, []);
  useEffect(() => { void check(); }, [check]);
  const turnOn = useCallback(async () => {
    setNote(null);
    try {
      const { Capacitor } = await import("@capacitor/core");
      const { PushNotifications } = await import("@capacitor/push-notifications");
      let p = await PushNotifications.checkPermissions();
      if (p.receive === "denied") {
        if (Capacitor.getPlatform() === "ios") {
          try { const { AppLauncher } = await import("@capacitor/app-launcher"); await AppLauncher.openUrl({ url: "app-settings:" }); return; } catch { /* fall through to the note */ }
        }
        setNote(tr("Notifications are off for {brand} in your phone's Settings. Open Settings, find {brand}, and turn on Notifications.", { brand: brandName() }));
        return;
      }
      if (p.receive !== "granted") p = await PushNotifications.requestPermissions();
      if (p.receive === "granted") { await PushNotifications.register(); setNote("Notifications are on."); }
      await check();
    } catch {
      setNote("We couldn't turn on notifications on this device.");
    }
  }, [check]);
  return { state, turnOn, note };
}

// BF_CLIENT_v817 - "Get the app" in a browser: the iOS and Android store links. Hidden inside the app itself.
export function GetTheAppGroup() {
  const [native, setNative] = useState<boolean | null>(null);
  useEffect(() => {
    let live = true;
    import("@capacitor/core")
      .then(({ Capacitor }) => { if (live) setNative(Capacitor.isNativePlatform()); })
      .catch(() => { if (live) setNative(false); });
    return () => { live = false; };
  }, []);
  if (native !== false) return null;
  return (
    <div className="cmpx-group" data-testid="cmp-settings-get-app">
      <h2 className="cmpx-group__title">{tr("Get the app")}</h2>
      <div className="cmpx-list">
        <Action icon="phone" title={tr("Download for iPhone and iPad")} desc={`${brandName()} on the App Store`} href={iosAppStoreUrl()} testId="cmp-get-app-ios" />
        <Action icon="phone" title={tr("Download for Android")} desc={`${brandName()} on Google Play`} href={ANDROID_PLAY_STORE_URL} testId="cmp-get-app-android" />
      </div>
    </div>
  );
}

function Line({ icon, title, value }: { icon: string; title: string; value: string }) {
  return (
    <div className="cmpx-row cmpx-row--static">
      <span className="cmpx-row__icon"><Icon name={icon} /></span>
      <span className="cmpx-row__text"><span className="cmpx-row__title">{title}</span></span>
      <span className="cmpx-row__value">{value || "\u2014"}</span>
    </div>
  );
}

function Action({ icon, title, desc, onClick, href, testId }: { icon: string; title: string; desc?: string; onClick?: () => void; href?: string; testId?: string }) {
  const body = (
    <>
      <span className="cmpx-row__icon"><Icon name={icon} /></span>
      <span className="cmpx-row__text"><span className="cmpx-row__title">{title}</span>{desc ? <span className="cmpx-row__desc">{desc}</span> : null}</span>
      <span className="cmpx-chev"><Icon name="chevron" size={18} /></span>
    </>
  );
  // BF_CLIENT_v805_PHONE_FIXES - links open in the in-app browser instead of leaving the app.
  return <button type="button" className="cmpx-row" onClick={href ? () => void openExternal(href) : onClick} data-testid={testId}>{body}</button>;
}

// BF_CLIENT_v809_SMS_UPDATES_CONSENT - "Text me updates about my application", the same choice as the unticked box on
// the sign-in screen. It belongs to the signed-in mobile number (BF-Server GET/POST /api/client/sms-updates).
export function SmsUpdatesToggle() {
  const [on, setOn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    apiCall<{ smsUpdates?: boolean }>("/api/client/sms-updates")
      .then((r) => { if (live) setOn(r?.smsUpdates === true); })
      .catch(() => { if (live) setOn(false); });
    return () => { live = false; };
  }, []);
  const change = async (next: boolean) => {
    setBusy(true); setErr(null);
    try { await apiCall("/api/client/sms-updates", { method: "POST", body: { smsUpdates: next } }); setOn(next); }
    catch { setErr(tr("We couldn't save that. Check your connection and try again.")); }
    finally { setBusy(false); }
  };
  return (
    <div className="cmpx-row cmpx-row--static" data-testid="cmp-sms-updates">
      <span className="cmpx-row__icon"><Icon name="chat" /></span>
      <label className="cmpx-row__text" style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: busy || on === null ? "default" : "pointer" }}>
        <input type="checkbox" checked={on === true} disabled={busy || on === null} onChange={(e) => void change(e.target.checked)}
          data-testid="cmp-sms-updates-checkbox" style={{ width: 20, height: 20, marginTop: 2, flex: "0 0 auto" }} />
        <span>
          <span className="cmpx-row__title">{tr("Text me updates about my application")}</span>
          <span className="cmpx-row__desc">{smsUpdatesConsentText().replace(/^[^:]*:\s*/, "")}</span>
          {err ? <span className="cmpx-err" role="alert" style={{ display: "block" }}>{err}</span> : null}
        </span>
      </label>
    </div>
  );
}

// BF_CLIENT_v807_DETAILS - the client edits their own name, email and business name. Saving updates the CRM
// contact and the application (BF-Server v807 POST /api/client/profile). The mobile number is the sign-in
// number, so it stays read-only.
export type EditableDetails = { firstName: string; lastName: string; email: string; business: string };
const DETAIL_ERRORS: Record<string, string> = {
  first_name_required: "Add your first name.",
  last_name_required: "Add your last name.",
  email_invalid: "Check your email address.",
  business_name_required: "Add your business name.",
};
export function DetailsEditor({ details, phone, onSave }: { details: EditableDetails; phone: string; onSave: (d: EditableDetails) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<EditableDetails>(details);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const name = [details.firstName, details.lastName].filter(Boolean).join(" ");
  const start = () => { setDraft(details); setErr(null); setSaved(false); setEditing(true); };
  const save = async () => {
    const d = { firstName: draft.firstName.trim(), lastName: draft.lastName.trim(), email: draft.email.trim(), business: draft.business.trim() };
    if (!d.firstName) { setErr(DETAIL_ERRORS.first_name_required); return; }
    if (!d.lastName) { setErr(DETAIL_ERRORS.last_name_required); return; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email)) { setErr(DETAIL_ERRORS.email_invalid); return; }
    if (!d.business) { setErr(DETAIL_ERRORS.business_name_required); return; }
    setBusy(true); setErr(null);
    try { await onSave(d); setEditing(false); setSaved(true); }
    catch (e) {
      const code = e instanceof Error ? e.message : ""; // apiCall puts the server's error code in the message
      setErr(DETAIL_ERRORS[code] ?? "We couldn't save that. Check your connection and try again.");
    } finally { setBusy(false); }
  };
  if (!editing) {
    return (
      <>
        <div className="cmpx-list" data-testid="cmp-settings-details">
          <Line icon="user" title={tr("Name")} value={name} />
          <Line icon="phone" title={tr("Mobile")} value={phone} />
          <Line icon="chat" title={tr("Email")} value={details.email} />
          <Line icon="folder" title={tr("Business")} value={details.business} />
        </div>
        {saved ? <p className="cmpx-muted" role="status" style={{ margin: "8px 4px 0", color: "#065F46", fontWeight: 600 }}>{tr("Saved. Your advisor sees the change too.")}</p> : null}
        <button type="button" className="cmpx-btn cmpx-btn--ghost cmpx-btn--block" style={{ marginTop: 10 }} onClick={start} data-testid="cmp-details-edit">{tr("Edit my details")}</button>
        <p className="cmpx-muted" style={{ margin: "8px 4px 0" }}>{tr("Your mobile number is how you sign in. To change it, ask your advisor.")}</p>
      </>
    );
  }
  const field = (key: keyof EditableDetails, label: string, auto: string, type = "text") => (
    <label className="cmpx-field">{label}
      <input type={type} value={draft[key]} autoComplete={auto} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })} data-testid={"cmp-details-" + key} />
    </label>
  );
  return (
    <div className="cmpx-card cmpx-details-form" data-testid="cmp-details-form">
      <div className="cmpx-details-form__row">
        {field("firstName", "First name", "given-name")}
        {field("lastName", "Last name", "family-name")}
      </div>
      {field("email", "Email", "email", "email")}
      {field("business", "Business name", "organization")}
      <p className="cmpx-muted" style={{ margin: "0 0 10px" }}>Mobile: {phone || "\u2014"} (your sign-in number; ask your advisor to change it)</p>
      {err ? <p className="cmpx-err" role="alert">{err}</p> : null}
      <div className="cmpx-details-form__actions">
        <button type="button" className="cmpx-btn cmpx-btn--ghost" onClick={() => setEditing(false)} disabled={busy}>{tr("Cancel")}</button>
        <button type="button" className="cmpx-btn" onClick={() => void save()} disabled={busy} data-testid="cmp-details-save">{busy ? tr("Saving...") : tr("Save")}</button>
      </div>
    </div>
  );
}

// KS_CLIENT_LANGUAGES_v1 - only when the brokerage offers more than English.
function LanguageGroup() {
  const b = useBrand();
  if (offeredLangs(b.client_languages).length < 2) return null;
  return (
    <div className="cmpx-group" data-testid="cmp-settings-language">
      <h2 className="cmpx-group__title">Language / Langue / Idioma</h2>
      <div className="cmpx-list"><div className="cmpx-row cmpx-row--static"><LanguagePicker tone="light" label={false} /></div></div>
    </div>
  );
}

export default function CmpSettings(p: {
  details: EditableDetails;
  phone: string;
  onSaveDetails: (d: EditableDetails) => Promise<void>;
  applicationNumber: string;
  stage: string;
  onReportProblem: () => void;
  onDeleteAccount: () => void;
}) {
  const navigate = useNavigate();
  const push = usePushStatus();
  const [signingOut, setSigningOut] = useState(false);
  const signOut = async () => {
    setSigningOut(true);
    try { await wipeSession(); } catch { /* storage is cleared before anything awaits */ }
    navigate("/otp", { replace: true });
  };
  return (
    <section className="cmp-phone-only cmpx-settings" data-cmp-tab="settings" data-testid="cmp-settings">
      <LanguageGroup />{/* KS_CLIENT_LANGUAGES_v1 */}
      <div className="cmpx-group">
        <h2 className="cmpx-group__title">{tr("Sign-in and security")}</h2>
        <div className="cmpx-list cmpx-settings__toggles" data-testid="cmp-settings-security">
          <FaceIdSignInToggle variant="row" />
          <PasskeySignInToggle />
          <div className="cmpx-row cmpx-row--static">
            <span className="cmpx-row__icon"><Icon name="lock" /></span>
            <span className="cmpx-row__text"><span className="cmpx-row__title">{tr("Text-message code")}</span><span className="cmpx-row__desc">{tr("You can always sign in with a code sent to your mobile.")}</span></span>
          </div>
        </div>
      </div>

      <div className="cmpx-group">
        <h2 className="cmpx-group__title">{tr("Notifications")}</h2>
        <div className="cmpx-list" data-testid="cmp-settings-push">
          <div className="cmpx-row cmpx-row--static">
            <span className="cmpx-row__icon"><Icon name="bell" /></span>
            <span className="cmpx-row__text">
              <span className="cmpx-row__title">{push.state === "on" ? "Notifications are on" : push.state === "web" ? "Notifications" : push.state === "checking" ? tr("Checking...") : tr("Notifications are off")}</span>
              <span className="cmpx-row__desc">{push.state === "web" ? tr("Get the {brand} app to be told about offers, document requests and messages.", { brand: brandName() }) : "Offers, document requests and messages from your advisor."}</span>
            </span>
            {push.state === "off" || push.state === "blocked" ? <button type="button" className="cmpx-btn" style={{ minHeight: 40, fontSize: "var(--ks-text-body-sm)" }} onClick={() => void push.turnOn()}>{tr("Turn on")}</button> : null}
          </div>
        </div>
        {push.note ? <p className="cmpx-muted" role="status" style={{ margin: "8px 4px 0" }}>{push.note}</p> : null}
        <div className="cmpx-list" style={{ marginTop: 10 }}><SmsUpdatesToggle /></div>
      </div>

      <GetTheAppGroup />

      <div className="cmpx-group">
        <h2 className="cmpx-group__title">{tr("Your details")}</h2>
        <DetailsEditor details={p.details} phone={p.phone} onSave={p.onSaveDetails} />
      </div>

      <div className="cmpx-group">
        <h2 className="cmpx-group__title">{tr("Your file")}</h2>
        <div className="cmpx-list" data-testid="cmp-settings-file">
          <Line icon="doc" title={tr("Application number")} value={p.applicationNumber} />
          <Line icon="flag" title={tr("Stage")} value={p.stage} />
        </div>
      </div>

      <div className="cmpx-group">
        <h2 className="cmpx-group__title">{tr("Help")}</h2>
        <div className="cmpx-list">
          {/* BF_CLIENT_v807_SETTINGS - "Documents" (on More) and "Ask a question" (on Home and in Chat) are not repeated here. */}
          <Action icon="flag" title={tr("Report a problem")} desc="Tell us what went wrong. A picture of your screen is included." onClick={p.onReportProblem} testId="cmp-settings-report" />
          <Action icon="shield" title={t("legal.privacy_short")} href={PRIVACY_URL} />
          <Action icon="doc" title={t("legal.terms_short")} href={TERMS_URL} />
        </div>
      </div>

      <button type="button" className="cmpx-btn cmpx-btn--ghost cmpx-btn--block cmpx-signout" disabled={signingOut} onClick={() => void signOut()} data-testid="cmp-sign-out">
        <Icon name="out" />{signingOut ? tr("Signing out...") : tr("Sign out")}
      </button>
      <CmpMoreFooter onDeleteAccount={p.onDeleteAccount} />
    </section>
  );
}
