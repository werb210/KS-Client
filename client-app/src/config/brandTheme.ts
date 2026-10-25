// KS_CLIENT_v14_BRAND_FONT - the licensee's background colour and font (GET /api/licensee: background_color,
// font_family) applied to the whole app through CSS variables:
//   --ks-bg            page and panel background (index.css, the CSS files, tokens.colors.pageBackground)
//   --ks-font          body text
//   --ks-font-display  headings
// Unset values leave the app's own design. Text stays readable: a background too dark (or too saturated) for the
// app's dark text is lightened until both body and secondary text reach 4.5 to 1.

const HEX = /^#[0-9a-f]{6}$/i;
const FONT = /^[A-Za-z0-9][A-Za-z0-9 -]{0,59}$/;
/** The app's body and secondary text colours (tokens.colors.textPrimary / textSecondary). */
const TEXT = ["#0B1F3A", "#51617D"];
const SYSTEM_FONTS = new Set(["arial", "helvetica", "georgia", "verdana", "tahoma", "trebuchet ms", "times new roman", "system-ui"]);

function rgb(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}
function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}
const toHex = (c: number[]) => "#" + c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("").toUpperCase();

/** The background to use: the licensee's, lightened until the app's text reads on it; null when none is set. */
export function readableBackground(raw: string | null | undefined): string | null {
  const v = String(raw ?? "").trim();
  if (!HEX.test(v)) return null;
  let c = rgb(v) as number[];
  for (let i = 0; i < 60; i++) {
    const hex = toHex(c);
    if (TEXT.every((t) => contrast(hex, t) >= 4.5)) return hex;
    c = c.map((x) => x + (255 - x) * 0.1);
  }
  return "#FFFFFF";
}

export function fontStack(family: string, serif = false): string {
  return `"${family}", ${serif ? "Georgia, serif" : "system-ui, -apple-system, BlinkMacSystemFont, sans-serif"}`;
}

export type BrandTheme = { background_color?: string | null; font_family?: string | null };

/** Sets (or clears) the CSS variables and loads a Google font when one is named. */
export function applyBrandTheme(b: BrandTheme, doc: Document | undefined = typeof document !== "undefined" ? document : undefined): void {
  if (!doc?.documentElement) return;
  const root = doc.documentElement.style;
  const bg = readableBackground(b.background_color);
  if (bg) root.setProperty("--ks-bg", bg);
  else root.removeProperty("--ks-bg");
  const family = String(b.font_family ?? "").trim();
  if (family && FONT.test(family)) {
    root.setProperty("--ks-font", fontStack(family));
    root.setProperty("--ks-font-display", fontStack(family));
    if (!SYSTEM_FONTS.has(family.toLowerCase())) {
      const id = "ks-brand-font";
      const href = `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, "+")}:wght@400;500;600;700&display=swap`;
      let link = doc.getElementById(id) as HTMLLinkElement | null;
      if (!link) {
        link = doc.createElement("link");
        link.id = id;
        link.rel = "stylesheet";
        doc.head.appendChild(link);
      }
      if (link.getAttribute("href") !== href) link.setAttribute("href", href);
    }
  } else {
    root.removeProperty("--ks-font");
    root.removeProperty("--ks-font-display");
  }
}
