// KS_CLIENT_LICENSEE_DOCUMENTS
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

const h = vi.hoisted(() => ({ apiCall: vi.fn(), update: vi.fn() }));
vi.mock("../../api/client", () => ({ apiCall: (...a: unknown[]) => h.apiCall(...a) }));
vi.mock("../../api/clientApp", () => ({ ClientAppAPI: { update: (...a: unknown[]) => h.update(...a) } }));

import { ExtraQuestions, missingRequired, type ExtraQuestion } from "../ExtraQuestions";

const QS: ExtraQuestion[] = [
  { key: "fleet_size", label: "How many trucks?", type: "number", options: [], required: true },
  { key: "has_loan", label: "Existing equipment loan?", type: "yesno", options: [], required: false },
];

beforeEach(() => { h.apiCall.mockReset(); h.update.mockReset(); h.update.mockResolvedValue({}); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("the brokerage's extra questions", () => {
  it("shows nothing when there are none", async () => {
    h.apiCall.mockResolvedValue({ questions: [] });
    const { container } = render(<ExtraQuestions token="t" answers={{}} onChange={() => undefined} />);
    await act(async () => { await Promise.resolve(); });
    expect(container.innerHTML).toBe("");
  });

  it("asks each question, reports required ones left, and saves answers to the application", async () => {
    vi.useFakeTimers();
    h.apiCall.mockResolvedValue({ questions: QS });
    const onChange = vi.fn(), onMissing = vi.fn();
    render(<ExtraQuestions token="tok" answers={{}} onChange={onChange} onMissing={onMissing} />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(screen.getByLabelText("How many trucks? *")).toBeTruthy();
    expect(onMissing).toHaveBeenLastCalledWith(1);
    fireEvent.change(screen.getByLabelText("How many trucks? *"), { target: { value: "4" } });
    expect(onChange).toHaveBeenCalledWith({ fleet_size: "4" });
    await act(async () => { vi.advanceTimersByTime(700); });
    expect(h.update).toHaveBeenCalledWith("tok", { metadata: { extra_answers: { fleet_size: "4" } } });
  });

  it("counts only required questions without an answer", () => {
    expect(missingRequired(QS, { fleet_size: " " })).toBe(1);
    expect(missingRequired(QS, { fleet_size: "3" })).toBe(0);
  });

  it("a failed load holds submit and offers to try again", async () => {
    h.apiCall.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ questions: QS });
    const onMissing = vi.fn();
    render(<ExtraQuestions token="tok" answers={{}} onChange={() => undefined} onMissing={onMissing} />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(screen.getByTestId("extra-questions-failed")).toBeTruthy();
    expect(onMissing).toHaveBeenLastCalledWith(1);
    fireEvent.click(screen.getByText("Try again"));
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(screen.getByLabelText("How many trucks? *")).toBeTruthy();
  });

  it("saves the last answer when the step closes before the save delay", async () => {
    vi.useFakeTimers();
    h.apiCall.mockResolvedValue({ questions: QS });
    const { unmount } = render(<ExtraQuestions token="tok" answers={{}} onChange={() => undefined} />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    fireEvent.change(screen.getByLabelText("How many trucks? *"), { target: { value: "7" } });
    unmount();
    expect(h.update).toHaveBeenCalledWith("tok", { metadata: { extra_answers: { fleet_size: "7" } } });
  });
});
