// KS_CLIENT_BRAND_ASSETS_v1
import { describe, expect, it } from "vitest";
import { applyFavicon } from "../brand";

describe("the brokerage's favicon", () => {
  it("points the tab icon at an https address and ignores anything else", () => {
    applyFavicon("http://insecure.example/f.png");
    expect(document.querySelector("link[rel='icon'][data-brand]")).toBeNull();
    applyFavicon("https://store.example/brand-assets/kt1/favicon-1.png");
    expect(document.querySelector<HTMLLinkElement>("link[rel='icon'][data-brand]")?.href).toBe("https://store.example/brand-assets/kt1/favicon-1.png");
  });
});
