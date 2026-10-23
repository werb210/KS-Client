// KS_CLIENT_v8_PGI - the PGI question on Step 6, its optional details, and what goes in the submission.
import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { PgiSection } from "../PgiSection";
import { cleanPgiDetails } from "../pgi";
import { buildSubmissionPayload } from "../submission";
import type { ApplicationData } from "../../types/application";

const app = (over: Partial<ApplicationData> = {}) => ({
  kyc: {}, productCategory: null, matchPercentages: {}, eligibleProducts: [], eligibleCategories: [], eligibilityReasons: [],
  business: {}, applicant: {}, documents: {}, selectedProduct: { id: "p1", name: "X", product_type: "loan", lender_id: "L1" },
  selectedProductId: "p1", termsAccepted: true, ...over,
}) as unknown as ApplicationData;

describe("PGI on Step 6", () => {
  it("asks yes / no; details only after yes, all optional", () => {
    const update = vi.fn();
    const { rerender } = render(<PgiSection app={app()} update={update} />);
    expect(screen.getByText("Personal Guarantee Insurance (PGI)")).toBeTruthy();
    expect(screen.queryByTestId("step6-pgi-details")).toBeNull();
    fireEvent.click(screen.getByLabelText("Yes, send me PGI details with my offers"));
    expect(update).toHaveBeenCalledWith({ pgiOptIn: "yes" });

    rerender(<PgiSection app={app({ pgiOptIn: "yes", pgiDetails: { naics_code: "2362" } })} update={update} />);
    expect(screen.getByTestId("step6-pgi-details").textContent).toContain("Boreal Insurance");
    expect(screen.getByTestId("step6-pgi-details").textContent).toContain("optional");
    fireEvent.change(screen.getByTestId("pgi-loan-type"), { target: { value: "Commercial Mortgage" } });
    expect(update).toHaveBeenLastCalledWith({ pgiDetails: { naics_code: "2362", loan_type: "Commercial Mortgage" } });
    fireEvent.change(screen.getByLabelText("Industry code (NAICS, 6 digits)"), { target: { value: "23-62a20" } });
    expect(update).toHaveBeenLastCalledWith({ pgiDetails: { naics_code: "236220" } });

    rerender(<PgiSection app={app({ pgiOptIn: "no" })} update={update} />);
    expect(screen.queryByTestId("step6-pgi-details")).toBeNull();
  });

  it("the submission carries the filled-in details only when PGI is ticked", () => {
    const details = { loan_type: "Other Secured Loan", naics_code: " 236220 ", formation_date: "", guarantor_dob: "1980-02-03" };
    expect(buildSubmissionPayload(app({ pgiOptIn: "yes", pgiDetails: details })).pgi_details)
      .toEqual({ loan_type: "Other Secured Loan", naics_code: "236220", guarantor_dob: "1980-02-03" });
    expect(buildSubmissionPayload(app({ pgiOptIn: "no", pgiDetails: details })).pgi_details).toBeUndefined();
    expect(cleanPgiDetails({ naics_code: "  " })).toBeUndefined();
  });
});
