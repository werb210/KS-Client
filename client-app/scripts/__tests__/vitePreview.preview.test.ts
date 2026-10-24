// @vitest-environment node
// KS_CLIENT_PREVIEW_APP_v1 - the preview build's index.html: a CSP that allows only the app itself, no outside links.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PREVIEW_CSP, isPreviewEnv, previewHtml, previewPlugin } from "../../vite.preview";

const html = readFileSync(path.resolve(__dirname, "../../index.html"), "utf8");

describe("vite.preview", () => {
  it("adds a CSP that connects only to the app and drops every outside link", () => {
    const out = previewHtml(html);
    expect(out).toContain(`<meta http-equiv="Content-Security-Policy" content="${PREVIEW_CSP}" />`);
    expect(out).not.toMatch(/googleapis|gstatic|rel="manifest"|rel="canonical"|azurestaticapps/);
    const connect = PREVIEW_CSP.split("; ").find((d) => d.startsWith("connect-src"))!;
    expect(connect).not.toMatch(/https:\/\/(?!localhost)|\*|wss:/);
    expect(out).toContain('<script type="module" src="/src/main.tsx"></script>');
  });

  it("only applies to VITE_KS_PREVIEW=1", () => {
    const root = path.resolve(__dirname, "../..");
    const none = () => ({});
    expect(isPreviewEnv("production", root, none, { VITE_KS_PREVIEW: "1" })).toBe(true);
    expect(isPreviewEnv("production", root, none, { VITE_KS_PREVIEW: "0" })).toBe(false);
    expect(isPreviewEnv("production", root, () => ({ VITE_KS_PREVIEW: "1" }), {})).toBe(true);
    expect(previewPlugin("test", root, none)).toBeNull();
    expect(previewPlugin("production", root, () => ({ VITE_KS_PREVIEW: "1" }))?.name).toBe("ks-preview");
  });
});
