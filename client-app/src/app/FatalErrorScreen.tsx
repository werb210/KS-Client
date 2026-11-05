import { t as tr } from "@/i18n"; // KS_CLIENT_LANGUAGES_v1
export default function FatalErrorScreen() {
  return (
    <div style={{ padding: 40 }}>
      <h2>{tr("Application Error")}</h2>
      <p>{tr("A fatal error occurred. Please refresh the page.")}</p>
    </div>
  );
}
