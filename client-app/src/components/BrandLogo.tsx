// KS_CLIENT_v4_BRANDING - the licensee's logo. The Boreal mountains were Boreal's mark; a Keystone copy shows its
// licensee's logo (logo_url from GET /api/licensee) or, until one is set, the company's first letter in a square
// of its primary colour (letter colour picked for contrast).
import type { CSSProperties } from "react";
import { useBrand } from "@/config/brand";

export function brandInitial(name: string): string {
  const m = String(name ?? "").trim().match(/[A-Za-z0-9]/);
  return m ? m[0].toUpperCase() : "K";
}

/** Dark text on a light brand colour, white on a dark one, so the letter stays readable. */
export function textOn(hex: string): string {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return "#ffffff";
  const [r, g, b] = [m[1], m[2], m[3]].map((h) => { const c = parseInt(h, 16) / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.18 ? "#0B1F3A" : "#ffffff";
}

export default function BrandLogo({ className, style, size = 28, alt = "" }: { className?: string; style?: CSSProperties; size?: number; alt?: string }) {
  const b = useBrand();
  if (b.logo_url) {
    return <img src={b.logo_url} alt={alt} className={className} style={{ height: size, width: "auto", ...style }} data-testid="brand-logo" />;
  }
  return (
    <span
      className={className}
      role={alt ? "img" : undefined}
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : true}
      data-testid="brand-logo"
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none",
        width: size, height: size, borderRadius: Math.round(size / 4),
        background: b.primary_color, color: textOn(b.primary_color), border: "1px solid rgba(255,255,255,0.35)",
        fontWeight: 700, fontSize: Math.round(size * 0.55), lineHeight: 1, ...style,
      }}
    >
      {brandInitial(b.company_name)}
    </span>
  );
}
