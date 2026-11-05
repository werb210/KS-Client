import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { components, layout } from "@/styles";

import { t as tr } from "@/i18n"; // KS_CLIENT_LANGUAGES_v1
export function OfflineFallback() {
  return (
    <div style={layout.page}>
      <div style={layout.centerColumn}>
        <Card>
          <div style={layout.stackTight}>
            <div style={components.form.eyebrow}>{tr("Offline mode")}</div>
            <h1 style={components.form.title}>{tr("Limited access")}</h1>
            <p style={components.form.subtitle}>{tr("You’re offline, so the portal is available in read-only mode. Reconnect to upload documents, send messages, or submit updates.")}</p>
            <Button
              style={{ width: "100%", maxWidth: "260px" }}
              onClick={() => window.location.reload()}
            >{tr("Retry connection")}</Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
