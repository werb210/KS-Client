// KS_CLIENT_v7_DEMO - the borrower side of the self-serve demo. The QR code / short link is /demo/<code> (or /d/<code>);
// the code is exchanged at the demo server (VITE_DEMO_SERVER_URL) for a borrower token kept for this tab only.

export type Sample = { key: string; label: string; hint: string; filename: string; uploaded: boolean; status: string | null };
export type BorrowerState = {
  business: { name: string; industry: string };
  contact: { name: string };
  request: { amount: number; product: string; term_months: number; purpose: string } | null;
  broker: { company: string; name: string };
  samples: Sample[];
  messages: Array<{ role: string; body: string; at: string }>;
  assistant_remaining: number;
  borrower_submitted_at: string | null;
  lender_submitted_at: string | null;
};

export class DemoError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

const TOKEN_KEY = "ks_demo_borrower_v1";

export function demoServerUrl(): string {
  return String(import.meta.env.VITE_DEMO_SERVER_URL ?? "").trim().replace(/\/+$/, "");
}

/** The code in /demo/<code> or /d/<code>, else null. */
export function codeFromPath(pathname: string): string | null {
  const m = /^\/(?:demo|d)\/([A-Za-z0-9]{8,32})\/?$/.exec(pathname);
  return m ? m[1]!.toLowerCase() : null;
}

export function isDemoBorrowerPath(pathname: string): boolean {
  return /^\/(?:demo|d)\//.test(pathname);
}

function saved(code: string): string | null {
  try {
    const raw = window.sessionStorage.getItem(TOKEN_KEY);
    const v = raw ? (JSON.parse(raw) as { code: string; token: string }) : null;
    return v && v.code === code ? v.token : null;
  } catch {
    return null;
  }
}

function save(code: string, token: string | null) {
  try {
    if (token) window.sessionStorage.setItem(TOKEN_KEY, JSON.stringify({ code, token }));
    else window.sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* private mode */
  }
}

async function errorOf(r: Response): Promise<DemoError> {
  let b: { error?: string; message?: string } = {};
  try { b = await r.json(); } catch { /* not JSON */ }
  return new DemoError(r.status, b.error ?? `status_${r.status}`, b.message ?? "Something went wrong. Please try again.");
}

export function borrowerApi(code: string, fetchImpl: typeof fetch = fetch, base: string = demoServerUrl()) {
  let token = saved(code);
  const ensure = async (): Promise<string> => {
    if (token) return token;
    if (!base) throw new DemoError(503, "demo_not_configured", "The demo is not set up on this site yet.");
    const r = await fetchImpl(`${base}/api/demo/client/session`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
    if (!r.ok) throw await errorOf(r);
    token = ((await r.json()) as { client_token: string }).client_token;
    save(code, token);
    return token;
  };
  const call = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
    const t = await ensure();
    const r = await fetchImpl(`${base}${path}`, {
      ...init,
      headers: { ...(typeof init.body === "string" ? { "Content-Type": "application/json" } : {}), Authorization: `Bearer ${t}` },
    });
    if (r.status === 401) { token = null; save(code, null); }
    if (!r.ok) throw await errorOf(r);
    const type = r.headers.get("content-type") ?? "";
    if (type.includes("application/json")) return (await r.json()) as T;
    // A Blob of this page's own kind (FormData only takes those).
    return new Blob([await r.arrayBuffer()], { type: type || "application/octet-stream" }) as T;
  };
  return {
    start: ensure,
    state: () => call<BorrowerState>("/api/demo/client/state"),
    /** One tap: fetch the sample file and upload it, as a phone upload. */
    upload: async (s: Sample) => {
      const blob = await call<Blob>(`/api/demo/client/samples/${encodeURIComponent(s.key)}`);
      const fd = new FormData();
      fd.set("sample_key", s.key);
      fd.set("via", "phone");
      fd.set("file", blob, s.filename);
      return call<{ document: unknown }>("/api/demo/client/documents", { method: "POST", body: fd });
    },
    submit: () => call<BorrowerState>("/api/demo/client/submit", { method: "POST", body: "{}" }),
    ask: (message: string) => call<{ reply: string; messages: BorrowerState["messages"] }>("/api/demo/client/assistant", { method: "POST", body: JSON.stringify({ message }) }),
  };
}
