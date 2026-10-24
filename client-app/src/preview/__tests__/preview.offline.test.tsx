// KS_CLIENT_PREVIEW_APP_v1 - the Keystone Preview app sends nothing to any server. The guard refuses every outside
// request (fetch, XHR, WebSocket, EventSource, beacons, server-talking native plugins), and a full tap-through of the
// real client app - wizard Step 1 to Submit, the client portal's Home, Chat and More tabs, the documents and the loan
// calculator - is answered on the device without one request leaving it.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useLocation } from "react-router-dom";
import { createDemoState } from "../../liveDemo/shim";
import { DEMO_APPLICATION_ID } from "../../liveDemo/sample";
import {
  PreviewNetworkError, createPreviewFetch, guardNativeBridge, installPreviewGuards, isLocalUrl, pluginDenied, type PreviewLog,
} from "../guard";
import { PREVIEW_BANNER_TEXT, isPreviewBuild } from "../mode";

const IOS_PAGE = { protocol: "capacitor:", host: "localhost", href: "capacitor://localhost/index.html" };
const newLog = (): PreviewLog => ({ blocked: [], answered: [] });

describe("the preview build flag", () => {
  it("is on only for VITE_KS_PREVIEW=1", () => {
    expect(isPreviewBuild({ VITE_KS_PREVIEW: "1" })).toBe(true);
    expect(isPreviewBuild({ VITE_KS_PREVIEW: "0" })).toBe(false);
    expect(isPreviewBuild({})).toBe(false);
  });
});

describe("the network lock", () => {
  it("answers /api on the device whatever host it names, loads the app's own files, and refuses everything else", async () => {
    const real = vi.fn(async () => new Response("asset"));
    const log = newLog();
    const f = createPreviewFetch(createDemoState(), real as unknown as typeof fetch, IOS_PAGE, log);

    const api = await f("https://ks-server.example/api/client/lender-products?country=CA");
    expect(api.status).toBe(200);
    expect(((await api.json()) as { status: string }).status).toBe("ok");
    expect(await (await f("https://preview.keystone.invalid/api/auth/me")).json()).toMatchObject({ status: "ok" });
    expect(real).not.toHaveBeenCalled();

    expect(await (await f("/assets/app.js")).text()).toBe("asset");
    expect(await (await f("capacitor://localhost/icons/x.png")).text()).toBe("asset");
    expect(real).toHaveBeenCalledTimes(2);

    for (const outside of [
      "https://fonts.googleapis.com/css2?family=Inter",
      "https://www.google-analytics.com/g/collect",
      "https://ks-server.example/socket",
      "http://localhost:8080/x",
    ]) {
      await expect(f(outside)).rejects.toBeInstanceOf(PreviewNetworkError);
    }
    await expect(f(new Request("https://evil.example/upload", { method: "POST", body: "x" }))).rejects.toBeInstanceOf(PreviewNetworkError);
    expect(real).toHaveBeenCalledTimes(2);
    expect(log.blocked).toHaveLength(5);
    expect(log.answered).toEqual(["GET /api/client/lender-products", "GET /api/auth/me"]);
  });

  it("treats only the app's own scheme and host, blob: and data: as local", () => {
    expect(isLocalUrl("/index.html", IOS_PAGE)).toBe(true);
    expect(isLocalUrl("blob:capacitor://localhost/1234", IOS_PAGE)).toBe(true);
    expect(isLocalUrl("data:text/plain,hi", IOS_PAGE)).toBe(true);
    expect(isLocalUrl("https://localhost/index.html", IOS_PAGE)).toBe(false);
    expect(isLocalUrl("https://localhost/index.html", { protocol: "https:", host: "localhost", href: "https://localhost/" })).toBe(true);
    expect(isLocalUrl("https://localhost.evil.example/", { protocol: "https:", host: "localhost", href: "https://localhost/" })).toBe(false);
  });

  it("refuses the native plugin calls that would reach a server by themselves", async () => {
    const nativePromise = vi.fn(async () => ({ ok: true }));
    const nativeCallback = vi.fn(() => "cb-1");
    const win = { Capacitor: { nativePromise, nativeCallback } };
    const log = newLog();
    expect(guardNativeBridge(win, log)).toBe(true);
    const cap = win.Capacitor as unknown as { nativePromise: (p: string, m: string, o?: unknown) => Promise<unknown>; nativeCallback: (p: string, m: string, o?: unknown, cb?: (r: unknown, e?: unknown) => void) => string };

    await expect(cap.nativePromise("PushNotifications", "register")).rejects.toBeInstanceOf(PreviewNetworkError);
    await expect(cap.nativePromise("ClientWidget", "update", { token: "t", apiBase: "https://x" })).rejects.toBeInstanceOf(PreviewNetworkError);
    await expect(cap.nativePromise("ApplicationStatus", "start")).rejects.toBeInstanceOf(PreviewNetworkError);
    await expect(cap.nativePromise("BackgroundUpload", "enqueue")).rejects.toBeInstanceOf(PreviewNetworkError);
    const cb = vi.fn();
    expect(cap.nativeCallback("BackgroundUpload", "watch", {}, cb)).toBe("");
    expect(cb).toHaveBeenCalledWith(null, expect.any(PreviewNetworkError));
    expect(nativePromise).not.toHaveBeenCalled();
    expect(nativeCallback).not.toHaveBeenCalled();

    // Local-only plugins still work (camera, preferences, permissions checks).
    await expect(cap.nativePromise("Preferences", "get", { key: "a" })).resolves.toEqual({ ok: true });
    await expect(cap.nativePromise("PushNotifications", "checkPermissions")).resolves.toEqual({ ok: true });
    expect(pluginDenied("Camera", "getPhoto")).toBe(false);
    expect(log.blocked).toEqual([
      "native PushNotifications.register", "native ClientWidget.update", "native ApplicationStatus.start",
      "native BackgroundUpload.enqueue", "native BackgroundUpload.watch",
    ]);
  });
});

type Saved = Pick<typeof globalThis, "fetch" | "XMLHttpRequest" | "WebSocket" | "EventSource">;

describe("the Keystone Preview app, tapped through end to end", () => {
  let saved: Saved;
  let beacon: PropertyDescriptor | undefined;
  const realScrollTo = window.scrollTo;

  beforeEach(() => {
    saved = { fetch: globalThis.fetch, XMLHttpRequest: globalThis.XMLHttpRequest, WebSocket: globalThis.WebSocket, EventSource: (globalThis as Saved).EventSource };
    beacon = Object.getOwnPropertyDescriptor(window.navigator, "sendBeacon");
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.scrollTo = (() => undefined) as typeof window.scrollTo;
  });
  afterEach(() => {
    cleanup();
    Object.assign(globalThis, saved);
    if (beacon) Object.defineProperty(window.navigator, "sendBeacon", beacon);
    else delete (window.navigator as { sendBeacon?: unknown }).sendBeacon;
    window.scrollTo = realScrollTo;
  });

  it("closes XHR, WebSocket, EventSource and beacons to the outside", () => {
    if (!("sendBeacon" in window.navigator)) Object.defineProperty(window.navigator, "sendBeacon", { configurable: true, value: () => true });
    const real = vi.fn(async () => new Response(""));
    const { log } = installPreviewGuards(window as Window & typeof globalThis, { realFetch: real as unknown as typeof fetch });
    const xhr = new XMLHttpRequest();
    expect(() => xhr.open("POST", "https://ks-server.example/api/client/documents/upload")).toThrow(PreviewNetworkError);
    expect(() => new XMLHttpRequest().open("GET", "/index.html")).not.toThrow();
    expect(() => new WebSocket("wss://ks-server.example/api/ws")).toThrow(PreviewNetworkError);
    expect(() => new (globalThis as Saved).EventSource("https://ks-server.example/api/events")).toThrow(PreviewNetworkError);
    expect(window.navigator.sendBeacon("https://ks-server.example/api/track/journey", "x")).toBe(false);
    expect(log.blocked).toHaveLength(4);
    expect(real).not.toHaveBeenCalled();
  });

  it("goes from Step 1 to the client portal, its documents, the More tab and the loan calculator with no request leaving the device", async () => {
    // Every request that would leave the app reaches this spy; the test fails if any does.
    const outside: string[] = [];
    const real = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (!isLocalUrl(url, window.location)) outside.push(url);
      return new Response("");
    });
    const { log, state } = installPreviewGuards(window as Window & typeof globalThis, { realFetch: real as unknown as typeof fetch });

    const { prepareLiveDemo } = await import("../../liveDemo/bootLiveDemo");
    const { default: PreviewApp } = await import("../PreviewApp");
    const { TOUR_STEPS, resolveStep, stepFits } = await import("../../liveDemo/tour");
    prepareLiveDemo();

    let path = "";
    function PathProbe(): null {
      path = useLocation().pathname;
      return null;
    }
    render(<PreviewApp><PathProbe /></PreviewApp>);
    expect(screen.getByTestId("preview-banner").textContent).toContain(PREVIEW_BANNER_TEXT);
    await waitFor(() => expect(path).toBe("/apply/step-1"));

    // The wizard, pressing what the client would press on each screen (the live demo's own step actions).
    const ctx = { path: () => path };
    let at = 0;
    for (let n = 0; n < 20; n += 1) {
      await waitFor(() => expect(resolveStep(TOUR_STEPS, at, path)).toBeGreaterThanOrEqual(0), { timeout: 12000 });
      at = resolveStep(TOUR_STEPS, at, path);
      const step = TOUR_STEPS[at]!;
      if (step.key === "portal_status") break;
      await act(async () => {
        await step.action?.(ctx);
      });
      const from = at;
      await waitFor(() => expect(stepFits(TOUR_STEPS, from + 1, path) || resolveStep(TOUR_STEPS, from, path) > from).toBe(true), { timeout: 12000 });
      at = stepFits(TOUR_STEPS, from + 1, path) ? from + 1 : resolveStep(TOUR_STEPS, from, path);
    }

    // The client portal on the submitted sample file.
    expect(path).toBe(`/application/${DEMO_APPLICATION_ID}`);
    expect(state.submitted).toBe(true);
    await waitFor(() => expect(screen.getByTestId("cmp-status-stage").textContent).toMatch(/In Review/), { timeout: 15000 });
    fireEvent.click(screen.getByTestId("cmp-tab-chat"));
    expect(await screen.findByText(/all 6 of your documents came through/)).toBeTruthy();
    fireEvent.click(screen.getByTestId("cmp-tab-more"));
    expect(await screen.findByTestId("cmp-more")).toBeTruthy();
    fireEvent.click(await screen.findByTestId("cmp-more-calculator"));
    expect(await screen.findByTestId("loan-calculator")).toBeTruthy();
    expect(screen.getByTestId("loan-calculator-summary")).toBeTruthy();
    fireEvent.click(screen.getByTestId("cmp-tab-settings"));
    fireEvent.click(screen.getByTestId("cmp-tab-home"));
    await new Promise((r) => setTimeout(r, 300));

    // Everything the app asked for was answered on the device; nothing went out, nothing even had to be refused.
    expect(state.calls).toEqual(expect.arrayContaining([
      "GET /api/client/lender-products",
      `POST /api/client/applications/${DEMO_APPLICATION_ID}/submit`,
      "GET /api/client/documents-needed/action-center",
    ]));
    expect(log.answered.length).toBeGreaterThan(10);
    expect(outside).toEqual([]);
    expect(log.blocked).toEqual([]);
  }, 90000);
});
