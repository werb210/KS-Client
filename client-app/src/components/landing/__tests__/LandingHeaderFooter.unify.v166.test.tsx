// BF_CLIENT_BLOCK_v166_LANDING_HEADER_FOOTER_UNIFY_v1
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import LandingHeader from "@/components/landing/LandingHeader";
import LandingFooter from "@/components/landing/LandingFooter";
import SlimHeader from "@/components/SlimHeader";

describe("BF_CLIENT_BLOCK_v166 — LandingHeader cross-links", () => {

  it("Apply Now CTA is a hash link to #apply-otp", () => {
    render(<LandingHeader />);
    const link = screen.getByTestId("landing-cta-apply") as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("#apply-otp");
  });


  it("clicking a mobile nav item closes the drawer", () => {
    render(<LandingHeader />);
    fireEvent.click(screen.getByTestId("landing-mobile-toggle"));
    const menu = screen.getByTestId("landing-mobile-menu");
    fireEvent.click(menu.querySelector("nav a") as HTMLAnchorElement);
    // After click, the dialog should no longer be in the DOM.
    expect(screen.queryByTestId("landing-mobile-menu")).toBeNull();
  });
});

describe("BF_CLIENT_BLOCK_v166 — LandingFooter cross-links", () => {

  it("Apply Now anchor stays as #apply-otp", () => {
    render(<LandingFooter />);
    const apply = screen.getByTestId("landing-footer-apply") as HTMLAnchorElement;
    expect(apply.getAttribute("href")).toBe("#apply-otp");
  });
});

// KS_CLIENT_v1_LICENSEE - website links point at the licensee's website (VITE_WEBSITE_URL; the client app until set),
// never at Boreal's.
describe("website links use the licensee's website", () => {
  const check = (container: HTMLElement) => {
    const links = Array.from(container.querySelectorAll('a[href^="http"]')) as HTMLAnchorElement[];
    expect(links.length).toBeGreaterThan(0);
    for (const a of links) {
      expect(a.getAttribute("href")).not.toMatch(/boreal\.(financial|insure)/);
      expect(String(a.getAttribute("href")).startsWith("https://wonderful-island-0b68ae310.5.azurestaticapps.net")).toBe(true);
    }
  };
  it("LandingHeader", () => check(render(<LandingHeader />).container));
  it("LandingFooter", () => check(render(<LandingFooter />).container));
  it("SlimHeader", () => check(render(<SlimHeader />).container));
});
