// KS_CLIENT_v5_LICENSEE_APPS - a licensee's build carries its name, colours, wording and links into the app.
import { afterEach, describe, expect, it } from "vitest";
import { parseLicenseeBuild } from "@/config/licenseeBuild";
import { brandFromBuild } from "@/config/brand";
import { __setCopyOverridesForTests, fill, t } from "@/config/copy";
import DEFAULTS from "@/config/copy.defaults.json";

const BUILD = {
  key: "acme",
  app_name: "Acme",
  company_name: "Acme Capital",
  colors: { primary: "#123456", secondary: "#F2B544", background: "#FFFFFF", text: "#1F2937", on_primary: "#FFFFFF" },
  fonts: { body: "Inter", heading: "Inter" },
  wording: { "welcome.title": "Hello from {name}" },
  support: { email: "help@acme.example", phone: "" },
  legal: { privacy_url: "https://acme.example/privacy", terms_url: "https://acme.example/terms" },
  ios_bundle_id: "com.acme.client",
  android_application_id: "com.acme.client",
};

afterEach(() => __setCopyOverridesForTests({}));

describe("licensee build config", () => {
  it("parses VITE_KS_LICENSEE and ignores junk", () => {
    expect(parseLicenseeBuild(JSON.stringify(BUILD))?.company_name).toBe("Acme Capital");
    expect(parseLicenseeBuild("")).toBeNull();
    expect(parseLicenseeBuild("{not json")).toBeNull();
    expect(parseLicenseeBuild(JSON.stringify({ nope: 1 }))).toBeNull();
  });

  it("the default build is the Keystone client with nothing pinned", () => {
    const { brand, pinned } = brandFromBuild(null);
    expect(pinned).toEqual([]);
    expect(brand.primary_color).toBe("#0B1F3A");
  });

  it("a licensee build pins its name, colours and support contact", () => {
    const { brand, pinned } = brandFromBuild(parseLicenseeBuild(BUILD));
    expect(brand.company_name).toBe("Acme Capital");
    expect(brand.primary_color).toBe("#123456");
    expect(brand.accent_color).toBe("#F2B544");
    expect(brand.support_email).toBe("help@acme.example");
    expect(pinned).toEqual(expect.arrayContaining(["company_name", "primary_color", "accent_color", "support_email"]));
    expect(pinned).not.toContain("support_phone");
  });
});

describe("copy helper", () => {
  it("fills placeholders and leaves unknown ones", () => {
    expect(fill("Hi {name} {x}", { name: "Acme" })).toBe("Hi Acme {x}");
  });

  it("uses Keystone's wording by default and the licensee's override when given", () => {
    expect(t("legal.privacy")).toBe("Privacy Policy");
    expect(t("welcome.title", { name: "Acme" })).toBe("Welcome to Acme");
    __setCopyOverridesForTests({ "welcome.title": "Hello from {name}" });
    expect(t("welcome.title", { name: "Acme" })).toBe("Hello from Acme");
  });

  it("every default only uses the placeholders the validator allows", () => {
    for (const v of Object.values(DEFAULTS)) {
      for (const m of String(v).matchAll(/\{([a-z_]+)\}/g)) expect(["name", "year", "support_email", "support_phone"]).toContain(m[1]);
    }
  });
});
