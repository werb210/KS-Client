// KS_CLIENT_v11_LIVE_DEMO - the pop-ups ("coach marks") over the real client app: a spotlight on what is being
// explained and a small card with a title, one or two sentences, Back and Next. The overlay never blocks the app (only
// the card takes taps), so real taps keep working and the tour follows them.
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { TOUR_STEPS, resolveStep, stepFits, waitUntil, type TourStep } from "./tour";
import { LIVE_DEMO_TAG, brokerSideUrl, commandFrom, postToParent } from "./mode";

export type TourOverlayProps = {
  /** The portal's origin (validated), or null. */
  parentOrigin: string | null;
  /** Shown inside the portal's phone frame. */
  embedded: boolean;
  /** KS_CLIENT_v11_LIVE_DEMO: the portal's side panel shows the text and buttons (?panel=1). */
  sidePanel?: boolean;
  steps?: TourStep[];
  /** How "Show me the broker side" leaves when the demo is open on its own (tests replace it). */
  openTop?: (url: string) => void;
};

const C = {
  ink: "#0B1F3A",
  body: "#334155",
  muted: "#475569",
  surface: "#FFFFFF",
  ring: "#F5B301",
  scrim: "rgba(11, 31, 58, 0.55)",
};

type Rect = { top: number; left: number; width: number; height: number };

function viewport() {
  return { w: window.innerWidth || 390, h: window.innerHeight || 844 };
}

function rectOf(el: Element | null): Rect | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (!r || (r.width === 0 && r.height === 0)) return null;
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

function defaultOpenTop(url: string): void {
  try {
    (window.top ?? window).location.href = url;
  } catch {
    window.location.href = url;
  }
}

export default function TourOverlay({ parentOrigin, embedded, sidePanel = false, steps = TOUR_STEPS, openTop = defaultOpenTop }: TourOverlayProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const pathRef = useRef(location.pathname);
  pathRef.current = location.pathname;
  const ctx = useMemo(() => ({ path: () => pathRef.current }), []);

  const [index, setIndex] = useState(0);
  // While Next is working, the pop-up it was pressed on stays up (the app passes through in-between screens).
  const [busyAt, setBusyAt] = useState<number | null>(null);
  const busy = busyAt !== null;
  const [, setTick] = useState(0);

  // Re-check the screen whenever the app redraws, scrolls or resizes: the target may appear late (the portal loads its
  // data after it opens) or move.
  useEffect(() => {
    let frame = 0;
    const bump = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        setTick((n) => n + 1);
      });
    };
    const mo = typeof MutationObserver !== "undefined" ? new MutationObserver(bump) : null;
    mo?.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["disabled", "class", "style"] });
    window.addEventListener("scroll", bump, true);
    window.addEventListener("resize", bump);
    return () => {
      mo?.disconnect();
      window.removeEventListener("scroll", bump, true);
      window.removeEventListener("resize", bump);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  const resolved = resolveStep(steps, index, location.pathname);
  const active = busyAt ?? resolved;
  useEffect(() => {
    if (busyAt === null && resolved >= 0 && resolved !== index) setIndex(resolved);
  }, [busyAt, resolved, index]);

  const step = active >= 0 ? steps[active] : undefined;
  const target = step ? step.target() : null;
  const rect = rectOf(target);

  // Bring the step's subject into view once it is on screen. A moment after the screen opens, because the app scrolls
  // to the top itself when the route changes.
  const scrolledFor = useRef<string | null>(null);
  const hasTarget = Boolean(target);
  useEffect(() => {
    if (!step || !hasTarget || scrolledFor.current === step.key) return undefined;
    const timer = window.setTimeout(() => {
      scrolledFor.current = step.key;
      const el = step.target();
      if (!el) return;
      const r = el.getBoundingClientRect();
      const { h } = viewport();
      const offset = r.height > h * 0.45 ? 12 : Math.max(12, (h - 240 - r.height) / 2);
      const top = Math.max(0, window.scrollY + r.top - offset);
      try {
        window.scrollTo({ top, behavior: "smooth" });
      } catch {
        /* old browsers */
      }
    }, 150);
    return () => window.clearTimeout(timer);
  }, [step, hasTarget]);

  // Tell the portal around the demo which pop-up is showing (its side panel mirrors it, and in side-panel mode draws
  // the buttons).
  const postedFor = useRef<string | null>(null);
  const stepNumber = active + 1;
  const stepTotal = steps.length;
  const stepFinal = Boolean(step?.final);
  const stepCanBack = Boolean(step?.back) && active > 0;
  useEffect(() => {
    if (!step) return;
    const key = `${step.key}|${busy ? 1 : 0}`;
    if (postedFor.current === key) return;
    postedFor.current = key;
    postToParent(
      { type: LIVE_DEMO_TAG, event: "step", step: step.key, title: step.title, text: step.text,
        number: stepNumber, total: stepTotal - 1, canBack: stepCanBack, final: stepFinal, busy },
      { origin: parentOrigin, embedded },
    );
  }, [step, busy, stepNumber, stepTotal, stepCanBack, stepFinal, parentOrigin, embedded]);

  const next = useCallback(async () => {
    if (!step || busy || active < 0) return;
    const at = active;
    setBusyAt(at);
    // Moved on: the next pop-up fits the screen, or the app went further ahead by itself (e.g. no deposit question).
    const movedOn = () => stepFits(steps, at + 1, pathRef.current) || resolveStep(steps, at, pathRef.current) > at;
    try {
      await step.action?.(ctx);
      // Wait for the app to reach the next screen (Submit takes a moment).
      await waitUntil(movedOn, 9000);
    } catch {
      /* the app shows its own message; the pop-up stays so Next can be tried again */
    } finally {
      const now = stepFits(steps, at + 1, pathRef.current) ? at + 1 : resolveStep(steps, at, pathRef.current);
      setIndex(now >= 0 ? now : at);
      setBusyAt(null);
    }
  }, [step, busy, active, ctx, steps]);

  const back = useCallback(() => {
    if (!step || busy || active <= 0) return;
    let to = active - 1;
    // Skip steps that describe one of the app's own pop-ups: Back re-opens the screen, not the pop-up.
    while (to > 0 && steps[to]?.when && steps[to]?.route.test(steps[to - 1]?.path ?? "")) to -= 1;
    const prev = steps[to];
    if (!prev) return;
    if (!prev.route.test(pathRef.current)) navigate(prev.path);
    prev.show?.();
    setIndex(to);
  }, [step, busy, active, steps, navigate]);

  const handOver = useCallback(() => {
    const sent = postToParent({ type: LIVE_DEMO_TAG, event: "client-done" }, { origin: parentOrigin, embedded });
    if (!sent) openTop(brokerSideUrl(parentOrigin));
  }, [parentOrigin, embedded, openTop]);

  // KS_CLIENT_v11_LIVE_DEMO - the side panel's buttons, sent in from the portal.
  const commands = useRef({ next, back, handOver });
  commands.current = { next, back, handOver };
  useEffect(() => {
    if (!sidePanel) return undefined;
    const onMessage = (ev: MessageEvent) => {
      const cmd = commandFrom(ev, parentOrigin);
      if (cmd === "next") void commands.current.next();
      else if (cmd === "back") commands.current.back();
      else if (cmd === "broker") commands.current.handOver();
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [sidePanel, parentOrigin]);

  if (!step) return null;

  const { w, h } = viewport();
  const big = !rect || rect.width * rect.height > w * h * 0.6;
  const pad = 6;
  const spot: CSSProperties | null =
    rect && !big
      ? {
          position: "fixed",
          top: rect.top - pad,
          left: rect.left - pad,
          width: rect.width + pad * 2,
          height: rect.height + pad * 2,
          borderRadius: 12,
          boxShadow: `0 0 0 3px ${C.ring}, 0 0 0 9999px ${C.scrim}`,
          transition: "top 160ms ease, left 160ms ease, width 160ms ease, height 160ms ease",
          pointerEvents: "none",
        }
      : null;

  const number = active + 1;
  const total = steps.length;
  const final = Boolean(step.final);
  const canBack = Boolean(step.back) && active > 0;

  const card: CSSProperties = {
    position: "fixed",
    left: 12,
    right: 12,
    margin: "0 auto",
    maxWidth: 420,
    background: C.surface,
    color: C.ink,
    borderRadius: 16,
    padding: "16px 16px 14px",
    boxShadow: "0 18px 40px rgba(11, 31, 58, 0.28), 0 2px 8px rgba(11, 31, 58, 0.16)",
    pointerEvents: "auto",
    fontFamily: "inherit",
    ...(final ? { top: "50%", transform: "translateY(-50%)" } : { bottom: "calc(12px + env(safe-area-inset-bottom, 0px))" }),
  };
  const btn: CSSProperties = {
    minHeight: 44,
    padding: "0 18px",
    borderRadius: 10,
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
  };

  if (sidePanel) {
    // The portal's side panel carries the text and the buttons; the phone shows the app and the spotlight only.
    return (
      <div data-testid="live-demo-tour" data-step={step.key} data-side-panel="1" style={{ position: "fixed", inset: 0, zIndex: 2147483000, pointerEvents: "none" }}>
        {spot ? <div data-testid="live-demo-spotlight" style={spot} /> : null}
      </div>
    );
  }

  return (
    <div data-testid="live-demo-tour" data-step={step.key} style={{ position: "fixed", inset: 0, zIndex: 2147483000, pointerEvents: "none" }}>
      {spot ? <div data-testid="live-demo-spotlight" style={spot} /> : final ? <div style={{ position: "fixed", inset: 0, background: C.scrim }} /> : null}
      <div role="dialog" aria-modal="false" aria-labelledby="live-demo-title" aria-describedby="live-demo-text" data-testid="live-demo-card" style={card}>
        <div style={{ fontSize: "var(--ks-text-help)", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: C.muted }}>
          {final ? "Client side done" : `You are the client · ${number} of ${total - 1}`}
        </div>
        <h2 id="live-demo-title" style={{ margin: "6px 0 4px", fontSize: final ? 20 : 17, lineHeight: 1.3, fontWeight: 700, color: C.ink }}>{step.title}</h2>
        <p id="live-demo-text" style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: C.body }}>{step.text}</p>
        <div style={{ display: "flex", justifyContent: canBack ? "space-between" : "flex-end", gap: 10, marginTop: 14 }}>
          {canBack ? (
            <button type="button" data-testid="live-demo-back" onClick={back} disabled={busy}
              style={{ ...btn, background: C.surface, color: C.ink, border: `1px solid ${C.ink}` }}>
              Back
            </button>
          ) : null}
          {final ? (
            <button type="button" data-testid="live-demo-broker" onClick={handOver}
              style={{ ...btn, background: C.ink, color: C.surface, border: `1px solid ${C.ink}`, flex: canBack ? undefined : 1 }}>
              Show me the broker side
            </button>
          ) : (
            <button type="button" data-testid="live-demo-next" onClick={() => void next()} disabled={busy} aria-busy={busy}
              style={{ ...btn, background: C.ink, color: C.surface, border: `1px solid ${C.ink}`, opacity: busy ? 0.85 : 1 }}>
              {busy ? "One moment..." : "Next"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
