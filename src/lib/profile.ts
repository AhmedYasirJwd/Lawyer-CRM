// Lawyer identity fields used to look the advocate up on CFMS (the court
// case-flow system). Kept in public.profiles rather than auth user_metadata:
// metadata rides along inside every session JWT/cookie, which is the wrong
// place for a CNIC.

export interface LawyerProfile {
  cnic: string;
  advocateCode: string;
}

const CNIC_RE = /^(\d{5})-?(\d{7})-?(\d)$/;
// Bar enrolment / advocate codes vary by bar council (digits, letters,
// slashes) — only rule out obvious junk.
const ADVOCATE_CODE_RE = /^[A-Za-z0-9][A-Za-z0-9\-/ ]{0,29}$/;

/** "4210112345671" or "42101-1234567-1" → "42101-1234567-1"; null if invalid. */
export function normalizeCnic(raw: string): string | null {
  const m = raw.trim().match(CNIC_RE);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

export function normalizeAdvocateCode(raw: string): string | null {
  const v = raw.trim().replace(/\s+/g, " ").toUpperCase();
  return ADVOCATE_CODE_RE.test(v) ? v : null;
}

/** Validates both fields from a submitted form. */
export function parseProfileFields(
  formData: FormData
): { profile: LawyerProfile; error?: undefined } | { error: string; profile?: undefined } {
  const cnic = normalizeCnic(String(formData.get("cnic") ?? ""));
  if (!cnic) return { error: "Enter a valid CNIC (e.g. 42101-1234567-1)." };
  const advocateCode = normalizeAdvocateCode(String(formData.get("advocateCode") ?? ""));
  if (!advocateCode) return { error: "Enter your advocate code." };
  return { profile: { cnic, advocateCode } };
}
