// KS_CLIENT_LANGUAGES_v1 - English / Français / Español. Shown only when the brokerage offers more than English.
// Picking a language saves it on this device and on the client's profile (when signed in), then redraws the app.
import { useBrand } from "@/config/brand";
import { chooseLang, lang, LANG_NAMES, offeredLangs, type Lang } from "@/i18n";
import { SERVER_URL } from "@/config/licensee";
import { getToken } from "@/auth/token";

/** Saves the language on the client's profile so texts and emails come in it too. Best effort. */
export async function saveLangOnProfile(l: Lang, fetchImpl: typeof fetch = fetch): Promise<void> {
  const token = (() => { try { return getToken(); } catch { return null; } })();
  if (!token) return; // not signed in yet: the device keeps it and the server learns it at sign-in
  try {
    await fetchImpl(`${SERVER_URL}/api/client/language`, {
      method: "PUT", credentials: "include",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ language: l }),
    });
  } catch { /* offline: the device keeps the choice and sends it with the next sign-in */ }
}

export default function LanguagePicker({ tone = "dark", label = true }: { tone?: "dark" | "light"; label?: boolean }) {
  const b = useBrand();
  const offered = offeredLangs(b.client_languages);
  if (offered.length < 2) return null;
  const now = lang();
  const fg = tone === "dark" ? "#ffffff" : "#111827";
  const border = tone === "dark" ? "rgba(255,255,255,.55)" : "#6b7280";
  return (
    <div role="group" aria-label="Language / Langue / Idioma" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
      {label && <span style={{ fontSize: 13, color: fg, opacity: 0.85 }}>Language / Langue / Idioma</span>}
      {offered.map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          aria-pressed={l === now}
          onClick={() => { if (l !== now) { void saveLangOnProfile(l).finally(() => chooseLang(l)); } }}
          style={{
            padding: "6px 12px", borderRadius: 999, fontSize: 14, fontWeight: 600, cursor: "pointer",
            border: `1px solid ${l === now ? fg : border}`, background: l === now ? fg : "transparent", color: l === now ? (tone === "dark" ? "#0b1f3a" : "#ffffff") : fg,
          }}
        >
          {LANG_NAMES[l]}
        </button>
      ))}
    </div>
  );
}
