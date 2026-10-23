// KS_CLIENT_v11_LIVE_DEMO - the live demo's stand-in for the server. It answers, in the browser and from memory, every
// /api/... call the wizard and the client portal make, so the real screens run with nothing sent anywhere. Unknown
// API paths get a plain 200 ({status:"ok", data:{}}) and a console.debug line: the client portal treats two refused
// calls in a row as "this application is gone", so nothing here ever answers 4xx/5xx.
import {
  DEMO_APPLICATION_ID,
  SAMPLE_ADVISOR,
  SAMPLE_BUSINESS,
  SAMPLE_CONTACT,
  SAMPLE_DOCS,
  SAMPLE_LENDERS,
  SAMPLE_REQUEST,
  SAMPLE_REQUIRED_DOCS,
  sampleLenderProducts,
} from "./sample";

type Json = Record<string, unknown> | unknown[] | null;
type Handler = (req: DemoRequest, state: DemoState) => Json;
type DemoRequest = { method: string; path: string; query: URLSearchParams; body: unknown; params: string[] };

export type DemoMessage = {
  id: string;
  direction: "inbound" | "outbound";
  body: string;
  staff_name: string | null;
  created_at: string;
  read_at: string | null;
};

export type DemoState = {
  applicationId: string;
  submitted: boolean;
  submittedAt: string | null;
  saved: Record<string, unknown>;
  messages: DemoMessage[];
  linked: number;
  calls: string[];
};

const ok = (data: unknown): Json => ({ status: "ok", data });

function welcomeMessage(now: number): DemoMessage {
  return {
    id: "demo-welcome",
    direction: "outbound",
    staff_name: `${SAMPLE_ADVISOR.firstName} ${SAMPLE_ADVISOR.lastName}`,
    body:
      `Hi ${SAMPLE_CONTACT.firstName}, I'm ${SAMPLE_ADVISOR.firstName}, your advisor. Your application for ` +
      `$${SAMPLE_REQUEST.amount.toLocaleString("en-CA")} in equipment financing is in, and all 6 of your documents ` +
      "came through: the July, August and September bank statements, the FY2025 financial statements, a void cheque " +
      "and your photo ID. I'm reviewing everything now and will be in touch shortly.",
    created_at: new Date(now - 60_000).toISOString(),
    read_at: null,
  };
}

export function createDemoState(): DemoState {
  return { applicationId: DEMO_APPLICATION_ID, submitted: false, submittedAt: null, saved: {}, messages: [], linked: 0, calls: [] };
}

const pipelineState = (s: DemoState) => (s.submitted ? "In Review" : "Draft");

function applicationSummary(s: DemoState) {
  return {
    id: s.applicationId,
    business_name: SAMPLE_BUSINESS.operatingName,
    product_category: "EQUIPMENT_FINANCE",
    requested_amount: SAMPLE_REQUEST.amount,
    pipeline_state: pipelineState(s),
    submitted_at: s.submittedAt,
    created_at: s.submittedAt ?? new Date().toISOString(),
    updated_at: s.submittedAt ?? new Date().toISOString(),
    source: "client_direct",
    signature_needed: false,
  };
}

function receivedDocuments() {
  return SAMPLE_DOCS.map((d) => ({
    id: `doc-${d.key}`,
    key: `upload:${d.category}:${d.key}`,
    kind: "document",
    label: d.label,
    category: d.category,
    filename: d.filename,
    status: "received",
  }));
}

function statusPayload(s: DemoState) {
  return {
    status: {
      applicationId: s.applicationId,
      pipelineState: pipelineState(s),
      processingStage: s.submitted ? "in_review" : "draft",
      updatedAt: s.submittedAt ?? new Date().toISOString(),
      // The wizard keeps "supply documents later" from what the server says after submit; without it the review
      // screen would send the client back to Step 5 for the moment before the portal opens.
      documentsDeferred: s.saved.documentsDeferred === true,
    },
  };
}

// [method, path pattern, handler]. Paths are matched without the host, so the shim answers whichever server address
// the build points at.
const ROUTES: Array<[string, RegExp, Handler]> = [
  // ---- Wizard ----
  ["POST", /^\/api\/public\/application\/start$/, (_r, s) => ok({ applicationId: s.applicationId, applicationToken: s.applicationId })],
  ["GET", /^\/api\/client\/lender-products$/, () => ok(sampleLenderProducts())],
  ["GET", /^\/api\/portal\/lender-products\/required-docs$/, () => ok({ items: SAMPLE_REQUIRED_DOCS })],
  ["GET", /^\/api\/public\/lender-count$/, () => ok({ count: SAMPLE_LENDERS.length })],
  ["GET", /^\/api\/client\/readiness-prefill$/, () => ok({ found: false })],
  ["POST", /^\/api\/client\/applications$/, (_r, s) => {
    // A linked (closing costs) application, only when the client says yes on Step 2.
    s.linked += 1;
    const id = `5a3c1d2e-7b4f-4c6a-9e8d-2f1b0c9a8e${String(71 + s.linked).padStart(2, "0")}`;
    return ok({ token: id, applicationId: id });
  }],
  ["PATCH", /^\/api\/client\/applications\/([^/]+)$/, (r, s) => {
    if (r.body && typeof r.body === "object") s.saved = { ...s.saved, ...(r.body as Record<string, unknown>) };
    return ok({ applicationId: r.params[0], saved: true });
  }],
  ["POST", /^\/api\/client\/applications\/([^/]+)\/submit$/, (r, s) => {
    s.submitted = true;
    s.submittedAt = s.submittedAt ?? new Date().toISOString();
    if (!s.messages.length) s.messages.push(welcomeMessage(Date.now()));
    return ok({ applicationId: s.applicationId, submissionId: s.applicationId, status: "submitted", submitted_at: s.submittedAt, id: r.params[0] });
  }],
  ["GET", /^\/api\/client\/application\/([^/]+)\/status$/, (_r, s) => ok(statusPayload(s))],
  ["POST", /^\/api\/client\/accountant$/, () => ok({ sent: true })],
  ["POST", /^\/api\/client\/documents\/upload$/, () => ok({ id: "demo-upload", status: "received" })],
  ["POST", /^\/api\/client\/(fraud-signals|submit-attempts|upload-failure)$/, () => ok({ recorded: true })],
  ["POST", /^\/api\/public\/wizard-block$/, () => ok({ recorded: true })],
  // Analytics and journey tracking are accepted and dropped: the demo records nothing.
  ["POST", /^\/api\/(analytics|track\/journey)$/, () => ok({ recorded: false })],

  // ---- Signed-in client ----
  ["GET", /^\/api\/auth\/me$/, () => ok({ id: "demo-client", role: "client", phone: "+17805550142", firstName: SAMPLE_CONTACT.firstName, lastName: SAMPLE_CONTACT.lastName })],

  // ---- Client portal ----
  ["GET", /^\/api\/client\/application-stage$/, (_r, s) => ok({
    pipeline_state: pipelineState(s),
    metadata: {
      businessName: SAMPLE_BUSINESS.operatingName,
      applicant: { firstName: SAMPLE_CONTACT.firstName, lastName: SAMPLE_CONTACT.lastName, email: SAMPLE_CONTACT.email, phone: SAMPLE_CONTACT.phone },
      business: { legalName: SAMPLE_BUSINESS.legalName, businessName: SAMPLE_BUSINESS.operatingName },
    },
  })],
  ["GET", /^\/api\/client\/messages$/, (_r, s) => ok(s.messages)],
  ["POST", /^\/api\/client\/messages$/, (r, s) => {
    const body = String((r.body as { body?: unknown } | null)?.body ?? "").trim();
    if (body) s.messages.push({ id: `demo-msg-${s.messages.length + 1}`, direction: "inbound", body, staff_name: null, created_at: new Date().toISOString(), read_at: null });
    return ok({ sent: true });
  }],
  ["POST", /^\/api\/client\/messages\/mark-read$/, () => ok({ marked: true })],
  ["GET", /^\/api\/client\/messages\/typing$/, () => ok({ typing: false })],
  ["POST", /^\/api\/client\/messages\/typing$/, () => ok({ typing: false })],
  ["GET", /^\/api\/client\/offers$/, () => ok({ items: [] })],
  ["GET", /^\/api\/client\/applications\/([^/]+)\/product-questions$/, () => ok({ missing: [] })],
  ["GET", /^\/api\/portal\/applications\/([^/]+)\/qa\/open$/, () => ok({ questions: [] })],
  ["GET", /^\/api\/client\/rejected-documents$/, () => ok({ items: receivedDocuments() })],
  ["GET", /^\/api\/client\/documents-needed\/needed$/, () => ok({ stillNeeded: [], rejected: [], received: receivedDocuments() })],
  ["GET", /^\/api\/client\/documents-needed\/action-center$/, () => ok({ outstanding: [], completed: receivedDocuments().map(({ key, kind, label }) => ({ key, kind, label })) })],
  ["GET", /^\/api\/client\/applications\/by-phone$/, (_r, s) => ok({ applications: s.submitted ? [applicationSummary(s)] : [] })],
  ["GET", /^\/api\/client\/advisor$/, () => ok({ advisor: { id: SAMPLE_ADVISOR.id, firstName: SAMPLE_ADVISOR.firstName, lastName: SAMPLE_ADVISOR.lastName, photoUrl: null, bookable: false } })],
  // No fee agreement or signing prompts in the demo.
  ["GET", /^\/api\/client\/signing-session$/, () => ok({ status: "not_ready" })],
  ["POST", /^\/api\/client\/signing-complete$/, () => ok({ signed: false })],
  ["GET", /^\/api\/client\/fee-agreement\/session$/, () => ok({ status: "not_needed" })],
  ["POST", /^\/api\/client\/fee-agreement\/complete$/, () => ok({ signed: false })],
  ["GET", /^\/api\/client\/application\/([^/]+)\/lender-responses$/, () => ok({ items: [] })],
  ["POST", /^\/api\/maya\/message$/, () => ok({ reply: "This is the sample file. In the real app I answer questions about the application, its documents and what happens next." })],
  ["POST", /^\/api\/client\/profile$/, () => ok({ saved: true })],
  ["GET", /^\/api\/client\/sms-updates$/, () => ok({ smsUpdates: true })],
  ["POST", /^\/api\/client\/sms-updates$/, (r) => ok({ smsUpdates: Boolean((r.body as { smsUpdates?: unknown } | null)?.smsUpdates) })],
  ["GET", /^\/api\/booking\/slots$/, () => ok({ slots: [] })],
];

function parseBody(body: unknown): unknown {
  if (typeof body !== "string") return body ?? null;
  try {
    return JSON.parse(body);
  } catch {
    return body;
  }
}

/** Answers one API call from the in-memory state. Never fails: unknown paths get {status:"ok", data:{}}. */
export function answer(state: DemoState, method: string, url: string, rawBody?: unknown): { status: number; body: Json } {
  const u = new URL(url, "https://live-demo.invalid");
  const m = method.toUpperCase();
  state.calls.push(`${m} ${u.pathname}`);
  for (const [verb, pattern, handler] of ROUTES) {
    if (verb !== m) continue;
    const hit = pattern.exec(u.pathname);
    if (!hit) continue;
    return { status: 200, body: handler({ method: m, path: u.pathname, query: u.searchParams, body: parseBody(rawBody), params: hit.slice(1).map(decodeURIComponent) }, state) };
  }
  // eslint-disable-next-line no-console
  console.debug("[live-demo] no sample answer for", m, u.pathname);
  return { status: 200, body: ok({}) };
}

/** True for a request the shim answers: any URL whose path starts with /api/, on any host. */
export function isApiUrl(url: string): boolean {
  try {
    return new URL(url, "https://live-demo.invalid").pathname.startsWith("/api/");
  } catch {
    return false;
  }
}

function requestParts(input: RequestInfo | URL, init?: RequestInit): { url: string; method: string; body: unknown } {
  if (typeof input === "string") return { url: input, method: init?.method ?? "GET", body: init?.body };
  if (input instanceof URL) return { url: input.href, method: init?.method ?? "GET", body: init?.body };
  return { url: input.url, method: init?.method ?? input.method ?? "GET", body: init?.body };
}

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/**
 * A fetch for the live demo. /api/... is answered from `state`; other same-origin requests (the app's own files) go
 * to the real fetch; anything else (analytics, third parties) gets an empty 200 and never leaves the browser.
 */
export function createDemoFetch(state: DemoState, realFetch?: typeof fetch, pageOrigin?: string): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const { url, method, body } = requestParts(input, init);
    if (isApiUrl(url)) {
      const res = answer(state, method, url, body);
      return jsonResponse(res.status, res.body);
    }
    const origin = pageOrigin ?? (typeof window !== "undefined" ? window.location.origin : "");
    let sameOrigin = false;
    try {
      sameOrigin = new URL(url, origin || "https://live-demo.invalid").origin === origin;
    } catch {
      sameOrigin = false;
    }
    if (sameOrigin && realFetch) return realFetch(input as RequestInfo, init);
    return jsonResponse(200, {});
  }) as typeof fetch;
}

// One state per page load: the demo restarts from the sample file on every reload.
let pageState: DemoState | null = null;
export function demoState(): DemoState {
  pageState = pageState ?? createDemoState();
  return pageState;
}

/** The fetch the /tour page uses (see early.ts). */
export function demoFetch(input: RequestInfo | URL, init: RequestInit | undefined, realFetch: typeof fetch): Promise<Response> {
  return createDemoFetch(demoState(), realFetch)(input, init);
}
