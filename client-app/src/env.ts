import { SERVER_URL } from "@/config/licensee"; // KS_CLIENT_v1_LICENSEE
export const ENV = {
  API_BASE: import.meta.env.VITE_API_BASE ||
            import.meta.env.VITE_API_BASE_URL ||
            import.meta.env.VITE_API_URL ||
            SERVER_URL,
  API_VERSION: import.meta.env.VITE_API_VERSION || "v1",
};


export function validateEnv() {
  // DO NOTHING — NEVER THROW
  console.log("ENV (safe):", ENV);
}
