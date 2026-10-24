// Private mode: when ALLOWED_EMAILS is set, the whole app needs a Google sign-in
// with one of those emails (checked at sign-in in auth.ts and on every request
// in proxy.ts). Unset = the app is open to everyone, as before.

/** Allowed emails (lowercase), or null when private mode is off. */
export function allowedEmails(raw = process.env.ALLOWED_EMAILS): string[] | null {
  const list = (raw ?? "")
    .split(/[\s,;]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.length ? list : null;
}

export const loginRequired = () => allowedEmails() !== null;

/** True when private mode is off, or the email is on the list. */
export function isAllowedEmail(email: string | null | undefined, list = allowedEmails()): boolean {
  if (!list) return true;
  return Boolean(email) && list.includes(email!.trim().toLowerCase());
}

// Reachable without signing in: the sign-in and privacy pages, Auth.js itself,
// the daily cron (it checks CRON_SECRET) and the health check.
const OPEN_PATHS = [/^\/signin$/, /^\/privacy$/, /^\/api\/auth(\/|$)/, /^\/api\/cron\//, /^\/api\/health$/];

export type GateDecision = "allow" | "signin" | "unauthorized";

export function gate(pathname: string, email: string | null | undefined, list = allowedEmails()): GateDecision {
  if (!list || OPEN_PATHS.some((p) => p.test(pathname))) return "allow";
  if (email && isAllowedEmail(email, list)) return "allow";
  return pathname.startsWith("/api/") ? "unauthorized" : "signin";
}
