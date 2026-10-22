// KS_CLIENT_v7_DEMO - starts the demo borrower page instead of the client app for /demo/<code> and /d/<code>. Nothing
// of the real app boots (no sign-in, analytics, journey tracking, push or service worker).
import React from "react";
import ReactDOM from "react-dom/client";
import DemoBorrowerApp from "./DemoBorrowerApp";

export function bootDemo(): void {
  document.title = "Keystone demo";
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <DemoBorrowerApp />
    </React.StrictMode>,
  );
}
