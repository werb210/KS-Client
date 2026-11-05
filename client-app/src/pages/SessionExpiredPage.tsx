import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/Card";
import { PrimaryButton } from "@/components/ui/Button";
import { components, layout } from "@/styles";

import { t as tr } from "@/i18n"; // KS_CLIENT_LANGUAGES_v1
export function SessionExpiredPage() {
  const navigate = useNavigate();

  return (
    <div style={layout.page}>
      <div style={layout.centerColumn}>
        <Card>
          <div style={layout.stackTight}>
            <h1 style={components.form.sectionTitle}>{tr("Session expired")}</h1>
            <p style={components.form.subtitle}>{tr("Your access link has expired. Please verify your phone number to receive a fresh link and resume your application.")}</p>
            <PrimaryButton
              style={{ width: "100%" }}
              onClick={() => navigate("/portal", { replace: true })}
            >{tr("Re-enter portal")}</PrimaryButton>
          </div>
        </Card>
      </div>
    </div>
  );
}

