// KS_CLIENT_SETTINGS_PACK_v1 - the public booking and survey pages talk to KS-server without signing in.
import { SERVER_URL } from "@/config/licensee";

export class PublicApiError extends Error {
  constructor(message: string, readonly status: number, readonly body: any) { super(message); }
}

export async function publicApi<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`${SERVER_URL}${path}`, {
    method: init.method ?? "GET",
    headers: init.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  let body: any = null;
  try { body = await res.json(); } catch { body = null; }
  if (!res.ok) throw new PublicApiError(String(body?.message ?? body?.error ?? `Request failed (${res.status})`), res.status, body);
  return body as T;
}

export function dayKey(iso: string, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}
export function dayLabel(iso: string, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, weekday: "long", month: "long", day: "numeric" }).format(new Date(iso));
}
export function timeLabel(iso: string, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(new Date(iso));
}
