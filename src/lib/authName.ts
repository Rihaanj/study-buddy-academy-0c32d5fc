// Name + password identity helpers.
// A student's account is their first + last name; we derive a stable, deterministic
// internal auth email from it so Supabase auth (which requires an email) works.

export const AUTH_EMAIL_DOMAIN = "studybud.local";

export function loginKeyFrom(first: string, last: string): string {
  return `${first ?? ""} ${last ?? ""}`
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function authEmailFor(loginKey: string): string {
  return `${loginKey}@${AUTH_EMAIL_DOMAIN}`;
}

export function titleCase(v: string): string {
  return v
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((p) => (p ? p[0].toUpperCase() + p.slice(1).toLowerCase() : p))
    .join(" ");
}

/** Turn any legacy email-ish identifier into a friendly display name. */
export function displayNameFrom(name?: string | null, email?: string | null): string {
  const n = (name ?? "").trim();
  if (n && !n.includes("@")) return n;
  const local = (email ?? n).split("@")[0] ?? "";
  const pretty = titleCase(local.replace(/[._\-0-9]+/g, " ")).trim();
  return pretty || "Study Bud student";
}

export function validateSignup(first: string, last: string, password: string): string | null {
  if (first.trim().length < 2) return "Enter your first name.";
  if (last.trim().length < 2) return "Enter your last name.";
  if (!/^[a-zA-Z][a-zA-Z '\-]*$/.test(first.trim())) return "First name can only contain letters.";
  if (!/^[a-zA-Z][a-zA-Z '\-]*$/.test(last.trim())) return "Last name can only contain letters.";
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (!loginKeyFrom(first, last)) return "Please enter a valid name.";
  return null;
}
