// KS_CLIENT_v11_LIVE_DEMO - the guided tour over the real client app: one pop-up per wizard step, three in the client
// portal, then the hand-over to the broker side. "Next" does what the client would do on that screen (presses the
// step's Continue button); real taps work too, and the tour follows whichever screen is showing.
import { DEMO_APPLICATION_ID } from "./sample";

export type TourContext = {
  /** The router's current path (the demo runs on an in-memory router, so window.location stays on /tour). */
  path: () => string;
};

export type TourStep = {
  key: string;
  route: RegExp;
  /** Where Back goes to show this step again. */
  path: string;
  /** Extra condition on top of the route (e.g. a pop-up of the app's own is open). */
  when?: () => boolean;
  target: () => Element | null;
  title: string;
  text: string;
  /** What Next does on this screen. */
  action?: (ctx: TourContext) => Promise<void>;
  /** Puts the screen back the way this step shows it, when the client comes back to it with Back. */
  show?: () => void;
  /** Back is offered (not after submitting, not on the app's own pop-ups). */
  back?: boolean;
  final?: boolean;
};

const PORTAL_PATH = `/application/${DEMO_APPLICATION_ID}`;

export const byTestId = (id: string): HTMLElement | null =>
  typeof document === "undefined" ? null : document.querySelector<HTMLElement>(`[data-testid="${id}"]`);

export function buttonWithText(pattern: RegExp, root: ParentNode | null = typeof document === "undefined" ? null : document): HTMLButtonElement | null {
  if (!root) return null;
  const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>("button"));
  return buttons.find((b) => pattern.test((b.textContent ?? "").replace(/\s+/g, " ").trim())) ?? null;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Polls until `test` is true; resolves false after `timeoutMs`. */
export async function waitUntil(test: () => boolean, timeoutMs = 4000, everyMs = 50): Promise<boolean> {
  const end = Date.now() + timeoutMs;
  for (;;) {
    let okNow = false;
    try {
      okNow = test();
    } catch {
      okNow = false;
    }
    if (okNow) return true;
    if (Date.now() >= end) return false;
    await sleep(everyMs);
  }
}

const enabled = (b: HTMLButtonElement | null): b is HTMLButtonElement => Boolean(b && !b.disabled);

/** Waits for the button to be there and enabled, then presses it. */
async function press(find: () => HTMLButtonElement | null, timeoutMs = 4000): Promise<void> {
  await waitUntil(() => enabled(find()), timeoutMs);
  const b = find();
  if (enabled(b)) b.click();
}

const wizardCard = () => (typeof document === "undefined" ? null : document.querySelector(".wiz-card"));
const ctaButton = (pattern: RegExp) => () => buttonWithText(pattern, document.querySelector(".wiz-cta") ?? document);

/** Step 2's own "Include closing costs?" pop-up. */
export function closingCostsDialog(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  const heading = Array.from(document.querySelectorAll("h2")).find((h) => /Include closing costs\?/.test(h.textContent ?? ""));
  return (heading?.parentElement as HTMLElement | null) ?? null;
}

export const TOUR_STEPS: TourStep[] = [
  {
    key: "step1",
    route: /^\/apply\/step-1$/,
    path: "/apply/step-1",
    target: wizardCard,
    title: "Sam tells us what he needs",
    text: "Sam Carter runs Juniper Hollow Millwork. He needs $250,000 for a new CNC router. Every answer is already filled in for you.",
    action: () => press(() => byTestId("step1-continue") as HTMLButtonElement | null),
  },
  {
    key: "step2",
    route: /^\/apply\/step-2$/,
    path: "/apply/step-2",
    when: () => !closingCostsDialog(),
    target: () => buttonWithText(/^Selected$/)?.parentElement ?? wizardCard(),
    title: "He picks the kind of financing",
    text: "Only the products his answers qualify for are shown. Equipment Financing is already picked.",
    back: true,
    action: async () => {
      // Pick Equipment Financing if nothing is picked yet, then continue.
      await waitUntil(() => Boolean(buttonWithText(/^Selected?$/)), 4000);
      if (!buttonWithText(/^Selected$/)) buttonWithText(/^Select$/)?.click();
      await press(ctaButton(/^Continue$/));
    },
  },
  {
    key: "closing_costs",
    route: /^\/apply\/step-2$/,
    path: "/apply/step-2",
    when: () => Boolean(closingCostsDialog()),
    target: closingCostsDialog,
    title: "A question about the deposit",
    text: "Equipment lenders usually want money down. Sam already has his $18,000 deposit, so he answers no and carries on.",
    action: () => press(() => buttonWithText(/^No, continue$/)),
  },
  {
    key: "step3",
    route: /^\/apply\/step-3$/,
    path: "/apply/step-3",
    target: wizardCard,
    title: "His business details",
    text: "Juniper Hollow Millwork in Edmonton: 7 years in business, 18 staff, about $2.1 million a year in sales.",
    back: true,
    action: () => press(ctaButton(/^Continue$/)),
  },
  {
    key: "step4",
    route: /^\/apply\/step-4$/,
    path: "/apply/step-4",
    target: wizardCard,
    title: "About Sam",
    text: "Sam owns all of the business. His details are a sample - even the ID number (000-000-000).",
    back: true,
    action: () => press(ctaButton(/^Continue to (Documents|Review)/)),
  },
  {
    key: "step5",
    route: /^\/apply\/step-5$/,
    path: "/apply/step-5",
    target: () => byTestId("step5-options-row") ?? byTestId("step5-later") ?? wizardCard(),
    title: "His documents",
    text: "Sam can upload from his phone now, send them later from his portal, or have his accountant send them. Here they arrive right after he submits.",
    back: true,
    action: () =>
      press(() => (byTestId("step5-choose-later") ?? byTestId("step5-finalize-later")) as HTMLButtonElement | null, 6000),
  },
  {
    key: "step6",
    route: /^\/apply\/step-6$/,
    path: "/apply/step-6",
    target: () => byTestId("agree-all-terms") ?? wizardCard(),
    title: "Review and sign",
    text: "The terms are accepted and Sam's typed signature is in. Next sends the application to his broker.",
    back: true,
    action: () => press(ctaButton(/^Submit Application$/)),
  },
  {
    key: "portal_status",
    route: /^\/application\/[^/]+$/,
    path: PORTAL_PATH,
    target: () => byTestId("cmp-status"),
    show: () => byTestId("cmp-tab-home")?.click(),
    title: "Sam's own portal",
    text: "After submitting, Sam lands in his portal. He can see where his application is at any time - right now it is being reviewed.",
    action: async () => {
      byTestId("cmp-tab-chat")?.click();
    },
  },
  {
    key: "portal_chat",
    route: /^\/application\/[^/]+$/,
    path: PORTAL_PATH,
    target: () => byTestId("cmp-chat"),
    show: () => byTestId("cmp-tab-chat")?.click(),
    title: "One conversation with his broker",
    text: "Messages from the broker show up here and by text. His advisor has already confirmed that all 6 documents came in.",
    back: true,
    action: async () => {
      byTestId("cmp-tab-more")?.click();
    },
  },
  {
    key: "portal_documents",
    route: /^\/application\/[^/]+$/,
    path: PORTAL_PATH,
    target: () => byTestId("cmp-more-upload") ?? byTestId("cmp-more"),
    show: () => byTestId("cmp-tab-more")?.click(),
    title: "Nothing missing",
    text: "All 6 documents are received, so Sam's documents are up to date and there is nothing left on his to-do list.",
    back: true,
    action: async () => {
      byTestId("cmp-tab-home")?.click();
    },
  },
  {
    key: "broker_handoff",
    route: /^\/application\/[^/]+$/,
    path: PORTAL_PATH,
    target: () => null,
    title: "Now let's look at what you see as the broker",
    text: "Sam's application has just landed in the broker's pipeline. Next: review his documents, check the numbers and the fraud report, and send it to lenders.",
    back: true,
    final: true,
  },
];

/** Does step `i` describe the screen at `pathname` right now? */
export function stepFits(steps: TourStep[], i: number, pathname: string): boolean {
  const s = steps[i];
  if (!s || !s.route.test(pathname)) return false;
  try {
    return !s.when || s.when();
  } catch {
    return false;
  }
}

/**
 * The step to show: the current one while it still fits the screen, else the next one that does (the client moved on
 * by tapping the app itself), else an earlier one (they went back). -1 when no step fits (e.g. a screen off the tour).
 */
export function resolveStep(steps: TourStep[], index: number, pathname: string): number {
  if (stepFits(steps, index, pathname)) return index;
  for (let i = index + 1; i < steps.length; i += 1) if (stepFits(steps, i, pathname)) return i;
  for (let i = Math.min(index, steps.length) - 1; i >= 0; i -= 1) if (stepFits(steps, i, pathname)) return i;
  return -1;
}
