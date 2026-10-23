// KS_CLIENT_v5_LICENSEE_APPS - builds the client app for one licensee (VITE_LICENSEE=<key>, from the shell or from
// client-app/.env.production.local written by scripts/brand-native.mjs). Without VITE_LICENSEE nothing changes: the
// build is the default Keystone client.
//
// For a licensee it:
//   - points the app at the licensee's server, web address and support email (VITE_* variables)
//   - passes the public part of licensee.json to the app (VITE_KS_LICENSEE: name, colours, wording, legal links)
//   - swaps Keystone's colours and fonts for the licensee's in CSS and components (build time, nothing at runtime)
//   - sets the page title, theme colour, canonical address, fonts, manifest, icons and the SWA server rewrite/CSP
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { loadEnv, type Plugin } from "vite";
// Plain .mjs helper shared with the Node scripts (scripts/licensee/lib.mjs).
import { buildEnv, fontFaceCss, googleFontsHref, loadLicensee, swapTheme, validateLicensee } from "../scripts/licensee/lib.mjs";

const DEV_SERVER = "https://ks-server-dev-chb5htbwaue2hygk.canadacentral-01.azurewebsites.net";
const DEFAULT_FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Libre+Caslon+Text:wght@400;700&family=Public+Sans:wght@400;500;600;700&display=swap";

// KS_LICENSEE_DEPLOY_v1 - the server a deploy passes in from the shell (a licensee's GitHub environment sets
// VITE_API_BASE_URL), or "" when none is set. Without one the build keeps client-app/.env.production (the development
// server) or, for a VITE_LICENSEE build, licensees/<key>/licensee.json's server_url.
const SERVER_KEYS = ["VITE_API_BASE", "VITE_API_BASE_URL", "VITE_API_URL"] as const;

export function shellServerUrl(env: Record<string, string | undefined> = process.env): string {
  for (const key of SERVER_KEYS) {
    const value = String(env[key] ?? "").trim();
    if (/^https:\/\/[^\s/]+/i.test(value)) return value.replace(/\/+$/, "");
  }
  return "";
}

/** staticwebapp.config.json with the development server's host (the /api rewrite and the CSP) swapped for `host`. */
export function swapServerHost(text: string, host: string): string {
  return text.split(new URL(DEV_SERVER).host).join(host);
}

/**
 * A build without VITE_LICENSEE whose server comes from the shell: use it for every server variable and point the
 * Static Web Apps rewrite and CSP at it.
 * null (nothing changes) when no server is passed in or it is the development server.
 */
export function serverPlugin(env: Record<string, string | undefined> = process.env): Plugin | null {
  const url = shellServerUrl(env);
  if (!url) return null;
  const host = new URL(url).host;
  if (host === new URL(DEV_SERVER).host) return null;
  // Every server variable the app reads (some code reads VITE_API_URL first), so none keeps .env.production's value.
  for (const key of SERVER_KEYS) env[key] = url;
  let outDir = "dist";
  return {
    name: "ks-server",
    configResolved(cfg) {
      outDir = path.resolve(cfg.root, cfg.build.outDir);
    },
    writeBundle() {
      const swaPath = path.join(outDir, "staticwebapp.config.json");
      if (existsSync(swaPath)) writeFileSync(swaPath, swapServerHost(readFileSync(swaPath, "utf8"), host));
    },
  };
}

/** The licensee key for this build, or "" for the default client. */
export function licenseeKeyFor(mode: string, dir: string): string {
  const fromShell = String(process.env.VITE_LICENSEE ?? "").trim();
  if (fromShell) return fromShell;
  return String(loadEnv(mode, dir, "VITE_").VITE_LICENSEE ?? "").trim();
}

export function licenseePlugin(mode: string, dir: string): Plugin | null {
  const key = licenseeKeyFor(mode, dir);
  if (!key || key === "default") return null;
  const { config: c, dir: folder } = loadLicensee(key);
  const errors: string[] = validateLicensee(c, { dir: folder, key });
  if (errors.length) throw new Error(`licensees/${key} is not ready:\n  - ${errors.join("\n  - ")}`);

  // Vite reads VITE_* from process.env after this config runs, and those win over the .env files.
  // KS_LICENSEE_DEPLOY_v1 - a server passed in from the shell wins over licensee.json's server_url.
  const shellServer = shellServerUrl();
  Object.assign(process.env, buildEnv(c));
  if (shellServer) for (const key of SERVER_KEYS) process.env[key] = shellServer;

  const fontFiles: string[] = [c.fonts.body, c.fonts.heading]
    .flatMap((f: any) => (f && f.files ? f.files.map((x: any) => path.join(folder, x.file)) : []));
  const fontsHref: string = googleFontsHref(c);
  const faceCss: string = fontFaceCss(c);
  const serverHost = new URL(shellServer || c.server_url).host;
  let outDir = path.join(dir, "dist");

  return {
    name: "ks-licensee",
    // Normal order: runs after CSS is compiled (Tailwind included) and before Vite turns it into a module.
    configResolved(cfg) {
      outDir = path.resolve(cfg.root, cfg.build.outDir);
    },
    transform(code, id) {
      const file = id.split("?")[0] ?? "";
      if (file.includes("node_modules") || !/\.(css|tsx?|jsx?)$/.test(file)) return null;
      const next = swapTheme(code, c);
      return next === code ? null : { code: next, map: null };
    },
    transformIndexHtml(html) {
      const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
      const put = (v: string) => (_m: string, a: string, b: string) => a + esc(v) + b;
      let out = html
        .replace(/(<title>)[^<]*(<\/title>)/, put(c.company_name))
        .replace(/(<meta name="apple-mobile-web-app-title" content=")[^"]*(")/, put(c.app_name))
        .replace(/(<meta name="theme-color" content=")[^"]*(")/, put(c.colors.primary))
        .replace(/(<link rel="canonical" href=")[^"]*(")/, put(`${c.client_web_url}/`));
      // Keystone's Google Fonts link becomes the licensee's (or goes, when the licensee ships its own font files).
      const link = new RegExp(`<link[^>]*href="${DEFAULT_FONTS_HREF.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*>`);
      out = out.replace(link, fontsHref ? `<link rel="stylesheet" href="${fontsHref}" />` : "");
      const style = `<style data-ks-licensee="${c.key}">${faceCss}\n:root{--ks-primary:${c.colors.primary};--ks-secondary:${c.colors.secondary};--ks-background:${c.colors.background};--ks-text:${c.colors.text};--ks-on-primary:${c.colors.on_primary || "#FFFFFF"}}\nhtml,body{background:${c.colors.background}}</style>`;
      return out.replace("</head>", `    ${style}\n  </head>`);
    },
    configureServer(server) {
      // Dev server: serve font files from the licensee folder.
      server.middlewares.use((req, res, next) => {
        const m = /^\/licensee-fonts\/([^/?]+)/.exec(req.url || "");
        const hit = m && fontFiles.find((f) => path.basename(f) === m[1]);
        if (!hit) return next();
        res.end(readFileSync(hit));
      });
    },
    writeBundle() {
      // Fonts.
      if (fontFiles.length) {
        mkdirSync(path.join(outDir, "licensee-fonts"), { recursive: true });
        for (const f of fontFiles) copyFileSync(f, path.join(outDir, "licensee-fonts", path.basename(f)));
      }
      // Icons: the licensee's 1024 icon under every name the page and manifest use (browsers scale it).
      const icon = path.join(folder, c.assets.icon);
      for (const name of ["favicon.png", "Favicon.png", "apple-touch-icon.png", "apple-touch-icon-180x180.png", "icon-192.png", "icon-512.png",
        "icons/icon-192x192.png", "icons/icon-512x512.png", "icons/icon-512-maskable.png"]) {
        const dest = path.join(outDir, name);
        if (existsSync(path.dirname(dest))) copyFileSync(icon, dest);
      }
      // Manifest.
      const manifestPath = path.join(outDir, "manifest.webmanifest");
      if (existsSync(manifestPath)) {
        const m = JSON.parse(readFileSync(manifestPath, "utf8"));
        Object.assign(m, { name: c.company_name, short_name: c.app_name, background_color: c.colors.background, theme_color: c.colors.primary });
        writeFileSync(manifestPath, JSON.stringify(m, null, 2) + "\n");
      }
      // Static Web Apps: /api rewrite and Content-Security-Policy point at the licensee's server.
      const swaPath = path.join(outDir, "staticwebapp.config.json");
      if (existsSync(swaPath)) {
        writeFileSync(swaPath, swapServerHost(readFileSync(swaPath, "utf8"), serverHost));
      }
    },
  };
}
