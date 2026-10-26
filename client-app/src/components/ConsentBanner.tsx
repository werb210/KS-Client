import { useEffect, useState, type ReactElement } from "react";
import { initClarity } from "@/lib/clarity";
import { isNativeBuild } from "@/lib/thirdPartyTags";
import { CONSENT_KEY } from "@/utils/analytics";
import { SERVER_URL } from "@/config/licensee";
import { startJourney } from "@/lib/journey";

const KEY = CONSENT_KEY;
const VISITOR_KEY = "ks_consent_visitor";
export const CONSENT_POLICY_VERSION = "2026-11";

/** KS_CLIENT_SETTINGS_PACK_v1_CONSENT - which Keystone page the choice was made on. */
export function consentSurface(path: string = typeof window !== "undefined" ? window.location.pathname : "/"): "booking_page" | "client_app" {
  return /^\/(book|survey)(\/|$)/.test(path) ? "booking_page" : "client_app";
}

/** KS_CLIENT_SETTINGS_PACK_v1_CONSENT - the choice is recorded on the server (a random visitor id, never the journey
 *  id, and no personal details). Best effort: a failed record never blocks the page. */
export function recordConsentChoice(granted: boolean): void {
  try {
    let visitor = localStorage.getItem(VISITOR_KEY);
    if (!visitor) {
      visitor = `v_${window.crypto?.randomUUID?.() ?? `${Date.now()}_${Math.random().toString(36).slice(2)}`}`;
      localStorage.setItem(VISITOR_KEY, visitor);
    }
    const body = JSON.stringify({
      visitorId: visitor, surface: consentSurface(), choice: granted ? "granted" : "denied", policyVersion: CONSENT_POLICY_VERSION,
      categories: { analytics: granted, session_replay: granted, advertising: granted },
    });
    void fetch(`${SERVER_URL}/api/privacy/consent`, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true })
      .catch(() => { /* recording the choice is best effort */ });
  } catch { /* never break the page */ }
}

function applyConsent(granted: boolean) {
  // BF_CLIENT_CONSENT_GTAG_FORMAT_FIX_v1 - Consent Mode commands MUST be pushed
  // as gtag()-style `arguments` objects; pushing a plain array is silently
  // ignored by GTM. Accept was a no-op, so with the index.html denied default
  // every applicant stayed denied and GA4 collected NOTHING.
  const w = window as unknown as { dataLayer?: unknown[] };
  w.dataLayer = w.dataLayer || [];
  function gtag(..._args: unknown[]) {
    // eslint-disable-next-line prefer-rest-params
    (w.dataLayer as unknown[]).push(arguments);
  }
  gtag("consent", "update", {
    ad_storage: granted ? "granted" : "denied",
    analytics_storage: granted ? "granted" : "denied",
    ad_user_data: granted ? "granted" : "denied",
    ad_personalization: granted ? "granted" : "denied",
  });
}

export default function ConsentBanner(): ReactElement | null {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // BF_CLIENT_v789_ANALYTICS_GATES - the native apps load no analytics or
    // advertising tags, so there is nothing to consent to.
    if (isNativeBuild()) return;
    let stored: string | null = null;
    try { stored = localStorage.getItem(KEY); } catch { stored = null; }
    // BF_CLIENT_CONSENT_CARRYOVER_v710 - boreal.financial adds ?consent=granted|denied
    // to its Apply links. Different domains cannot share storage, so a choice
    // already made on the website is carried over here instead of asking again.
    if (stored !== "granted" && stored !== "denied") {
      let carried: string | null = null;
      try { carried = new URLSearchParams(window.location.search).get("consent"); } catch { carried = null; }
      if (carried === "granted" || carried === "denied") {
        try { localStorage.setItem(KEY, carried); } catch { /* ignore */ }
        stored = carried;
        recordConsentChoice(carried === "granted"); // KS_CLIENT_SETTINGS_PACK_v1_CONSENT
      }
    }
    if (stored === "granted") { applyConsent(true); initClarity(); return; }
    if (stored === "denied") { applyConsent(false); return; }
    setShow(true);
  }, []);

  if (!show) return null;

  const choose = (granted: boolean) => {
    try { localStorage.setItem(KEY, granted ? "granted" : "denied"); } catch { /* ignore */ }
    applyConsent(granted);
    recordConsentChoice(granted); // KS_CLIENT_SETTINGS_PACK_v1_CONSENT
    // BF_CLIENT_v789_ANALYTICS_GATES - session recording starts only on Accept.
    // KS_CLIENT_SETTINGS_PACK_v1_CONSENT - and so does visitor tracking.
    if (granted) { initClarity(); startJourney(); }
    setShow(false);
  };

  return (
    <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 80, background: "#0B1320", color: "#fff", borderTop: "1px solid rgba(255,255,255,0.12)", padding: "16px 20px calc(16px + env(safe-area-inset-bottom))", display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "center" }}>
      <p style={{ margin: 0, fontSize: "var(--ks-text-label)", maxWidth: 640, lineHeight: 1.5 }}>
        We use cookies to see how visitors use this site (analytics and session recordings) and to measure our ads. Nothing is tracked unless you accept.
      </p>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => choose(false)} style={{ background: "transparent", color: "#fff", border: "1px solid rgba(255,255,255,0.4)", borderRadius: 8, padding: "8px 16px", fontSize: "var(--ks-text-label)", cursor: "pointer" }}>Decline</button>
        <button onClick={() => choose(true)} style={{ background: "#1E3A8A", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: "var(--ks-text-label)", fontWeight: 600, cursor: "pointer" }}>Accept</button>
      </div>
    </div>
  );
}
