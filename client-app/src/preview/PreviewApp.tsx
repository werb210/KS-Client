// KS_CLIENT_PREVIEW_APP_v1 - the preview app's shell: the real client routes (application wizard, documents, the
// client portal with its More tab and loan calculator) on an in-memory router, under a banner that says it is a
// preview on sample data. The native runtime, push, usage tracking, update/install banners, Face ID lock and the
// assistant widget of the normal shell are left out, as in the live demo.
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import AppRoutes from "../app/AppRoutes";
import ErrorBoundary from "../app/ErrorBoundary";
import FatalErrorScreen from "../app/FatalErrorScreen";
import { PREVIEW_BANNER_TEXT } from "./mode";

export function PreviewBanner({ onRestart }: { onRestart?: () => void }) {
  return (
    <div
      role="note"
      data-testid="preview-banner"
      style={{
        // A small pill at the top centre, under the status bar: it stays readable on every screen and leaves the
        // wizard's buttons and the portal's tab bar free.
        position: "fixed",
        top: "calc(env(safe-area-inset-top, 0px) + 4px)",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 2147483000,
        display: "flex",
        alignItems: "center",
        gap: 8,
        maxWidth: "calc(100vw - 16px)",
        padding: "4px 6px 4px 12px",
        borderRadius: 999,
        background: "rgba(17, 24, 39, 0.92)",
        color: "#FFFFFF",
        font: "600 12px/1.3 system-ui, -apple-system, sans-serif",
        whiteSpace: "nowrap",
        pointerEvents: "none",
        boxShadow: "0 1px 4px rgba(0, 0, 0, 0.25)",
      }}
    >
      <span>{PREVIEW_BANNER_TEXT}</span>
      {onRestart ? (
        <button
          type="button"
          onClick={onRestart}
          data-testid="preview-restart"
          style={{
            pointerEvents: "auto",
            background: "#FFFFFF",
            color: "#1F2937",
            border: 0,
            borderRadius: 999,
            padding: "3px 10px",
            font: "600 12px/1.3 system-ui, -apple-system, sans-serif",
            cursor: "pointer",
          }}
        >
          Start again
        </button>
      ) : null}
    </div>
  );
}

export type PreviewAppProps = { initialPath?: string; onRestart?: () => void; children?: ReactNode };

export default function PreviewApp({ initialPath = "/apply/step-1", onRestart, children }: PreviewAppProps) {
  return (
    <MemoryRouter initialEntries={[initialPath]}>
      <ErrorBoundary fallback={<FatalErrorScreen />}>
        <AppRoutes />
      </ErrorBoundary>
      {children}
      <PreviewBanner onRestart={onRestart} />
    </MemoryRouter>
  );
}
