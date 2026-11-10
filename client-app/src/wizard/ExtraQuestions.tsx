// KS_CLIENT_LICENSEE_DOCUMENTS - questions on the brokerage's own application form (or agreement) that the standard
// application does not ask. Set up by the brokerage in Settings > Your documents; answers go to the application's
// metadata.extra_answers and fill the brokerage's form. Nothing shows when there are none.
import { useEffect, useRef, useState } from "react";
import { apiCall } from "../api/client";
import { ClientAppAPI } from "../api/clientApp";
import { Card } from "../components/ui/Card";
import { components, tokens } from "@/styles";
import { t as tr } from "@/i18n";

export type ExtraQuestion = { key: string; label: string; type: "text" | "yesno" | "choice" | "date" | "number"; options: string[]; required: boolean };
type Answers = Record<string, string>;

export function missingRequired(questions: ExtraQuestion[], answers: Answers): number {
  return questions.filter((q) => q.required && !String(answers[q.key] ?? "").trim()).length;
}

export function ExtraQuestions({ token, answers, onChange, onMissing }: { token: string | undefined; answers: Answers; onChange: (a: Answers) => void; onMissing?: (n: number) => void }) {
  const [questions, setQuestions] = useState<ExtraQuestion[]>([]);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<Answers | null>(null);

  useEffect(() => {
    let live = true;
    apiCall<{ questions?: ExtraQuestion[] }>("/api/client/extra-questions")
      .then((r) => { if (live) { setQuestions(Array.isArray(r?.questions) ? r.questions : []); setFailed(false); } })
      .catch(() => { if (live) setFailed(true); }); // review fix: a failed load is not "no questions"
    return () => { live = false; };
  }, [attempt]);

  // Until the questions load, submit waits (a required one may be among them).
  useEffect(() => { onMissing?.(failed ? 1 : missingRequired(questions, answers)); }, [questions, answers, failed, onMissing]);
  // Review fix: leaving the step within the save delay still saves the last answer.
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
    if (pending.current && token) void ClientAppAPI.update(token, { metadata: { extra_answers: pending.current } }).catch((): void => undefined);
  }, [token]);

  const set = (key: string, value: string) => {
    const next = { ...answers, [key]: value };
    onChange(next);
    if (!token) return;
    if (timer.current) clearTimeout(timer.current);
    pending.current = next;
    timer.current = setTimeout(() => { pending.current = null; void ClientAppAPI.update(token, { metadata: { extra_answers: next } }).catch((): void => undefined); }, 600);
  };

  if (failed) {
    return (
      <Card style={{ marginBottom: tokens.spacing.lg }} data-testid="extra-questions-failed">
        <div>{tr("We couldn't load a few questions from your advisor.")}{" "}
          <button type="button" onClick={() => setAttempt((n) => n + 1)}>{tr("Try again")}</button>
        </div>
      </Card>
    );
  }
  if (!questions.length) return null;
  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: tokens.spacing.md, marginBottom: tokens.spacing.lg }} data-testid="extra-questions">
      <h2 style={components.form.sectionTitle}>{tr("A few more questions")}</h2>
      {questions.map((q) => {
        const id = `extra-${q.key}`;
        const value = answers[q.key] ?? "";
        const labelText = `${q.label}${q.required ? " *" : ""}`;
        return (
          <div key={q.key} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label htmlFor={id}>{labelText}</label>
            {q.type === "yesno" ? (
              <select id={id} value={value} onChange={(e) => set(q.key, e.target.value)}>
                <option value="">{tr("Select...")}</option>
                <option value="Yes">{tr("Yes")}</option>
                <option value="No">{tr("No")}</option>
              </select>
            ) : q.type === "choice" && q.options.length ? (
              <select id={id} value={value} onChange={(e) => set(q.key, e.target.value)}>
                <option value="">{tr("Select...")}</option>
                {q.options.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : (
              <input id={id} type={q.type === "date" ? "date" : q.type === "number" ? "number" : "text"} value={value} onChange={(e) => set(q.key, e.target.value)} />
            )}
          </div>
        );
      })}
    </Card>
  );
}
