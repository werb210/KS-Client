import { describe, expect, it } from "vitest";
import { addressesFromHost, runtimeConfig } from "../licensee";

// KS_SHARED_APP_BUILD_v1
describe("shared build addresses (client app)", () => {
  it("reads the web host's /ks-config.js answer", () => {
    expect(runtimeConfig({ __KS_CONFIG__: { server_url: "https://acme.api.k.test" } }).server_url).toBe("https://acme.api.k.test");
    expect(runtimeConfig(undefined)).toEqual({});
  });
  it("works out the server from a client app address", () => {
    expect(addressesFromHost("acme.app.keystonecrm.online")).toEqual({ server: "https://acme.api.keystonecrm.online", client: "https://acme.app.keystonecrm.online" });
    expect(addressesFromHost("wonderful-island-0b68ae310.5.azurestaticapps.net")).toBeNull();
  });
});
