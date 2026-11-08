// KS_SHARED_APP_BUILD_v1
import { test } from "node:test";
import assert from "node:assert/strict";
import { DEV_SERVER_HOST, patchSharedConfig, sharedPolicy } from "./shared-csp.mjs";
import { blobPrefix } from "./publish-site.mjs";

test("the shared build allows every brokerage's server", () => {
  const p = sharedPolicy(`default-src 'self'; connect-src 'self' https://${DEV_SERVER_HOST} wss://${DEV_SERVER_HOST};`, "k.test");
  assert.match(p, /https:\/\/\*\.api\.k\.test/);
  assert.match(p, /wss:\/\/\*\.api\.k\.test/);
  const cfg = JSON.parse(patchSharedConfig(JSON.stringify({ globalHeaders: { "Content-Security-Policy": `connect-src https://${DEV_SERVER_HOST}` } }), "k.test"));
  assert.match(cfg.globalHeaders["Content-Security-Policy"], /\*\.api\.k\.test/);
});

test("publishes to sites/_shared/client/", () => {
  assert.equal(blobPrefix("_shared", "client"), "_shared/client/");
});
