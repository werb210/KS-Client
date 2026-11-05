// KS_CLIENT_LANGUAGES_v1 - English, French and Spanish.
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { deviceLang, offeredLangs, setLangForTest, settleLang, t } from "../index";
import { FR } from "../fr";
import { ES } from "../es";
import { __setBrandForTests } from "@/config/brand";
import LanguagePicker from "../LanguagePicker";

afterEach(() => { setLangForTest("en"); try { localStorage.clear(); } catch { /* */ } });

describe("translations", () => {
  it("translates, falls back to English and fills placeholders", () => {
    setLangForTest("fr");
    expect(t("Continue")).toBe("Continuer");
    expect(t("A sentence nobody translated")).toBe("A sentence nobody translated");
    setLangForTest("es");
    expect(t("Continue")).toBe("Continuar");
    expect(t("Hi {name}", { name: "Pat" })).toBe("Hi Pat");
  });
  it("French and Spanish cover the same English text", () => {
    expect(Object.keys(FR).sort()).toEqual(Object.keys(ES).sort());
    expect(Object.keys(FR).length).toBeGreaterThan(800);
    for (const [en, fr] of Object.entries(FR)) expect(fr.trim(), en).not.toBe("");
  });
  it("keeps every {placeholder} in French and Spanish", () => {
    const holes = (x: string) => (x.match(/\{\w+\}/g) ?? []).sort().join(",");
    for (const [en, fr] of Object.entries(FR)) expect(holes(fr), `fr: ${en}`).toBe(holes(en));
    for (const [en, es] of Object.entries(ES)) expect(holes(es), `es: ${en}`).toBe(holes(en));
  });
});

describe("which language", () => {
  it("always offers English first and only known languages", () => {
    expect(offeredLangs("fr,de,es")).toEqual(["en", "fr", "es"]);
    expect(offeredLangs(undefined)).toEqual(["en"]);
  });
  it("reads the phone's language", () => {
    expect(deviceLang({ languages: ["fr-CA", "en"] })).toBe("fr");
    expect(deviceLang({ languages: ["de-DE"], language: "de" })).toBeNull();
  });
  it("starts a first visit in the phone's language when the brokerage offers it", () => {
    const nav = vi.spyOn(globalThis.navigator, "languages", "get").mockReturnValue(["es-US"] as any);
    expect(settleLang(["en", "es"], { reload: false })).toBe("es");
    expect(localStorage.getItem("ks_client_lang")).toBe("es");
    nav.mockRestore();
  });
  it("falls back to English when the brokerage stops offering the saved language", () => {
    localStorage.setItem("ks_client_lang", "fr");
    expect(settleLang(["en"], { reload: false })).toBe("en");
  });
});

describe("picker", () => {
  it("is hidden when the brokerage offers English only", () => {
    __setBrandForTests({ client_languages: "en" });
    const { container } = render(<LanguagePicker />);
    expect(container.textContent).toBe("");
  });
  it("lists the brokerage's languages", () => {
    __setBrandForTests({ client_languages: "en,fr,es" });
    render(<LanguagePicker />);
    expect(screen.getByRole("button", { name: "Français" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Español" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "English" }).getAttribute("aria-pressed")).toBe("true");
  });
});

describe("language header", () => {
  it("tells only the brokerage's server, and only for French or Spanish", async () => {
    const { installLanguageHeader } = await import("../index");
    const seen: Array<{ url: string; lang: string | null }> = [];
    const w: { fetch?: typeof fetch } = {
      fetch: (async (input: RequestInfo | URL, init?: RequestInit) => {
        seen.push({ url: String(input), lang: new Headers(init?.headers).get("X-Client-Language") });
        return new Response("{}");
      }) as typeof fetch,
    };
    installLanguageHeader("https://northwind.api.example.ca", w);
    await w.fetch!("https://northwind.api.example.ca/api/licensee");
    setLangForTest("fr");
    await w.fetch!("https://northwind.api.example.ca/api/auth/otp/start", { method: "POST" });
    await w.fetch!("https://sdk.flinks.example/x");
    expect(seen).toEqual([
      { url: "https://northwind.api.example.ca/api/licensee", lang: null },
      { url: "https://northwind.api.example.ca/api/auth/otp/start", lang: "fr" },
      { url: "https://sdk.flinks.example/x", lang: null },
    ]);
  });
});
