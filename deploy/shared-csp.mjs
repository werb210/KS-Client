#!/usr/bin/env node
// KS_SHARED_APP_BUILD_v1 - the shared client build serves every brokerage, so its Content-Security-Policy allows any
// brokerage's KS-server (https/wss://*.api.<domain>) next to the development server, instead of one server.
//   node deploy/shared-csp.mjs <dist dir> <domain>
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const DEV_SERVER_HOST = "ks-server-dev-chb5htbwaue2hygk.canadacentral-01.azurewebsites.net";

export function sharedPolicy(csp, domain) {
  return String(csp)
    .split(";")
    .map((part) => {
      const tokens = part.trim().split(/\s+/).filter(Boolean);
      for (const scheme of ["https", "wss"]) {
        const dev = `${scheme}://${DEV_SERVER_HOST}`;
        const add = `${scheme}://*.api.${domain}`;
        const i = tokens.indexOf(dev);
        if (i >= 0 && !tokens.includes(add)) tokens.splice(i + 1, 0, add);
      }
      return tokens.join(" ");
    })
    .filter(Boolean)
    .join("; ") + (String(csp).trim().endsWith(";") ? ";" : "");
}

export function patchSharedConfig(json, domain) {
  const cfg = JSON.parse(json);
  const fix = (h) => {
    if (h && typeof h["Content-Security-Policy"] === "string") h["Content-Security-Policy"] = sharedPolicy(h["Content-Security-Policy"], domain);
  };
  fix(cfg.globalHeaders);
  for (const r of cfg.routes ?? []) fix(r.headers);
  return JSON.stringify(cfg, null, 2) + "\n";
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [dist, domain] = process.argv.slice(2);
  if (!dist || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(String(domain))) {
    console.error("usage: node deploy/shared-csp.mjs <dist dir> <domain>");
    process.exit(1);
  }
  const file = path.join(dist, "staticwebapp.config.json");
  writeFileSync(file, patchSharedConfig(readFileSync(file, "utf8"), domain));
  console.log(`[shared-csp] ${file}: allows *.api.${domain}`);
}
