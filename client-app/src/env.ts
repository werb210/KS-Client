import { SERVER_URL } from "@/config/licensee"; // KS_CLIENT_v1_LICENSEE
export const ENV = {
  // KS_SHARED_APP_BUILD_v1 - SERVER_URL already falls back to the VITE_API_* settings
  API_BASE: SERVER_URL,
  API_VERSION: import.meta.env.VITE_API_VERSION || "v1",
};


export function validateEnv() {
  // DO NOTHING — NEVER THROW
  console.log("ENV (safe):", ENV);
}
