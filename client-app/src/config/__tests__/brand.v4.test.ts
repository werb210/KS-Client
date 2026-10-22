// KS_CLIENT_v4_BRANDING - the app names the licensee from GET /api/licensee, never Boreal.
import { describe, expect, it } from "vitest";
import { brandName, legalName, nameWithLegal, assistantName, loadBrand, DEFAULT_BRAND, __setBrandForTests } from "../brand";

const ok = (licensee: unknown) => (async () => ({ ok: true, json: async () => ({ ok: true, licensee }) })) as unknown as typeof fetch;

describe("licensee branding", () => {
  it("defaults to a neutral name, not Boreal", () => {
    expect(DEFAULT_BRAND.company_name).not.toMatch(/boreal/i);
  });

  it("loads the licensee's name, legal name and assistant", async () => {
    await loadBrand(1000, ok({ company_name: "Acme Capital", legal_name: "Acme Capital Ltd.", assistant_name: "Ava" }));
    expect(brandName()).toBe("Acme Capital");
    expect(legalName()).toBe("Acme Capital Ltd.");
    expect(nameWithLegal()).toBe("Acme Capital (Acme Capital Ltd.)");
    expect(assistantName()).toBe("Ava");
    expect(document.title).toBe("Acme Capital");
  });

  it("keeps what it had when the server fails", async () => {
    __setBrandForTests({ company_name: "Acme Capital" });
    await loadBrand(1000, (async () => { throw new Error("offline"); }) as unknown as typeof fetch);
    expect(brandName()).toBe("Acme Capital");
    await loadBrand(1000, (async () => ({ ok: false, json: async () => ({}) })) as unknown as typeof fetch);
    expect(brandName()).toBe("Acme Capital");
  });

  it("ignores unsafe logo addresses and bad colours", async () => {
    await loadBrand(1000, ok({ company_name: "Acme", logo_url: "javascript:alert(1)", primary_color: "red" }));
    const { brand } = await import("../brand");
    expect(brand().logo_url).toBe("");
    expect(brand().primary_color).toBe(DEFAULT_BRAND.primary_color);
  });
});
