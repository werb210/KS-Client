// KS_CLIENT_v7_DEMO - the borrower's phone screen in the self-serve demo (/demo/<code>). The prospect plays the owner
// of a sample business: one tap uploads each sample document (bank statements - one of them doctored - financial
// statements, a void cheque and an ID placeholder, all marked SAMPLE), they can ask the assistant a question, and
// "Send to my broker" finishes. Everything lands live in the demo portal on their computer.
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import "./demo.css";
import { borrowerApi, codeFromPath, DemoError, demoServerUrl, type BorrowerState, type Sample } from "./demoApi";

export const PALETTE = {
  page: "#f8fafc", surface: "#ffffff", border: "#cbd5e1", text: "#0f172a", muted: "#475569",
  primary: "#1d4ed8", onPrimary: "#ffffff", success: "#15803d", onSuccess: "#ffffff", header: "#0f172a", onHeader: "#ffffff",
  doneBg: "#dcfce7", doneText: "#14532d", warnBg: "#fee2e2", warnText: "#7f1d1d", aiBg: "#e2e8f0", aiText: "#1e293b",
};

/** Text/background pairs on this page (each must reach 4.5:1). */
export const TEXT_PAIRS: Array<[string, string]> = [
  [PALETTE.text, PALETTE.surface], [PALETTE.text, PALETTE.page], [PALETTE.muted, PALETTE.surface], [PALETTE.muted, PALETTE.page],
  [PALETTE.onPrimary, PALETTE.primary], [PALETTE.onSuccess, PALETTE.success], [PALETTE.onHeader, PALETTE.header],
  [PALETTE.doneText, PALETTE.doneBg], [PALETTE.warnText, PALETTE.warnBg], [PALETTE.aiText, PALETTE.aiBg], [PALETTE.primary, PALETTE.surface],
];

const vars = {
  "--kdb-page": PALETTE.page, "--kdb-surface": PALETTE.surface, "--kdb-border": PALETTE.border, "--kdb-text": PALETTE.text,
  "--kdb-muted": PALETTE.muted, "--kdb-primary": PALETTE.primary, "--kdb-on-primary": PALETTE.onPrimary, "--kdb-success": PALETTE.success,
  "--kdb-on-success": PALETTE.onSuccess, "--kdb-header": PALETTE.header, "--kdb-on-header": PALETTE.onHeader, "--kdb-done-bg": PALETTE.doneBg,
  "--kdb-done-text": PALETTE.doneText, "--kdb-warn-bg": PALETTE.warnBg, "--kdb-warn-text": PALETTE.warnText, "--kdb-ai-bg": PALETTE.aiBg,
  "--kdb-ai-text": PALETTE.aiText,
} as CSSProperties;

const money = (n: number) => `$${Math.round(n).toLocaleString("en-CA")}`;

function statusLabel(s: Sample): { text: string; cls: string } | null {
  if (!s.uploaded) return null;
  if (s.status === "accepted") return { text: "Accepted", cls: "kdb-done" };
  if (s.status === "rejected") return { text: "Needs replacing", cls: "kdb-warn" };
  return { text: "Sent", cls: "kdb-done" };
}

export default function DemoBorrowerApp({ pathname = window.location.pathname, fetchImpl = fetch, serverUrl = demoServerUrl() }: { pathname?: string; fetchImpl?: typeof fetch; serverUrl?: string }) {
  const code = codeFromPath(pathname);
  const api = useMemo(() => (code ? borrowerApi(code, fetchImpl, serverUrl) : null), [code, fetchImpl, serverUrl]);
  const [st, setSt] = useState<BorrowerState | null>(null);
  const [error, setError] = useState<{ title: string; message: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!api) return;
    try {
      setSt(await api.state());
    } catch (err) {
      const e = err instanceof DemoError ? err : null;
      setError({ title: e?.status === 404 || e?.status === 401 ? "This demo link has ended" : "Could not open the demo", message: e?.message ?? "Check your connection and try again." });
    }
  }, [api]);

  useEffect(() => {
    if (!code) { setError({ title: "This demo link is not complete", message: "Scan the QR code on your computer screen again." }); return; }
    void load();
    // The broker's decisions show up here too.
    const t = window.setInterval(() => { if (document.visibilityState === "visible") void load(); }, 5000);
    return () => window.clearInterval(t);
  }, [code, load]);

  const upload = async (s: Sample) => {
    if (!api) return;
    setBusy(s.key);
    setNote(null);
    try {
      await api.upload(s);
      setSt(await api.state());
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Upload failed - try again.");
    } finally {
      setBusy(null);
    }
  };
  const uploadAll = async () => { for (const s of st?.samples ?? []) if (!s.uploaded) await upload(s); };
  const submit = async () => {
    if (!api) return;
    setBusy("submit");
    try { setSt(await api.submit()); } catch (err) { setNote(err instanceof Error ? err.message : "Could not send."); } finally { setBusy(null); }
  };
  const ask = async () => {
    if (!api || !question.trim()) return;
    setBusy("ask");
    try {
      const r = await api.ask(question.trim());
      setSt((cur) => (cur ? { ...cur, messages: r.messages, assistant_remaining: Math.max(0, cur.assistant_remaining - 1) } : cur));
      setQuestion("");
    } catch (err) {
      setNote(err instanceof Error ? err.message : "The assistant could not answer.");
    } finally {
      setBusy(null);
    }
  };

  const header = (
    <header className="kdb-header">
      <strong>Keystone demo</strong>
      <span className="kdb-pill">You're the borrower</span>
    </header>
  );

  if (error) {
    return <div className="kdb" style={vars}>{header}<main className="kdb-main"><section className="kdb-card" role="alert"><h1>{error.title}</h1><p>{error.message}</p></section></main></div>;
  }
  if (!st) {
    return <div className="kdb" style={vars}>{header}<main className="kdb-main"><p aria-live="polite">Opening your borrower app...</p></main></div>;
  }
  const sent = st.samples.filter((s) => s.uploaded).length;
  const first = st.contact.name?.split(" ")[0] ?? "there";
  return (
    <div className="kdb" style={vars}>
      {header}
      <main className="kdb-main">
        <section className="kdb-card">
          <h1>Hi {first}</h1>
          <p>You're playing the owner of <strong>{st.business.name}</strong> (a sample business). Your broker at <strong>{st.broker.company}</strong> needs a few documents for your {st.request ? `${money(st.request.amount)} ${st.request.product.toLowerCase()}` : "loan"}.</p>
          <p className="kdb-muted">Tap Upload on each one - they're sample files, marked SAMPLE. Then look at your computer: they land in the broker's portal as you go.</p>
        </section>

        <section className="kdb-card" aria-label="Documents">
          <div className="kdb-row" style={{ justifyContent: "space-between" }}>
            <h2>Documents</h2>
            <span className="kdb-muted">{sent} of {st.samples.length} sent</span>
          </div>
          <ul className="kdb-list">
            {st.samples.map((s) => {
              const lab = statusLabel(s);
              return (
                <li key={s.key} className="kdb-item">
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="kdb-label">{s.label}</div>
                    <div className="kdb-muted kdb-small">{s.hint}</div>
                  </div>
                  {lab ? <span className={`kdb-chip ${lab.cls}`}>{lab.text}</span> : (
                    <button type="button" className="kdb-btn kdb-btn-primary" disabled={busy !== null} onClick={() => void upload(s)} aria-label={`Upload ${s.label}`}>
                      {busy === s.key ? "Uploading..." : "Upload"}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          {sent < st.samples.length && (
            <button type="button" className="kdb-btn kdb-wide" disabled={busy !== null} onClick={() => void uploadAll()}>Upload all</button>
          )}
          {sent > 0 && !st.borrower_submitted_at && (
            <button type="button" className="kdb-btn kdb-btn-success kdb-wide" disabled={busy !== null} onClick={() => void submit()}>Send to my broker</button>
          )}
          {st.borrower_submitted_at && <p className="kdb-chip kdb-done" style={{ display: "block", marginTop: 10 }}>Sent to your broker. Now switch to your computer.</p>}
          {note && <p role="alert" className="kdb-chip kdb-warn" style={{ display: "block", marginTop: 10 }}>{note}</p>}
        </section>

        <section className="kdb-card" aria-label="Assistant">
          <h2>Ask the assistant</h2>
          <p className="kdb-muted kdb-small">Try "How long will this take?" or "What's the interest rate?"</p>
          {st.messages.map((m, i) => <div key={i} className={`kdb-bubble ${m.role === "borrower" ? "kdb-me" : "kdb-ai"}`}>{m.body}</div>)}
          {st.assistant_remaining > 0 ? (
            <form className="kdb-row" onSubmit={(e) => { e.preventDefault(); void ask(); }}>
              <label htmlFor="kdb-q" className="kdb-sr">Your question</label>
              <input id="kdb-q" className="kdb-input" value={question} maxLength={500} placeholder="Type a question" onChange={(e) => setQuestion(e.target.value)} />
              <button type="submit" className="kdb-btn kdb-btn-primary" disabled={busy !== null || !question.trim()}>{busy === "ask" ? "..." : "Ask"}</button>
            </form>
          ) : <p className="kdb-muted kdb-small">That's all the questions this demo allows.</p>}
        </section>
        {st.lender_submitted_at && <section className="kdb-card"><h2>Your file went to lenders</h2><p>Your broker sent it - you'd get a text here when a lender replies.</p></section>}
      </main>
    </div>
  );
}
