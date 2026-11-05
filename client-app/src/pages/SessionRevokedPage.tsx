import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/Card";
import { PrimaryButton } from "@/components/ui/Button";
import { components, layout } from "@/styles";

import { t as tr } from "@/i18n"; // KS_CLIENT_LANGUAGES_v1
export function SessionRevokedPage() {
  const navigate = useNavigate();

  return (
    <div style={layout.page}>
      <div style={layout.centerColumn}>
        <Card>
          <div style={layout.stackTight}>
            <h1 style={components.form.sectionTitle}>{tr("Access revoked")}</h1>
            <p style={components.form.subtitle}>{tr("This access link is no longer valid. Please verify your phone number again to continue.")}</p>
            <PrimaryButton
              style={{ width: "100%" }}
              onClick={() => navigate("/portal", { replace: true })}
            >{tr("Verify phone")}</PrimaryButton>
          </div>
        </Card>
      </div>
    </div>
  );
}

