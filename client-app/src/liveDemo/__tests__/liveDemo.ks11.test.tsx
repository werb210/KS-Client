// KS_CLIENT_v11_LIVE_DEMO - the live demo (/tour): the sample server answers every call the wizard and the client
// portal make, the tour goes from Step 1 to the client portal pressing only Next (real wizard and portal screens), and
// messages go to the portal's origin only.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { answer, createDemoFetch, createDemoState, isApiUrl, type DemoState } from "../shim";
import { DEMO_APPLICATION_ID } from "../sample";
import {
  DEFAULT_PORTAL_ORIGIN,
  brokerSideUrl,
  isEmbedded,
  isLiveDemoPath,
  parentOriginFrom,
  postToParent,
} from "../mode";
import { TOUR_STEPS, resolveStep } from "../tour";

const API = "https://ks-server.example";

describe("the sample server", () => {
  const call = (s: DemoState, method: string, path: string, body?: unknown) => {
    const res = answer(s, method, API + path, body === undefined ? undefined : JSON.stringify(body));
    expect(res.status).toBe(200);
    return res.body as { status: string; data: any };
  };

  it("answers the wizard's calls", () => {
    const s = createDemoState();
    expect(call(s, "POST", "/api/public/application/start", {}).data.applicationId).toBe(DEMO_APPLICATION_ID);
    const products = call(s, "GET", "/api/client/lender-products?country=Canada").data as Array<{ category: string; country: string }>;
    expect(products).toHaveLength(6);
    expect(products.filter((p) => p.category === "EQUIPMENT")).toHaveLength(4);
    expect(call(s, "GET", "/api/portal/lender-products/required-docs?country=CA&product_category=EQUIPMENT").data.items.length).toBeGreaterThan(0);
    expect(call(s, "GET", "/api/public/lender-count").data.count).toBe(6);
    expect(call(s, "PATCH", `/api/client/applications/${DEMO_APPLICATION_ID}`, { current_step: 3 }).data.saved).toBe(true);
    expect(s.saved.current_step).toBe(3);
    expect(call(s, "GET", `/api/client/application/${DEMO_APPLICATION_ID}/status`).data.status.pipelineState).toBe("Draft");
    expect(call(s, "POST", "/api/client/applications", {}).data.token).toMatch(/^[0-9a-f-]{36}$/);
    expect(call(s, "POST", `/api/client/applications/${DEMO_APPLICATION_ID}/submit`, {}).data.applicationId).toBe(DEMO_APPLICATION_ID);
    expect(s.submitted).toBe(true);
    expect(call(s, "GET", `/api/client/application/${DEMO_APPLICATION_ID}/status`).data.status).toMatchObject({ applicationId: DEMO_APPLICATION_ID, pipelineState: "In Review" });
  });

  it("answers the client portal's calls: in review, every document received, a welcome from the broker, nothing to sign", () => {
    const s = createDemoState();
    call(s, "POST", `/api/client/applications/${DEMO_APPLICATION_ID}/submit`, {});
    const q = `?applicationId=${DEMO_APPLICATION_ID}`;
    expect(call(s, "GET", `/api/client/application-stage${q}`).data.pipeline_state).toBe("In Review");
    const messages = call(s, "GET", `/api/client/messages${q}`).data as Array<{ direction: string; staff_name: string; body: string }>;
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ direction: "outbound", staff_name: "Alex Morgan" });
    expect(messages[0]!.body).toMatch(/all 6 of your documents/);
    expect(call(s, "GET", `/api/client/offers${q}`).data.items).toEqual([]);
    expect(call(s, "GET", `/api/client/applications/${DEMO_APPLICATION_ID}/product-questions`).data.missing).toEqual([]);
    expect(call(s, "GET", `/api/portal/applications/${DEMO_APPLICATION_ID}/qa/open`).data.questions).toEqual([]);
    expect((call(s, "GET", `/api/client/rejected-documents${q}`).data.items as Array<{ status: string }>).every((d) => d.status === "received")).toBe(true);
    expect(call(s, "GET", `/api/client/documents-needed/needed${q}`).data).toMatchObject({ stillNeeded: [], rejected: [] });
    const todo = call(s, "GET", `/api/client/documents-needed/action-center${q}`).data;
    expect(todo.outstanding).toEqual([]);
    expect(todo.completed).toHaveLength(6);
    expect(call(s, "GET", "/api/client/applications/by-phone?includeDrafts=true").data.applications[0]).toMatchObject({ id: DEMO_APPLICATION_ID, pipeline_state: "In Review", signature_needed: false });
    expect(call(s, "GET", `/api/client/advisor${q}`).data.advisor).toMatchObject({ firstName: "Alex", lastName: "Morgan" });
    expect(call(s, "GET", `/api/client/signing-session${q}`).data.status).not.toBe("ready");
    expect(call(s, "POST", `/api/client/signing-complete${q}`).data.signed).toBe(false);
    expect(call(s, "GET", `/api/client/fee-agreement/session${q}`).data.status).not.toBe("ready");
    expect(call(s, "GET", `/api/client/messages/typing${q}`).data.typing).toBe(false);
    call(s, "POST", "/api/client/messages", { applicationId: DEMO_APPLICATION_ID, body: "Thanks!", direction: "inbound" });
    expect((call(s, "GET", `/api/client/messages${q}`).data as unknown[]).length).toBe(2);
  });

  it("answers every other API path with 200, never a refusal", async () => {
    const s = createDemoState();
    const debug = vi.spyOn(console, "debug").mockImplementation(() => undefined);
    expect(answer(s, "GET", API + "/api/something/new?x=1").body).toEqual({ status: "ok", data: {} });
    expect(debug).toHaveBeenCalled();
    const f = createDemoFetch(s, undefined, "https://client.example");
    const res = await f(API + "/api/client/whatever", { method: "DELETE" });
    expect(res.status).toBe(200);
    // Third-party requests never leave the browser.
    const third = await f("https://www.google-analytics.com/g/collect", { method: "POST" });
    expect(third.status).toBe(200);
    expect(isApiUrl("/api/x")).toBe(true);
    expect(isApiUrl("/assets/app.js")).toBe(false);
    debug.mockRestore();
  });
});

describe("live demo mode and the parent page", () => {
  it("runs on /tour only", () => {
    expect(isLiveDemoPath("/tour")).toBe(true);
    expect(isLiveDemoPath("/tour/")).toBe(true);
    expect(isLiveDemoPath("/tours")).toBe(false);
    expect(isLiveDemoPath("/demo/abc")).toBe(false);
    expect(isLiveDemoPath("/apply/step-1")).toBe(false);
  });

  it("accepts only the portal's exact origin as the parent", () => {
    const enc = encodeURIComponent;
    expect(parentOriginFrom(`?embed=1&parent=${enc(DEFAULT_PORTAL_ORIGIN)}`)).toBe(DEFAULT_PORTAL_ORIGIN);
    expect(parentOriginFrom(`?parent=${enc("https://evil.example")}`)).toBeNull();
    expect(parentOriginFrom(`?parent=${enc(DEFAULT_PORTAL_ORIGIN + "/demo")}`)).toBeNull();
    expect(parentOriginFrom(`?parent=${enc("http://thankful-wave-04964490f.2.azurestaticapps.net")}`)).toBeNull();
    expect(parentOriginFrom("?parent=javascript:alert(1)")).toBeNull();
    expect(parentOriginFrom("?embed=1")).toBeNull();
    expect(parentOriginFrom(`?parent=${enc("http://localhost:5173")}`)).toBe("http://localhost:5173");
    expect(parentOriginFrom(`?parent=${enc("https://portal.licensee.example")}`, ["https://portal.licensee.example"])).toBe("https://portal.licensee.example");
  });

  it("posts only to the given parent origin, and only when embedded", () => {
    const postMessage = vi.fn();
    const parent = { postMessage } as unknown as Window;
    const win = { parent } as unknown as Window;
    const msg = { type: "ks-live-demo", event: "client-done" } as const;
    expect(postToParent(msg, { origin: DEFAULT_PORTAL_ORIGIN, embedded: true, win })).toBe(true);
    expect(postMessage).toHaveBeenCalledWith(msg, DEFAULT_PORTAL_ORIGIN);
    postMessage.mockClear();
    expect(postToParent(msg, { origin: null, embedded: true, win })).toBe(false);
    expect(postToParent(msg, { origin: DEFAULT_PORTAL_ORIGIN, embedded: false, win })).toBe(false);
    expect(postMessage).not.toHaveBeenCalled();
    expect(isEmbedded("?embed=1", win)).toBe(true);
    expect(isEmbedded("?embed=0", win)).toBe(false);
    expect(isEmbedded("?embed=1", window)).toBe(false);
    expect(brokerSideUrl(DEFAULT_PORTAL_ORIGIN)).toBe(`${DEFAULT_PORTAL_ORIGIN}/demo?broker=1`);
    expect(brokerSideUrl(null)).toBe(`${DEFAULT_PORTAL_ORIGIN}/demo?broker=1`);
  });

  it("follows the screen the client is on", () => {
    const at = (path: string, from = 0) => TOUR_STEPS[resolveStep(TOUR_STEPS, from, path)]?.key;
    expect(at("/apply/step-1")).toBe("step1");
    expect(at("/apply/step-3", 0)).toBe("step3");
    expect(at("/apply/step-2", 5)).toBe("step2");
    expect(at(`/application/${DEMO_APPLICATION_ID}`, 6)).toBe("portal_status");
    expect(resolveStep(TOUR_STEPS, 0, "/")).toBe(-1);
  });
});

describe("the tour over the real client app", () => {
  let state: DemoState;
  const realFetch = globalThis.fetch;
  const realScrollTo = window.scrollTo;

  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    state = createDemoState();
    globalThis.fetch = createDemoFetch(state, undefined, window.location.origin);
    window.scrollTo = (() => undefined) as typeof window.scrollTo;
  });
  afterEach(() => {
    cleanup();
    globalThis.fetch = realFetch;
    window.scrollTo = realScrollTo;
  });

  it("Back returns to the previous screen and its pop-up", async () => {
    const { prepareLiveDemo } = await import("../bootLiveDemo");
    const { default: LiveDemoApp } = await import("../LiveDemoApp");
    prepareLiveDemo();
    render(<LiveDemoApp parentOrigin={null} embedded={false} initialPath="/apply/step-3" />);
    const currentStep = () => screen.getByTestId("live-demo-tour").getAttribute("data-step");
    await waitFor(() => expect(currentStep()).toBe("step3"));
    fireEvent.click(screen.getByTestId("live-demo-back"));
    // The deposit question is the app's own pop-up: Back goes to the Step 2 screen itself.
    await waitFor(() => expect(currentStep()).toBe("step2"));
    expect(await screen.findByText("Choose Product Category")).toBeTruthy();
  }, 30000);

  it("goes from Step 1 to the client portal pressing only Next, then hands over to the portal", async () => {
    const { prepareLiveDemo } = await import("../bootLiveDemo");
    const { default: LiveDemoApp } = await import("../LiveDemoApp");
    prepareLiveDemo();
    const postMessage = vi.spyOn(window.parent, "postMessage").mockImplementation(() => undefined);
    const openTop = vi.fn();
    render(<LiveDemoApp parentOrigin={DEFAULT_PORTAL_ORIGIN} embedded={false} openTop={openTop} />);

    const seen: string[] = [];
    const currentStep = () => screen.getByTestId("live-demo-tour").getAttribute("data-step") ?? "";
    await waitFor(() => expect(currentStep()).toBe("step1"));
    for (let i = 0; i < 20 && currentStep() !== "broker_handoff"; i += 1) {
      const before = currentStep();
      seen.push(before);
      await act(async () => {
        fireEvent.click(screen.getByTestId("live-demo-next"));
      });
      await waitFor(() => expect(currentStep()).not.toBe(before), { timeout: 12000 });
    }
    seen.push(currentStep());

    expect(seen).toEqual([
      "step1", "step2", "closing_costs", "step3", "step4", "step5", "step6",
      "portal_status", "portal_chat", "portal_documents", "broker_handoff",
    ]);
    // The real client portal is showing the submitted sample file.
    expect(state.submitted).toBe(true);
    expect(screen.getByTestId("cmp-status-stage").textContent).toMatch(/In Review/);
    expect(screen.getByText(/all 6 of your documents came through/)).toBeTruthy();
    expect(screen.queryByTestId("action-center")).toBeNull();
    // Every call the wizard and portal made was answered by the sample server.
    expect(state.calls).toEqual(expect.arrayContaining([
      "GET /api/client/lender-products",
      `POST /api/client/applications/${DEMO_APPLICATION_ID}/submit`,
      "GET /api/client/application-stage",
      "GET /api/client/documents-needed/action-center",
    ]));

    // Not embedded: "Show me the broker side" opens the portal's broker demo; nothing is posted.
    fireEvent.click(screen.getByTestId("live-demo-broker"));
    expect(openTop).toHaveBeenCalledWith(`${DEFAULT_PORTAL_ORIGIN}/demo?broker=1`);
    expect(postMessage).not.toHaveBeenCalled();
    postMessage.mockRestore();
  }, 60000);
});
