#!/usr/bin/env node
// KS_CLIENT_v5_LICENSEE_APPS - checks licensee folders before an app is built.
//   node scripts/licensee/validate.mjs                 every licensee under licensees/
//   node scripts/licensee/validate.mjs keystone-demo   one licensee
// Exit 1 with a plain-English list of problems (bad ids, unreadable colour pairs below WCAG AA 4.5:1, wrong icon
// size, unknown wording keys, missing font files). Exit 0 when everything is ready to build.
import { listLicensees, loadLicensee, validateLicensee } from "./lib.mjs";

export function run(keys) {
  const list = keys.length ? keys : listLicensees();
  if (!list.length) {
    console.error("No licensees found under licensees/.");
    return 1;
  }
  let bad = 0;
  for (const key of list) {
    let errors;
    try {
      const { config, dir } = loadLicensee(key);
      errors = validateLicensee(config, { dir, key });
    } catch (e) {
      errors = [e.message];
    }
    if (errors.length) {
      bad += 1;
      console.error(`x ${key}`);
      for (const e of errors) console.error(`    - ${e}`);
    } else {
      console.log(`ok ${key}`);
    }
  }
  return bad ? 1 : 0;
}

process.exitCode = run(process.argv.slice(2).filter((a) => a !== "all"));
