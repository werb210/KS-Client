// KS_CLIENT_v7_DEMO - the self-serve demo's borrower page: link parsing, one-tap sample uploads, sending to the broker,
// the assistant, readable colours and the build's CSP patch.
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import DemoBorrowerApp, { TEXT_PAIRS } from "../DemoBorrowerApp";
import { codeFromPath, isDemoBorrowerPath } from "../demoApi";
import { addConnectSrc, httpsOrigin, patchSwaConfig } from "../demoCsp";

function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * bl!;
  };
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x! + 0.05) / (y! + 0.05);
}

const samples = [
  { key: "bank_2026_09", label: "Bank statement - September 2026", hint: "Business chequing", filename: "Bank-Statement-2026-09-SAMPLE.pdf", uploaded: false, status: null as string | null },
  { key: "void_cheque", label: "Void cheque", hint: "For the lender's payments", filename: "Void-Cheque-SAMPLE.pdf", uploaded: false, status: null as string | null },
];

function fakeServer() {
  const state = {
    business: { name: "Juniper Hollow Millwork Ltd.", industry: "Manufacturing" }, contact: { name: "Sam Carter" },
    request: { amount: 250000, product: "Equipment financing", term_months: 60, purpose: "x" }, broker: { company: "BrokerCo", name: "Dana" },
    samples: samples.map((s) => ({ ...s })), messages: [] as Array<{ role: string; body: string; at: string }>, assistant_remaining: 3,
    borrower_submitted_at: null as string | null, lender_submitted_at: null as string | null,
  };
  const calls: string[] = [];
  const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });
  const fetchImpl = vi.fn(async (url: string, init: RequestInit = {}) => {
    const path = url.replace("https://demo.example", "");
    calls.push(`${init.method ?? "GET"} ${path}`);
    if (path === "/api/demo/client/session") {
      return JSON.parse(String(init.body)).code === "abcdefghjk" ? json({ client_token: "client-tok" }) : json({ error: "demo_link_invalid", message: "This demo link is not valid any more." }, 404);
    }
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer client-tok");
    if (path === "/api/demo/client/state") return json(state);
    const m = /^\/api\/demo\/client\/samples\/(.+)$/.exec(path);
    if (m) return new Response(new Blob([`%PDF-sample-${m[1]}`]), { status: 200, headers: { "content-type": "application/pdf" } });
    if (path === "/api/demo/client/documents") {
      const fd = init.body as FormData;
      const key = String(fd.get("sample_key"));
      expect(fd.get("via")).toBe("phone");
      expect(fd.get("file")).toBeTruthy();
      state.samples.find((s) => s.key === key)!.uploaded = true;
      return json({ document: { sample_key: key } }, 201);
    }
    if (path === "/api/demo/client/submit") { state.borrower_submitted_at = "2026-10-22T12:00:00Z"; return json(state); }
    if (path === "/api/demo/client/assistant") {
      state.messages = [{ role: "borrower", body: JSON.parse(String(init.body)).message, at: "" }, { role: "assistant", body: "Two to four business days.", at: "" }];
      return json({ reply: "Two to four business days.", messages: state.messages });
    }
    return json({ error: "unexpected" }, 500);
  }) as unknown as typeof fetch;
  return { fetchImpl, calls, state };
}

afterEach(() => { window.sessionStorage.clear(); });

describe("demo borrower link", () => {
  it("takes the code from /demo/<code> or /d/<code>", () => {
    expect(codeFromPath("/demo/AbCdEfGhJk")).toBe("abcdefghjk");
    expect(codeFromPath("/d/abcdefghjk/")).toBe("abcdefghjk");
    expect(codeFromPath("/demo/")).toBeNull();
    expect(codeFromPath("/demo/x")).toBeNull();
    expect(isDemoBorrowerPath("/demo/abc")).toBe(true);
    expect(isDemoBorrowerPath("/dashboard")).toBe(false);
  });
});

describe("demo borrower page", () => {
  it("uploads each sample with one tap, sends to the broker and asks the assistant", async () => {
    const { fetchImpl, calls } = fakeServer();
    render(<DemoBorrowerApp pathname="/demo/abcdefghjk" fetchImpl={fetchImpl} serverUrl="https://demo.example" />);
    expect(await screen.findByText("Hi Sam")).toBeTruthy();
    expect(screen.getByText(/BrokerCo/)).toBeTruthy();
    expect(screen.getByText("0 of 2 sent")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Upload Bank statement - September 2026" }));
    await waitFor(() => expect(screen.getByText("1 of 2 sent")).toBeTruthy());
    expect(calls).toContain("GET /api/demo/client/samples/bank_2026_09");
    expect(calls).toContain("POST /api/demo/client/documents");
    fireEvent.click(screen.getByRole("button", { name: "Upload all" }));
    await waitFor(() => expect(screen.getByText("2 of 2 sent")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Send to my broker" }));
    expect(await screen.findByText(/Sent to your broker/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Your question"), { target: { value: "How long?" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    expect(await screen.findByText("Two to four business days.")).toBeTruthy();
    // The borrower token is exchanged once and reused.
    expect(calls.filter((c) => c === "POST /api/demo/client/session")).toHaveLength(1);
  });

  it("an invalid or ended link says so", async () => {
    const { fetchImpl } = fakeServer();
    render(<DemoBorrowerApp pathname="/demo/zzzzzzzzzz" fetchImpl={fetchImpl} serverUrl="https://demo.example" />);
    expect((await screen.findByRole("alert")).textContent).toContain("This demo link has ended");
  });

  it("without the demo server set up it explains instead of failing silently", async () => {
    render(<DemoBorrowerApp pathname="/demo/abcdefghjk" fetchImpl={vi.fn() as unknown as typeof fetch} serverUrl="" />);
    expect((await screen.findByRole("alert")).textContent).toContain("not set up");
  });
});

describe("readable and reachable", () => {
  it("every text colour pair has at least 4.5:1 contrast", () => {
    for (const [fg, bg] of TEXT_PAIRS) expect({ fg, bg, ok: contrast(fg, bg) >= 4.5 }).toEqual({ fg, bg, ok: true });
  });

  it("the build adds the demo server to connect-src once (https only)", () => {
    expect(httpsOrigin("https://demo.example/path")).toBe("https://demo.example");
    expect(httpsOrigin("http://demo.example")).toBeNull();
    expect(addConnectSrc("default-src 'self'; connect-src 'self' https://a.example", "https://demo.example")).toBe("default-src 'self'; connect-src 'self' https://a.example https://demo.example");
    expect(addConnectSrc("connect-src 'self' https://demo.example", "https://demo.example")).toBe("connect-src 'self' https://demo.example");
    const out = JSON.parse(patchSwaConfig(JSON.stringify({ globalHeaders: { "Content-Security-Policy": "default-src 'self'" } }), "https://demo.example"));
    expect(out.globalHeaders["Content-Security-Policy"]).toBe("default-src 'self'; connect-src 'self' https://demo.example");
  });
});
