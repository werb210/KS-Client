// KS_CLIENT_v13_LOAN_CALCULATOR - "Loan calculator" on the More tab: the same calculator as the staff portal, without
// Save to file. Works entirely in the browser (no API calls), so the /tour demo needs nothing new.
// Fixed light colours (dark navy on white), like the rest of the phone portal, so every line stays readable.
import { useMemo, useState, type CSSProperties } from "react";
import {
  FREQUENCIES, amortize, isoDay, money, validateLoan, type Frequency, type LoanInput,
} from "@/lib/loanCalculator/amortization";
import { downloadFile, scheduleCsv, schedulePdf } from "@/lib/loanCalculator/exports";

const C = { text: "#0B1F3A", muted: "#51617D", border: "#CBD5E1", surface: "#FFFFFF", tint: "#F5F8FC", primary: "#0B1F3A", onPrimary: "#FFFFFF", errBg: "#FEF2F2", errText: "#7F1D1D", errBorder: "#FECACA" };

const overlay: CSSProperties = { position: "fixed", inset: 0, zIndex: 1000, background: "rgba(2, 6, 23, 0.55)", display: "flex", alignItems: "flex-end", justifyContent: "center" };
const panel: CSSProperties = {
  background: C.surface, color: C.text, width: "min(720px, 100vw)", maxHeight: "92vh", overflowY: "auto", borderRadius: "16px 16px 0 0",
  padding: "16px 16px calc(16px + env(safe-area-inset-bottom))", boxSizing: "border-box",
};
const label: CSSProperties = { display: "flex", flexDirection: "column", gap: 4, fontSize: 14, fontWeight: 600, color: C.text };
const input: CSSProperties = { border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 12px", fontSize: 16, background: C.surface, color: C.text, fontFamily: "inherit" };
const btn: CSSProperties = { border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 14px", fontSize: 15, fontWeight: 600, background: C.surface, color: C.text, cursor: "pointer", fontFamily: "inherit" };
const cell: CSSProperties = { padding: "6px 8px", textAlign: "right", whiteSpace: "nowrap", color: C.text };

const num = (s: string): number => Number(String(s).replace(/[^0-9.-]/g, ""));

export default function LoanCalculatorSheet({ onClose, initialAmount }: { onClose: () => void; initialAmount?: number | null }) {
  const [amount, setAmount] = useState(initialAmount && initialAmount > 0 ? String(Math.round(initialAmount * 100) / 100) : "");
  const [rate, setRate] = useState("10");
  const [term, setTerm] = useState("60");
  const [frequency, setFrequency] = useState<Frequency>("monthly");
  const [down, setDown] = useState("");
  const [balloon, setBalloon] = useState("");

  const loan: LoanInput = useMemo(() => ({
    amount: num(amount), annualRatePercent: num(rate), termMonths: num(term), frequency,
    downPayment: down.trim() ? num(down) : null, balloon: balloon.trim() ? num(balloon) : null, startDate: new Date(),
  }), [amount, rate, term, frequency, down, balloon]);
  const errors = useMemo(() => validateLoan(loan), [loan]);
  const result = useMemo(() => (errors.length ? null : amortize(loan)), [errors, loan]);

  return (
    <div style={overlay} role="dialog" aria-modal="true" aria-label="Loan calculator" onClick={onClose}>
      <div style={panel} onClick={(e) => e.stopPropagation()} data-testid="loan-calculator">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 20, color: C.text }}>Loan calculator</h2>
          <button type="button" style={btn} onClick={onClose}>Close</button>
        </div>
        <p style={{ margin: "0 0 12px", fontSize: 14, color: C.muted }}>An estimate only. Your lender's offer sets the actual rate and payments.</p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
          <label style={label}>Amount ($)<input style={input} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} aria-label="Amount" /></label>
          <label style={label}>Annual rate (%)<input style={input} inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} aria-label="Annual rate" /></label>
          <label style={label}>Term (months)<input style={input} inputMode="numeric" value={term} onChange={(e) => setTerm(e.target.value)} aria-label="Term in months" /></label>
          <label style={label}>Frequency
            <select style={input} value={frequency} onChange={(e) => setFrequency(e.target.value as Frequency)} aria-label="Frequency">
              {FREQUENCIES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </label>
          <label style={label}>Down payment ($, optional)<input style={input} inputMode="decimal" value={down} onChange={(e) => setDown(e.target.value)} aria-label="Down payment" /></label>
          <label style={label}>Balloon / residual ($, optional)<input style={input} inputMode="decimal" value={balloon} onChange={(e) => setBalloon(e.target.value)} aria-label="Balloon" /></label>
        </div>

        {errors.length > 0 && (
          <ul role="alert" style={{ margin: "12px 0 0", padding: "8px 12px 8px 28px", background: C.errBg, border: `1px solid ${C.errBorder}`, borderRadius: 10, color: C.errText, fontSize: 14 }}>
            {errors.map((e) => <li key={e}>{e}</li>)}
          </ul>
        )}

        {result && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 14 }} data-testid="loan-calculator-summary">
              {[
                ["Payment per period", money(result.payment)],
                ["Number of payments", String(result.numberOfPayments)],
                ["Total interest", money(result.totalInterest)],
                ["Total cost", money(result.totalCost)],
              ].map(([k, v]) => (
                <div key={k} style={{ border: `1px solid ${C.border}`, borderRadius: 12, padding: "10px 12px", background: C.tint }}>
                  <div style={{ fontSize: 13, color: C.muted }}>{k}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: C.text }}>{v}</div>
                </div>
              ))}
            </div>
            {result.balloon ? <p style={{ fontSize: 13, color: C.muted, margin: "8px 0 0" }}>The last payment includes the {money(result.balloon)} balloon.</p> : null}

            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
              <button type="button" style={{ ...btn, background: C.primary, color: C.onPrimary, borderColor: C.primary }} onClick={() => downloadFile(schedulePdf(loan, result), "loan-schedule.pdf", "application/pdf")}>Download PDF</button>
              <button type="button" style={btn} onClick={() => downloadFile(scheduleCsv(loan, result), "loan-schedule.csv", "text/csv;charset=utf-8")}>Download spreadsheet</button>
            </div>

            <div style={{ marginTop: 12, maxHeight: 320, overflow: "auto", border: `1px solid ${C.border}`, borderRadius: 10 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }} data-testid="loan-calculator-schedule">
                <thead style={{ position: "sticky", top: 0, background: C.surface }}>
                  <tr>{["#", "Date", "Payment", "Principal", "Interest", "Balance"].map((h) => <th key={h} style={{ ...cell, fontWeight: 700, borderBottom: `1px solid ${C.border}` }}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {result.schedule.map((s) => (
                    <tr key={s.number}>
                      <td style={cell}>{s.number}</td>
                      <td style={cell}>{isoDay(s.date)}</td>
                      <td style={cell}>{money(s.payment)}</td>
                      <td style={cell}>{money(s.principal)}</td>
                      <td style={cell}>{money(s.interest)}</td>
                      <td style={cell}>{money(s.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
