// KS_CLIENT_PREVIEW_APP_v1 - starts the preview build. early.ts has already locked the network and put storage in
// memory. The sample client is "signed in" with a token that is never sent anywhere and the wizard starts filled in
// with the sample file (the same sample the live demo uses), so every screen can be tapped through.
import React from "react";
import ReactDOM from "react-dom/client";
import { prepareLiveDemo } from "../liveDemo/bootLiveDemo";
import PreviewApp from "./PreviewApp";

export function bootPreview(): void {
  prepareLiveDemo();
  // "Start again" reloads the page: storage is in memory, so the app starts over from the sample file.
  const restart = () => window.location.reload();
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <PreviewApp onRestart={restart} />
    </React.StrictMode>,
  );
}
