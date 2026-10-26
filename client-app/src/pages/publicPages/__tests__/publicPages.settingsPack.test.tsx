// KS_CLIENT_SETTINGS_PACK_v1 - public booking pages, the survey page, and the cookie banner (tracking waits for consent;
// the choice is recorded).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const fetchMock = vi.fn();
const json = (body: unknown, status = 200) => Promise.resolve({ ok: status < 400, status, json: async () => body });

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  localStorage.clear();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const PAGE = { ok: true, company: "Acme Capital", team: false, staff: { id: "s1", firstName: "Jane", slug: "jane" },
  meetingTypes: [{ id: "t1", slug: "intro", name: "Intro call", description: null as string | null, duration_min: 45, kind: "video" }], timeZone: "America/Regina", zoneLabel: "Alberta time" };
const SLOTS = { slots: [{ startsAt: "2026-12-08T16:00:00.000Z", staffIds: ["s1"] }, { startsAt: "2026-12-08T17:00:00.000Z", staffIds: ["s1"] }] };

function route(path: string, el: JSX.Element, at: string) {
  return render(<MemoryRouter initialEntries={[at]}><Routes><Route path={path} element={el} /></Routes></MemoryRouter>);
}

describe("booking page", () => {
  it("books a meeting type at a chosen time; text reminders only with the box ticked", async () => {
    const { BookPage } = await import("../BookingPage");
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes("/api/booking/page/jane")) return json(PAGE);
      if (url.includes("/api/booking/slots")) return json(SLOTS);
      if (url.endsWith("/api/booking") && init?.method === "POST") return json({ ok: true, booking: { startsAt: "2026-12-08T17:00:00.000Z", staffFirstName: "Jane", kind: "teams", joinUrl: null } }, 201);
      return json({}, 404);
    });
    route("/book/:slug", <BookPage />, "/book/jane");
    expect(await screen.findByText("Book a time with Jane")).toBeTruthy();
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes("staff=s1&type=t1"))).toBe(true);
    fireEvent.click(await screen.findByText("11:00 a.m."));
    fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "Pat Lee" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "pat@x.test" } });
    fireEvent.click(screen.getByText("Book this time"));
    expect(await screen.findByTestId("booking-done")).toBeTruthy();
    const body = JSON.parse(String(fetchMock.mock.calls.find(([, i]) => (i as RequestInit | undefined)?.method === "POST")![1]!.body));
    expect(body).toMatchObject({ meetingTypeId: "t1", startsAt: "2026-12-08T17:00:00.000Z", staffId: "s1", name: "Pat Lee" });
    expect(body.sms_reminders).toBeUndefined();
    expect(body.casl_consent).toBeUndefined();
  });

  it("an unknown page says so", async () => {
    const { BookPage } = await import("../BookingPage");
    fetchMock.mockImplementation(() => json({ error: "not_found" }, 404));
    route("/book/:slug", <BookPage />, "/book/nobody");
    expect(await screen.findByText("This booking page doesn't exist.")).toBeTruthy();
  });

  it("the client's link cancels", async () => {
    const { ManageBookingPage } = await import("../BookingPage");
    const booking = { status: "booked", startsAt: "2026-12-08T16:00:00.000Z", durationMin: 45, kind: "teams", staffFirstName: "Jane", meetingName: "Intro call", meetingTypeId: "t1", staffId: "s1", joinUrl: null as string | null, canChange: true };
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url.endsWith("/cancel")) return json({ ok: true, status: "cancelled" });
      if (init?.method !== "POST") return json({ ok: true, company: "Acme", zoneLabel: "Alberta time", timeZone: "America/Regina", booking });
      return json({}, 404);
    });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    route("/book/manage/:token", <ManageBookingPage />, "/book/manage/tok_abcdefghijklmnopqrstuvwxyz");
    fireEvent.click(await screen.findByText("Cancel booking"));
    expect(await screen.findByText(/Your booking is cancelled/)).toBeTruthy();
  });
});

describe("survey page", () => {
  it("takes a score and comment; a 10 gets the review link", async () => {
    const SurveyPage = (await import("../SurveyPage")).default;
    fetchMock.mockImplementation((_url: string, init?: RequestInit) => init?.method === "POST"
      ? json({ ok: true, review_url: "https://g.page/r/acme/review" })
      : json({ ok: true, company: "Acme Capital", question: "How likely are you to recommend Acme Capital?", comment_prompt: "Why?", answered: false, score: null }));
    route("/survey/:token", <SurveyPage />, "/survey/tok_abcdefghijklmnopqrstuvwxyz?score=10");
    expect(await screen.findByText("How likely are you to recommend Acme Capital?")).toBeTruthy();
    expect(screen.getByRole("radio", { name: "10" }).getAttribute("aria-checked")).toBe("true");
    fireEvent.click(screen.getByText("Send"));
    expect(await screen.findByText("Leave a Google review")).toBeTruthy();
  });
});

describe("cookie banner", () => {
  it("no visitor tracking before consent; accepting records the choice and starts it", async () => {
    const { trackJourney, startJourney } = await import("@/lib/journey");
    const beacon = vi.fn(() => true);
    Object.defineProperty(navigator, "sendBeacon", { value: beacon, configurable: true });
    startJourney();
    trackJourney({ type: "pageview" });
    expect(beacon).not.toHaveBeenCalled();
    expect(localStorage.getItem("boreal_journey_session")).toBeNull();
    fetchMock.mockImplementation(() => json({ ok: true }, 201));
    const ConsentBanner = (await import("@/components/ConsentBanner")).default;
    render(<MemoryRouter><ConsentBanner /></MemoryRouter>);
    fireEvent.click(await screen.findByText("Accept"));
    await waitFor(() => expect(fetchMock.mock.calls.some(([u]) => String(u).includes("/api/privacy/consent"))).toBe(true));
    const sent = JSON.parse(String(fetchMock.mock.calls.find(([u]) => String(u).includes("/api/privacy/consent"))![1]!.body));
    expect(sent).toMatchObject({ surface: "client_app", choice: "granted", categories: { analytics: true, session_replay: true } });
    expect(beacon).toHaveBeenCalled();
  });

  it("declining records it and tracks nothing", async () => {
    const beacon = vi.fn(() => true);
    Object.defineProperty(navigator, "sendBeacon", { value: beacon, configurable: true });
    fetchMock.mockImplementation(() => json({ ok: true }, 201));
    const ConsentBanner = (await import("@/components/ConsentBanner")).default;
    render(<MemoryRouter><ConsentBanner /></MemoryRouter>);
    fireEvent.click(await screen.findByText("Decline"));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(JSON.parse(String(fetchMock.mock.calls[0]![1]!.body)).choice).toBe("denied");
    const { trackJourney } = await import("@/lib/journey");
    trackJourney({ type: "pageview" });
    expect(beacon).not.toHaveBeenCalled();
  });
});
