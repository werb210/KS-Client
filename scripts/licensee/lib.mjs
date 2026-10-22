// KS_CLIENT_v5_LICENSEE_APPS - shared helpers for per-licensee client apps.
// One codebase, one branded app per licensee: licensees/<key>/licensee.json (+ icon, splash, fonts) says how that
// licensee's app looks and which KS-server it talks to. Used by:
//   scripts/licensee/validate.mjs   (checks every licensee folder; CI runs it)
//   scripts/brand-native.mjs        (writes the iOS/Android projects for one licensee)
//   client-app/vite.config.ts       (web build for VITE_LICENSEE=<key>)
// Plain Node (no dependencies) so it runs before `npm ci` and inside the Vite config.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const LICENSEES_DIR = path.join(REPO_ROOT, "licensees");
export const SCHEMA_PATH = path.join(LICENSEES_DIR, "licensee.schema.json");
export const COPY_DEFAULTS_PATH = path.join(REPO_ROOT, "client-app", "src", "config", "copy.defaults.json");

/** Words a wording override may use, filled in by client-app/src/config/copy.ts. */
export const COPY_VARS = ["name", "year", "support_email", "support_phone"];
/** WCAG AA for body text. */
export const MIN_CONTRAST = 4.5;
export const ICON_SIZE = 1024;
export const SPLASH_SIZE = 2732;

export const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));

/** Keys of every licensee folder that has a licensee.json, sorted. */
export function listLicensees(dir = LICENSEES_DIR) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((n) => statSync(path.join(dir, n)).isDirectory() && existsSync(path.join(dir, n, "licensee.json")))
    .sort();
}

export function licenseeDir(key, dir = LICENSEES_DIR) {
  if (!/^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/.test(String(key))) throw new Error(`Not a licensee key: "${key}"`);
  return path.join(dir, key);
}

export function loadLicensee(key, dir = LICENSEES_DIR) {
  const folder = licenseeDir(key, dir);
  const file = path.join(folder, "licensee.json");
  if (!existsSync(file)) throw new Error(`No licensee "${key}" (missing ${path.relative(REPO_ROOT, file)})`);
  return { config: readJson(file), dir: folder };
}

// ---------- a small JSON-schema checker (the subset licensee.schema.json uses) ----------
function resolveRef(schema, root) {
  if (!schema || !schema.$ref) return schema;
  const parts = schema.$ref.replace(/^#\//, "").split("/");
  let node = root;
  for (const p of parts) node = node?.[p];
  return { ...node, ...Object.fromEntries(Object.entries(schema).filter(([k]) => k !== "$ref")) };
}

function typeOf(v) {
  if (Array.isArray(v)) return "array";
  if (v === null) return "null";
  if (Number.isInteger(v)) return "integer";
  return typeof v;
}

export function checkSchema(value, schema, root = schema, at = "") {
  const errors = [];
  const s = resolveRef(schema, root);
  const where = at || "(root)";
  if (s.type) {
    const t = typeOf(value);
    const ok = s.type === t || (s.type === "number" && t === "integer");
    if (!ok) return [`${where}: should be ${s.type}`];
  }
  if (s.enum && !s.enum.includes(value)) errors.push(`${where}: should be one of ${s.enum.join(", ")}`);
  if (typeof value === "string") {
    if (s.minLength != null && value.length < s.minLength) errors.push(`${where}: too short (min ${s.minLength})`);
    if (s.maxLength != null && value.length > s.maxLength) errors.push(`${where}: too long (max ${s.maxLength})`);
    if (s.pattern && !new RegExp(s.pattern).test(value)) errors.push(`${where}: "${value}" is not allowed (${s.description || "pattern " + s.pattern})`);
  }
  if (typeof value === "number") {
    if (s.minimum != null && value < s.minimum) errors.push(`${where}: below ${s.minimum}`);
    if (s.maximum != null && value > s.maximum) errors.push(`${where}: above ${s.maximum}`);
  }
  if (Array.isArray(value)) {
    if (s.minItems != null && value.length < s.minItems) errors.push(`${where}: needs at least ${s.minItems} item(s)`);
    if (s.items) value.forEach((v, i) => errors.push(...checkSchema(v, s.items, root, `${at}[${i}]`)));
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const r of s.required || []) if (!(r in value)) errors.push(`${at ? at + "." : ""}${r}: required`);
    const props = s.properties || {};
    for (const [k, v] of Object.entries(value)) {
      const child = at ? `${at}.${k}` : k;
      if (props[k]) errors.push(...checkSchema(v, props[k], root, child));
      else if (s.additionalProperties === false) errors.push(`${child}: unknown field`);
      else if (s.additionalProperties && typeof s.additionalProperties === "object") errors.push(...checkSchema(v, s.additionalProperties, root, child));
    }
  }
  return errors;
}

// ---------- colour contrast (WCAG 2.x) ----------
export function luminance(hex) {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(String(hex));
  if (!m) throw new Error(`Not a #RRGGBB colour: ${hex}`);
  const [r, g, b] = [m[1], m[2], m[3]].map((h) => {
    const c = parseInt(h, 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Every text-on-colour pair the app draws with the licensee's colours. */
export function colourPairs(colors) {
  const c = { on_primary: "#FFFFFF", ...colors };
  return [
    { label: "text on background", fg: c.text, bg: c.background },
    { label: "text on white cards", fg: c.text, bg: "#FFFFFF" },
    { label: "primary (headings, links) on background", fg: c.primary, bg: c.background },
    { label: "primary (headings, links) on white cards", fg: c.primary, bg: "#FFFFFF" },
    { label: "on_primary (button text) on primary", fg: c.on_primary, bg: c.primary },
    { label: "primary text on secondary fills", fg: c.primary, bg: c.secondary },
  ];
}

export function contrastErrors(colors, min = MIN_CONTRAST) {
  const errors = [];
  for (const p of colourPairs(colors)) {
    if (!p.fg || !p.bg) continue;
    let r;
    try { r = contrastRatio(p.fg, p.bg); } catch (e) { errors.push(`colors: ${e.message}`); continue; }
    if (r < min) errors.push(`colors: ${p.label} is ${r.toFixed(2)}:1 (${p.fg} on ${p.bg}); needs at least ${min}:1 (WCAG AA body text)`);
  }
  return errors;
}

// ---------- images ----------
/** Width/height/colour type of a PNG, or null when the file is not a PNG. */
export function pngInfo(buf) {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (!buf || buf.length < 33 || sig.some((b, i) => buf[i] !== b)) return null;
  if (buf.toString("ascii", 12, 16) !== "IHDR") return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), colorType: buf[25] };
}

function inside(dir, rel) {
  const p = path.resolve(dir, rel);
  return p.startsWith(path.resolve(dir) + path.sep) ? p : null;
}

function checkPng(dir, rel, size, label, errors, exact) {
  const p = inside(dir, rel);
  if (!p) return errors.push(`assets.${label}: must be inside the licensee folder`);
  if (!existsSync(p)) return errors.push(`assets.${label}: ${rel} is missing`);
  const info = pngInfo(readFileSync(p));
  if (!info) return errors.push(`assets.${label}: ${rel} is not a PNG`);
  const ok = exact ? info.width === size && info.height === size : info.width === info.height && info.width >= size;
  if (!ok) errors.push(`assets.${label}: ${rel} is ${info.width}x${info.height}; needs ${size}x${size}${exact ? "" : " or larger (square)"}`);
}

// ---------- the whole check ----------
/**
 * Every problem with one licensee, as plain-English lines. Empty array = good to build.
 * opts.dir: the licensee folder (for files); opts.key: folder name; opts.schema / opts.copyDefaults for tests.
 */
export function validateLicensee(config, opts = {}) {
  const schema = opts.schema || readJson(SCHEMA_PATH);
  const copyDefaults = opts.copyDefaults || readJson(COPY_DEFAULTS_PATH);
  const errors = checkSchema(config, schema);
  if (!config || typeof config !== "object") return errors;
  if (opts.key && config.key !== opts.key) errors.push(`key: "${config.key}" must match the folder name "${opts.key}"`);
  if (config.colors && typeof config.colors === "object") errors.push(...contrastErrors(config.colors));
  if (config.wording && typeof config.wording === "object") {
    for (const [k, v] of Object.entries(config.wording)) {
      if (!(k in copyDefaults)) { errors.push(`wording.${k}: unknown key (see client-app/src/config/copy.defaults.json)`); continue; }
      for (const m of String(v).matchAll(/\{([a-z_]+)\}/g)) {
        if (!COPY_VARS.includes(m[1])) errors.push(`wording.${k}: {${m[1]}} is not available (use ${COPY_VARS.map((x) => `{${x}}`).join(", ")})`);
      }
    }
  }
  const fonts = config.fonts && typeof config.fonts === "object" ? config.fonts : {};
  for (const [which, f] of Object.entries(fonts)) {
    if (!f || typeof f !== "object") continue;
    if (f.google && f.files) errors.push(`fonts.${which}: use either google or files, not both`);
    if (opts.dir) for (const file of f.files || []) {
      const p = inside(opts.dir, file.file || "");
      if (!p || !existsSync(p)) errors.push(`fonts.${which}: ${file.file} is missing from the licensee folder`);
    }
  }
  if (opts.dir && config.assets && typeof config.assets === "object") {
    if (config.assets.icon) checkPng(opts.dir, config.assets.icon, ICON_SIZE, "icon", errors, true);
    if (config.assets.splash) checkPng(opts.dir, config.assets.splash, SPLASH_SIZE, "splash", errors, false);
    if (config.assets.splash_dark) checkPng(opts.dir, config.assets.splash_dark, SPLASH_SIZE, "splash_dark", errors, false);
  }
  return errors;
}

// ---------- what the web build and the app get ----------
/** The part of licensee.json the running app sees (VITE_KS_LICENSEE). Nothing secret lives in licensee.json. */
export function runtimeConfig(c) {
  return {
    key: c.key,
    app_name: c.app_name,
    company_name: c.company_name,
    colors: { on_primary: "#FFFFFF", ...c.colors },
    fonts: { body: c.fonts.body.family, heading: (c.fonts.heading || c.fonts.body).family },
    wording: c.wording || {},
    support: { email: c.support.email, phone: c.support.phone || "" },
    legal: { privacy_url: c.legal.privacy_url, terms_url: c.legal.terms_url },
    ios_bundle_id: c.ios.bundle_id,
    android_application_id: c.android.application_id,
  };
}

/** VITE_* variables for this licensee's build. */
export function buildEnv(c) {
  return {
    VITE_LICENSEE: c.key,
    VITE_API_BASE: c.server_url,
    VITE_API_BASE_URL: c.server_url,
    VITE_API_URL: c.server_url,
    VITE_CLIENT_APP_URL: c.client_web_url,
    VITE_WEBSITE_URL: c.website_url || c.client_web_url,
    VITE_SUPPORT_EMAIL: c.support.email,
    VITE_COMPANY_NAME: c.company_name,
    VITE_KS_LICENSEE: JSON.stringify(runtimeConfig(c)),
  };
}

/** Google Fonts stylesheet for the licensee's google fonts, or "" when none. */
export function googleFontsHref(c) {
  const fams = new Map();
  for (const f of [c.fonts.body, c.fonts.heading]) {
    if (!f || !f.google) continue;
    const w = new Set([...(fams.get(f.family) || []), ...(f.weights || [400, 700])]);
    fams.set(f.family, [...w].sort((a, b) => a - b));
  }
  if (!fams.size) return "";
  return "https://fonts.googleapis.com/css2?" + [...fams].map(([f, w]) => `family=${f.replace(/ /g, "+")}:wght@${w.join(";")}`).join("&") + "&display=swap";
}

/** @font-face rules for font files; urls are under /licensee-fonts/. */
export function fontFaceCss(c) {
  const rules = [];
  for (const f of [c.fonts.body, c.fonts.heading]) {
    for (const file of (f && f.files) || []) {
      const ext = path.extname(file.file).slice(1);
      const format = { woff2: "woff2", woff: "woff", ttf: "truetype", otf: "opentype" }[ext];
      rules.push(`@font-face{font-family:"${f.family}";src:url("/licensee-fonts/${path.basename(file.file)}") format("${format}");font-weight:${file.weight};font-style:${file.style || "normal"};font-display:swap}`);
    }
  }
  return rules.join("\n");
}

/** Keystone's built-in palette and faces, swapped for the licensee's at build time. */
export const DEFAULT_THEME = {
  colors: { primary: ["#0B1F3A", "#081729"], secondary: ["#BF9B49"], background: ["#F5F8FC"], text: ["#51617D"] },
  fonts: { body: "Public Sans", heading: "Libre Caslon Text" },
};

/** Swaps Keystone's colours and font names for the licensee's in CSS/TSX text. */
export function swapTheme(code, c) {
  let out = code;
  for (const [role, hexes] of Object.entries(DEFAULT_THEME.colors)) {
    const to = c.colors[role];
    if (!to) continue;
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(to.slice(i, i + 2), 16));
    for (const hex of hexes) {
      const h = hex.slice(1);
      // #RRGGBB, #RRGGBBAA (keeps the alpha) and %23RRGGBB (inside data: SVG urls)
      out = out.replace(new RegExp(`(#|%23)${h}(?=(?:[0-9A-Fa-f]{2})?(?![0-9A-Fa-f]))`, "gi"), (_m, p) => p + to.slice(1));
      // rgb(...) / rgba(...) with the same colour
      const [dr, dg, db] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
      out = out.replace(new RegExp(`(rgba?\\(\\s*)${dr}\\s*,\\s*${dg}\\s*,\\s*${db}(?=\\s*[,)])`, "g"), (_m, p) => `${p}${r}, ${g}, ${b}`);
    }
  }
  const body = c.fonts.body.family;
  const heading = (c.fonts.heading || c.fonts.body).family;
  out = out.replace(/Public Sans/g, body).replace(/Libre Caslon Text/g, heading);
  return out;
}
