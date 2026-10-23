// KS_CLIENT_v11_LIVE_DEMO - the live demo's app shell: the real routes (wizard and client portal) plus the tour.
// The banners, overlays and watchers of the normal shell (native runtime, usage tracking, share inbox, retry, update
// and install banners, session refresh, Face ID lock, assistant widget) are left out on purpose.
//
// The router lives in memory, starting at /apply/step-1: the address bar stays on /tour (the one path the portal is
// allowed to frame), a reload restarts the demo cleanly, and nothing navigates the page itself.
import { MemoryRouter } from "react-router-dom";
import AppRoutes from "../app/AppRoutes";
import ErrorBoundary from "../app/ErrorBoundary";
import FatalErrorScreen from "../app/FatalErrorScreen";
import TourOverlay from "./TourOverlay";

export type LiveDemoAppProps = {
  parentOrigin: string | null;
  embedded: boolean;
  sidePanel?: boolean;
  initialPath?: string;
  openTop?: (url: string) => void;
};

export default function LiveDemoApp({ parentOrigin, embedded, sidePanel = false, initialPath = "/apply/step-1", openTop }: LiveDemoAppProps) {
  return (
    <MemoryRouter initialEntries={[initialPath]}>
      <ErrorBoundary fallback={<FatalErrorScreen />}>
        <AppRoutes />
      </ErrorBoundary>
      <TourOverlay parentOrigin={parentOrigin} embedded={embedded} sidePanel={sidePanel} openTop={openTop} />
    </MemoryRouter>
  );
}
