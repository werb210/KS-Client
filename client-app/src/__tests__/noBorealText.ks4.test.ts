// KS_CLIENT_v4_BRANDING - guard: no "Boreal" or "Maya" in text the app shows. The licensee's name comes from
// config/brand. Comments, identifiers (startBorealRuntime, BorealMessagingService) and storage keys are fine.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return n === "__tests__" || n === "node_modules" ? [] : files(p);
    return /\.(tsx?|jsx?)$/.test(n) && !/\.test\./.test(n) ? [p] : [];
  });
}

// Lines whose "Boreal" is not shown text.
const ALLOWED = [/BorealRuntime|borealRuntime|BorealMessagingService/, /n === "Boreal"/, /["'`]boreal_[a-z0-9_]+["'`]/];

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").split("\n").map((l) => l.replace(/(^|[^:"'`])\/\/.*$/, "$1")).join("\n");
}

describe("no Boreal branding in the client app", () => {
  it("has no Boreal or Maya in shown text", () => {
    const hits: string[] = [];
    for (const f of files(join(__dirname, ".."))) {
      stripComments(readFileSync(f, "utf-8")).split("\n").forEach((line, i) => {
        if (!/Boreal|\bMaya\b/.test(line)) return;
        if (ALLOWED.some((r) => r.test(line))) return;
        // Identifiers like MayaWidget / askMaya / X-Maya-Audience are code, not text.
        const text = line.replace(/\b\w*(Maya|Boreal)\w+\b|\b\w+(Maya|Boreal)\w*\b|X-Maya-[\w-]+|["']maya["']/g, "");
        if (/Boreal|\bMaya\b/.test(text)) hits.push(`${f}:${i + 1}: ${line.trim().slice(0, 120)}`);
      });
    }
    expect(hits).toEqual([]);
  });
});
