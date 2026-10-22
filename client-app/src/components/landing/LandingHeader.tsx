// BF_CLIENT_BLOCK_v166_LANDING_HEADER_FOOTER_UNIFY_v1
// De-minified from the prior single-line export and aligned with
// BF-Website nav labels (cross-link reads "Boreal Risk Management" to
// match BF-Website v19). No visual change — same dark navy
// (#0B1320) backdrop-blur header, same mobile drawer.
// BF_CLIENT_BLOCK_v102_LOGO_LOCAL_v1 — local logo asset to avoid
// cross-origin fetch from boreal.financial in production.
import { useEffect, useState } from "react";
import { createPortal } from "react-dom"; // BF_CLIENT_MENU_PORTAL_v729
import "@/styles/container.css"; // BF_CLIENT_CHROME_v170
import BrandLogo from "@/components/BrandLogo"; // KS_CLIENT_v4_BRANDING
import { brandName } from "@/config/brand";
import { isNativeApp } from "@/lib/platform";
import { WEBSITE_URL } from "@/config/licensee"; // KS_CLIENT_v1_LICENSEE

const NAV_ITEMS = [
  { href: `${WEBSITE_URL}/products`, label: "Products" },
  { href: `${WEBSITE_URL}/industries`, label: "Industries" },
  { href: `${WEBSITE_URL}/credit-readiness`, label: "Credit Readiness" },
  { href: `${WEBSITE_URL}/contact`, label: "Contact" },
];

function MenuIcon({ open }: { open: boolean }) {
  return open ? (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ) : (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

export default function LandingHeader() {
  const [open, setOpen] = useState(false);
  // BF_CLIENT_MENU_PORTAL_v729 - Escape closes the menu.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // BF_CLIENT_CHROME_v168 - inside the app the nav links open an external
  // browser mid-application, so they are dropped. A logo-only bar stays: a
  // screen with no header at all leaves the user unanchored part-way through.
  if (isNativeApp()) {
    return (
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0a1120]/95 backdrop-blur">
        <div className="bf-container flex min-h-14 items-center gap-3">
          <BrandLogo size={28} />
          <span className="text-sm font-semibold text-white">{brandName()}</span>
        </div>
      </header>
    );
  }

  return (
    <header className="site-header w-full border-b border-white/10 bg-[#0B1320]/95 backdrop-blur">
      <div className="bf-container flex min-h-20 items-center justify-between gap-4 py-3">
        <a
          href={WEBSITE_URL}
          className="flex items-center gap-3 sm:gap-4"
          onClick={() => setOpen(false)}
          data-testid="landing-logo"
        >
          <BrandLogo size={40} />
          <span className="text-base font-semibold tracking-wide text-white sm:text-xl">
            {brandName()}
          </span>
        </a>

        <nav className="hidden items-center gap-6 text-sm text-white md:flex">
          {NAV_ITEMS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-white/80 hover:text-white"
            >
              {item.label}
            </a>
          ))}
          <a
            href="#apply-otp"
            className="rounded-full bg-blue-600 px-5 py-2 font-medium text-white hover:bg-blue-500"
            data-testid="landing-cta-apply"
          >
            Apply Now
          </a>
        </nav>

        <button
          type="button"
          aria-expanded={open}
          className="flex h-11 w-11 items-center justify-center rounded-md text-white md:hidden"
          onClick={() => setOpen((prev) => !prev)}
          aria-label="Toggle navigation menu"
          data-testid="landing-mobile-toggle"
        >
          <MenuIcon open={open} />
        </button>
      </div>

      {/* BF_CLIENT_MENU_PORTAL_v729 - the menu is rendered on document.body, not inside the
          header. The header has backdrop-blur, and on iPhone (WebKit) a backdrop-filter makes
          the header the containing block for position: fixed children, so the full-screen
          menu was squeezed into the 80px header and hidden behind the page. */}
      {open && typeof document !== "undefined" ? createPortal(
        <div className="fixed inset-0 z-[1000] md:hidden" role="dialog" aria-modal="true" aria-label="Menu" data-testid="landing-mobile-menu">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-black/55"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-0 h-full w-[min(88vw,360px)] overflow-auto border-l border-white/10 bg-[#081325] p-6">
            <div className="mb-6 flex items-center justify-between">
              <span className="text-lg font-semibold text-white">Menu</span>
              <button
                type="button"
                className="rounded-md p-2 text-white"
                onClick={() => setOpen(false)}
                aria-label="Close mobile navigation"
              >
                <MenuIcon open={true} />
              </button>
            </div>
            <nav className="flex flex-col gap-4">
              {NAV_ITEMS.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="text-white/80"
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </a>
              ))}
              <a
                href="#apply-otp"
                className="mt-2 inline-flex justify-center rounded-full bg-blue-600 px-5 py-3 font-medium text-white"
                onClick={() => setOpen(false)}
              >
                Apply Now
              </a>
            </nav>
          </div>
        </div>,
        document.body,
      ) : null}
    </header>
  );
}
