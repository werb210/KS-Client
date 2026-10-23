// KS_CLIENT_v8_PGI - Personal Guarantee Insurance on Step 6. Optional and never blocks the submit. When the client
// says yes, a few details the insurer needs can be given here (all optional); the brokerage refers the file to its
// insurance partner, and the client finishes the insurer's own form (ID and questions) from a link in their portal.
import type { CSSProperties } from "react";
import { components, layout, tokens } from "@/styles";
import { Input } from "../components/ui/Input";
import { brandName } from "@/config/brand";
import type { ApplicationData, PgiDetails } from "../types/application";
import { PGI_LOAN_TYPES, PGI_PARTNER_NAME } from "./pgi";

type Props = { app: ApplicationData; update: (patch: Partial<ApplicationData>) => void };

export function PgiSection({ app, update }: Props) {
  const details = app.pgiDetails ?? {};
  const set = (key: keyof PgiDetails, value: string) => update({ pgiDetails: { ...details, [key]: value } });
  const row = (selected: boolean): CSSProperties => ({
    display: "flex",
    alignItems: "flex-start",
    gap: tokens.spacing.sm,
    padding: `${tokens.spacing.sm} ${tokens.spacing.md}`,
    borderRadius: tokens.radii.md,
    border: `1px solid ${selected ? tokens.colors.accent : tokens.colors.border}`,
    background: selected ? tokens.colors.background : tokens.colors.surface,
    fontSize: tokens.typography.label.fontSize,
    color: tokens.colors.textPrimary,
    cursor: "pointer",
  });
  const field = (key: keyof PgiDetails, label: string, input: JSX.Element, help?: string) => (
    <div style={layout.stackTight} key={key}>
      <label style={components.form.label} htmlFor={`pgi-${key}`}>{label}</label>
      {input}
      {help ? <p style={components.form.helperText}>{help}</p> : null}
    </div>
  );
  return (
    <div data-testid="step6-pgi-section">
      <h2 style={components.form.sectionTitle}>Personal Guarantee Insurance (PGI)</h2>
      <p style={{ ...components.form.helperText, marginTop: tokens.spacing.xs }}>
        Most lenders ask for a personal guarantee - you are personally responsible if the business cannot repay. Personal Guarantee Insurance protects you if that happens.
      </p>
      <div style={{ ...layout.stackTight, marginTop: tokens.spacing.sm }}>
        {([
          ["yes", "Yes, send me PGI details with my offers"],
          ["no", "No, I will proceed without PGI"],
        ] as const).map(([value, label]) => {
          const selected = app.pgiOptIn === value;
          return (
            <label key={value} style={row(selected)}>
              <input
                type="radio"
                name="pgi-opt-in"
                value={value}
                checked={selected}
                onChange={() => update({ pgiOptIn: value })}
                style={{ width: 18, height: 18, marginTop: 1, flexShrink: 0, accentColor: tokens.colors.accent }}
              />
              <span>{label}</span>
            </label>
          );
        })}
      </div>
      {app.pgiOptIn === "yes" && (
        <div data-testid="step6-pgi-details" style={{ ...layout.stackTight, marginTop: tokens.spacing.md, padding: tokens.spacing.md, borderRadius: tokens.radii.md, border: `1px solid ${tokens.colors.border}`, background: tokens.colors.surface }}>
          <p style={{ ...components.form.helperText, margin: 0, color: tokens.colors.textPrimary }}>
            {brandName()} arranges PGI through its insurance partner, {PGI_PARTNER_NAME}. These details help the insurer quote faster. They are all optional - you can skip them and finish later on the insurer's form.
          </p>
          {field("loan_type", "Type of loan", (
            <select
              id="pgi-loan_type"
              data-testid="pgi-loan-type"
              value={details.loan_type ?? ""}
              onChange={(e) => set("loan_type", e.target.value)}
              style={{ ...components.inputs.base }}
            >
              <option value="">Not sure</option>
              {PGI_LOAN_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          ), "PGI covers commercial mortgages and other secured loans.")}
          {field("naics_code", "Industry code (NAICS, 6 digits)", (
            <Input id="pgi-naics_code" inputMode="numeric" maxLength={6} value={details.naics_code ?? ""} onChange={(e) => set("naics_code", e.target.value.replace(/\D/g, ""))} />
          ))}
          {field("formation_date", "Date the business started", (
            <Input id="pgi-formation_date" type="date" value={details.formation_date ?? ""} onChange={(e) => set("formation_date", e.target.value)} />
          ))}
          {field("guarantor_dob", "Your date of birth", (
            <Input id="pgi-guarantor_dob" type="date" value={details.guarantor_dob ?? ""} onChange={(e) => set("guarantor_dob", e.target.value)} />
          ))}
          {field("residential_address", "Your home address", (
            <Input id="pgi-residential_address" value={details.residential_address ?? ""} onChange={(e) => set("residential_address", e.target.value)} placeholder="Street, city, province, postal code" />
          ))}
        </div>
      )}
      <details style={{ marginTop: tokens.spacing.sm }}>
        <summary style={{ cursor: "pointer", color: tokens.colors.textSecondary, fontSize: tokens.typography.body.fontSize }}>
          Learn more about PGI
        </summary>
        <p style={{ ...components.form.helperText, marginTop: tokens.spacing.xs }}>
          PGI is optional insurance that covers your personal guarantee if your business defaults on the loan. The insurer sets the price and the cover; you can still say no when you see the quote. Choosing PGI never holds up your loan application.
        </p>
      </details>
    </div>
  );
}
