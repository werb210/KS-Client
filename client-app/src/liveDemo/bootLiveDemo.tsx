// KS_CLIENT_v11_LIVE_DEMO - starts the client app as the live demo (/tour). early.ts has already put storage in memory
// and fetch on the in-browser sample server. Here the client is "signed in" with a fake token, the wizard is filled
// in with the sample file, and the real routes render under the guided tour. Nothing else of the normal boot runs: no
// analytics, journey tracking, consent banner, Clarity, push, service worker, credential hydration or watchers.
import React from "react";
import ReactDOM from "react-dom/client";
import { setToken } from "../auth/token";
import { setApplicationToken } from "../auth/applicationToken";
import { applyBrokerPrefill } from "../state/useApplicationStore";
import LiveDemoApp from "./LiveDemoApp";
import { isEmbedded, parentOriginFrom } from "./mode";
import { DEMO_APPLICATION_ID, samplePrefill } from "./sample";

/** An unsigned token in the shape the app reads (it is never sent anywhere: the sample server answers every call). */
export function fakeClientToken(): string {
  const enc = (o: unknown) => btoa(JSON.stringify(o)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
  return `${enc({ alg: "none", typ: "JWT" })}.${enc({ sub: "live-demo-client", role: "client", phone: "+17805550142", demo: true, exp: 4102444800 })}.`;
}

/** Signs the demo client in and fills the wizard with the sample file. */
export function prepareLiveDemo(): void {
  setToken(fakeClientToken());
  setApplicationToken(DEMO_APPLICATION_ID);
  try {
    // The portal's "add to home screen" card is not part of the demo.
    window.localStorage.setItem("boreal.install-prompt.dismissed", "1");
  } catch {
    /* in-memory storage; cannot fail in practice */
  }
  applyBrokerPrefill(DEMO_APPLICATION_ID, samplePrefill());
}

export function bootLiveDemo(): void {
  prepareLiveDemo();
  const search = window.location.search;
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <LiveDemoApp parentOrigin={parentOriginFrom(search)} embedded={isEmbedded(search)} />
    </React.StrictMode>,
  );
}
