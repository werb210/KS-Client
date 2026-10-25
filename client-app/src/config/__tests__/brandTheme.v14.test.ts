// KS_CLIENT_v14_BRAND_FONT - the licensee's background colour and font, applied with readable text.
import { describe, expect, it } from "vitest";
import { applyBrandTheme, contrast, readableBackground } from "../brandTheme";
import { loadBrand, brand } from "../brand";

const ok = (licensee: Record<string, unknown>) => (async () => new Response(JSON.stringify({ licensee }), { status: 200 })) as unknown as typeof fetch;

describe("brand theme", () => {
  it("keeps a light background as is and lightens a dark one until the app's text reads on it", () => {
    expect(readableBackground("#FFFAF0")).toBe("#FFFAF0");
    expect(readableBackground("")).toBeNull();
    expect(readableBackground("navy")).toBeNull();
    const fixed = readableBackground("#1E3A5F")!;
    expect(contrast(fixed, "#0B1F3A")).toBeGreaterThanOrEqual(4.5);
    expect(contrast(fixed, "#51617D")).toBeGreaterThanOrEqual(4.5);
  });

  it("sets the CSS variables and loads a Google font; clears them when unset", () => {
    applyBrandTheme({ background_color: "#FFFAF0", font_family: "Open Sans" });
    const root = document.documentElement.style;
    expect(root.getPropertyValue("--ks-bg")).toBe("#FFFAF0");
    expect(root.getPropertyValue("--ks-font")).toContain('"Open Sans"');
    expect(document.getElementById("ks-brand-font")?.getAttribute("href")).toBe("https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;500;600;700&display=swap");
    applyBrandTheme({ background_color: "", font_family: "" });
    expect(root.getPropertyValue("--ks-bg")).toBe("");
    expect(root.getPropertyValue("--ks-font")).toBe("");
  });

  it("ignores a font name that is not a plain family name", () => {
    applyBrandTheme({ font_family: "Lato;}body{display:none" });
    expect(document.documentElement.style.getPropertyValue("--ks-font")).toBe("");
  });

  it("takes background_color and font_family from GET /api/licensee and applies them", async () => {
    await loadBrand(1000, ok({ company_name: "Prairie Capital", background_color: "#FFFAF0", font_family: "Lato" }));
    expect(brand()).toMatchObject({ background_color: "#FFFAF0", font_family: "Lato" });
    expect(document.documentElement.style.getPropertyValue("--ks-font")).toContain('"Lato"');
    await loadBrand(1000, ok({ company_name: "Prairie Capital", background_color: "red", font_family: "<b>" }));
    expect(brand()).toMatchObject({ background_color: "", font_family: "" });
  });
});
