// KS_CLIENT_v13_LOAN_CALCULATOR - "Loan calculator" on the More tab: opens the calculator (no Save to file, no API).
import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import CmpMore, { type MoreForm } from "../CmpMore";
import LoanCalculatorSheet from "../LoanCalculatorSheet";

describe("Loan calculator on the More tab", () => {
  it("shows the row only when the page gives it a handler", () => {
    const onCalculator = vi.fn();
    const props = { forms: [] as MoreForm[], docsStatus: null as "needed" | "done" | null, onForm: vi.fn(), onUpload: vi.fn(), onNewApplication: vi.fn() };
    const { rerender } = render(<CmpMore {...props} />);
    expect(screen.queryByTestId("cmp-more-calculator")).toBeNull();
    rerender(<CmpMore {...props} onCalculator={onCalculator} />);
    fireEvent.click(screen.getByTestId("cmp-more-calculator"));
    expect(onCalculator).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Loan calculator")).toBeTruthy();
  });

  it("calculates from the requested amount, offers both downloads and no Save to file", () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    render(<LoanCalculatorSheet onClose={vi.fn()} initialAmount={120000} />);
    expect((screen.getByLabelText("Amount") as HTMLInputElement).value).toBe("120000");
    fireEvent.change(screen.getByLabelText("Annual rate"), { target: { value: "0" } });
    fireEvent.change(screen.getByLabelText("Term in months"), { target: { value: "12" } });
    expect(screen.getByTestId("loan-calculator-summary").textContent).toContain("$10,000.00");
    expect(screen.getByTestId("loan-calculator-schedule").querySelectorAll("tbody tr")).toHaveLength(12);
    expect(screen.getByText("Download PDF")).toBeTruthy();
    expect(screen.getByText("Download spreadsheet")).toBeTruthy();
    expect(screen.queryByText("Save to file")).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("explains a bad input", () => {
    render(<LoanCalculatorSheet onClose={vi.fn()} initialAmount={null} />);
    expect(screen.getByRole("alert").textContent).toContain("Enter an amount greater than 0.");
  });
});
