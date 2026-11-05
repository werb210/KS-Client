import { components } from "@/styles";

import { t as tr } from "@/i18n"; // KS_CLIENT_LANGUAGES_v1
type SpinnerProps = {
  variant?: "light" | "dark";
};

export function Spinner({ variant = "dark" }: SpinnerProps) {
  return (
    <span
      style={
        variant === "light"
          ? components.buttons.spinner
          : components.buttons.spinnerDark
      }
      aria-label={tr("Loading")}
    />
  );
}
