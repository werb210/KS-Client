// BF_CLIENT_v840_STEP1_NO_LOOP - a returning client's prefill must not make Step 1 redraw forever (it froze every
// dropdown and the amount box). Before the fix this test never finished.
import React, { Profiler } from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/api/readiness", () => ({
  fetchReadinessPrefill: vi.fn().mockResolvedValue({ found: true, prefill: { companyName: "Acme", business: { city: "Calgary" } } }),
}));
vi.mock("../../services/creditPrefill", () => ({ fetchCreditPrefill: vi.fn().mockResolvedValue(null) }));
vi.mock("../../utils/track", () => ({ track: vi.fn() }));
vi.mock("../../utils/analytics", () => ({ trackEvent: vi.fn() }));
vi.mock("../saveStepProgress", () => ({ persistApplicationStep: vi.fn() }));
vi.mock("react-router-dom", () => ({ useNavigate: () => vi.fn(), useParams: () => ({}), useLocation: () => ({ pathname: "/apply/step-1", search: "" }) }));

import { Step1_KYC } from "../Step1_KYC";

describe("Step 1 after a returning client signs in", () => {
  it("does not keep re-rendering after a returning client's prefill", async () => {
    // Keep the test off the network: on CI the real dev server answers and its lender list re-renders Step 1.
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ products: [] }), { status: 200, headers: { "Content-Type": "application/json" } })));
    sessionStorage.setItem("verified_phone", "+15875550100");
    let commits = 0;
    const el = document.createElement("div"); document.body.appendChild(el);
    const root = createRoot(el);
    await act(async () => { root.render(<Profiler id="s1" onRender={() => { commits++; }}><Step1_KYC /></Profiler>); });
    await act(async () => { await new Promise((r) => setTimeout(r, 300)); });
    const a = commits;
    await act(async () => { await new Promise((r) => setTimeout(r, 300)); });
    expect(commits - a).toBeLessThan(5);
    vi.unstubAllGlobals();
  }, 20_000);
});
