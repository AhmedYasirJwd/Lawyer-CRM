import type { LegalCase, PartySide, RelationType } from "./types";

// Client-safe helpers for CFMS data — no network or cheerio here, so the case
// form can use these too. The scraping itself is in src/lib/cfms.ts.

// The app's district choices. `cfms` is the site's own <select name="district">
// value. The High Court isn't on the district courts site, so its cases can't
// be searched or auto-updated.
export const DISTRICTS = [
  { key: "karachi-east", label: "Karachi (East)", cfms: "4" },
  { key: "karachi-south", label: "Karachi (South)", cfms: "2" },
  { key: "karachi-west", label: "Karachi (West)", cfms: "3" },
  { key: "karachi-central", label: "Karachi (Central)", cfms: "5" },
  { key: "high-court", label: "High Court", cfms: null },
] as const;

export type DistrictKey = (typeof DISTRICTS)[number]["key"];

export function cfmsDistrictValue(key?: string | null): string | null {
  return DISTRICTS.find((d) => d.key === key)?.cfms ?? null;
}

export function districtLabel(key?: string | null): string | undefined {
  return DISTRICTS.find((d) => d.key === key)?.label;
}

/** "…, Karachi(West)" / "…, Karachi (South)" → "karachi-west". The site writes
 *  the district at the end of every court name. */
export function districtFromCourt(court: string): DistrictKey | undefined {
  const m = court.match(/Karachi\s*\(\s*(East|South|West|Central)\s*\)/i);
  return m ? (`karachi-${m[1].toLowerCase()}` as DistrictKey) : undefined;
}

export interface CaseReference {
  caseNo?: string;
  caseYear?: string;
  firNo?: string;
  firYear?: string;
}

/** What the rest of the app displays as the case number. */
export function caseNumberLabel({ caseNo, caseYear, firNo, firYear }: CaseReference): string {
  if (caseNo && caseYear) return `${caseNo}/${caseYear}`;
  if (firNo && firYear) return `FIR ${firNo}/${firYear}`;
  return "";
}

/** A case needs a case no + year or an FIR no + year; either pair alone is
 *  enough, but a half-filled pair is a mistake. */
export function validateCaseReference({ caseNo, caseYear, firNo, firYear }: CaseReference): {
  reference?: string;
  caseYear?: string;
  firYear?: string;
} {
  const errors: { reference?: string; caseYear?: string; firYear?: string } = {};
  const maxYear = new Date().getFullYear() + 1;
  const badYear = (y?: string) => Boolean(y) && !(/^\d{4}$/.test(y!) && Number(y) >= 1947 && Number(y) <= maxYear);

  if (badYear(caseYear)) errors.caseYear = "Enter a 4-digit year.";
  if (badYear(firYear)) errors.firYear = "Enter a 4-digit year.";

  if (Boolean(caseNo) !== Boolean(caseYear)) errors.reference = "Enter both the case number and its year.";
  else if (Boolean(firNo) !== Boolean(firYear)) errors.reference = "Enter both the FIR number and its year.";
  else if (!caseNo && !firNo) errors.reference = "Enter a case number and year, or an FIR number and year.";
  return errors;
}

/** Old cases stored a single free-text number — pull "123/2025" apart so the
 *  edit form can prefill the separate fields. */
export function splitLegacyCaseNumber(caseNumber?: string): { caseNo: string; caseYear: string } {
  const m = caseNumber?.match(/^\D*(\d+)\s*\/\s*(\d{4})\s*$/);
  return m ? { caseNo: m[1], caseYear: m[2] } : { caseNo: "", caseYear: "" };
}

/** The reference an existing case is known by, including the legacy format. */
export function referenceOf(c: LegalCase): Required<CaseReference> {
  const legacy = c.firNo ? { caseNo: "", caseYear: "" } : splitLegacyCaseNumber(c.caseNumber);
  return {
    caseNo: c.caseNo ?? legacy.caseNo,
    caseYear: c.caseYear ?? legacy.caseYear,
    firNo: c.firNo ?? "",
    firYear: c.firYear ?? "",
  };
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** The site's dates — "21/Nov/2026", "06-Nov-2026", "21-NOV-2026" → "2026-11-21". */
export function parseCfmsDate(text: string): string | undefined {
  const m = text.match(/(\d{1,2})[/-]([A-Za-z]{3})[A-Za-z]*[/-](\d{4})/);
  if (!m) return undefined;
  const month = MONTHS.indexOf(m[2].toLowerCase());
  if (month < 0) return undefined;
  return `${m[3]}-${String(month + 1).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

// Pakistan has one UTC offset all year and no daylight saving.
const PKT_OFFSET_MS = 5 * 60 * 60 * 1000;

export function pktDate(iso: string | number | Date): string {
  return new Date(new Date(iso).getTime() + PKT_OFFSET_MS).toISOString().slice(0, 10);
}

/** "2026-11-21" + 9:30 in Pakistan → a UTC ISO timestamp, so hearings land on
 *  the right day and time whatever timezone the server runs in. */
export function pktDateTime(date: string, hour = 9, minute = 0): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, hour, minute) - PKT_OFFSET_MS).toISOString();
}

export interface CaseHeading {
  caseType: string;
  caseNo: string;
  caseYear: string;
  title: string;
}

/** "Rent Cases 100/2024, Masood Ahmed V/S Wali Muhammad" → its parts. */
export function parseCaseHeading(text: string): CaseHeading {
  const m = text.match(/^(.*?)\s*(\d+)\s*\/\s*(\d{4})\s*,?\s*([\s\S]*)$/);
  if (!m) return { caseType: "", caseNo: "", caseYear: "", title: text.trim() };
  return { caseType: m[1].trim(), caseNo: m[2], caseYear: m[3], title: m[4].trim() };
}

export interface ParsedParty {
  side: PartySide;
  name: string;
  role: string;
  relationType?: RelationType;
  relationName?: string;
}

const RELATIONS: Record<string, RelationType> = {
  "s/o": "Son of",
  "son of": "Son of",
  "d/o": "Daughter of",
  "daughter of": "Daughter of",
  "w/o": "Wife of",
  "wife of": "Wife of",
};

function parsePerson(raw: string): Pick<ParsedParty, "name" | "relationType" | "relationName"> {
  const m = raw.match(/^(.*?)\s+(s\/o|d\/o|w\/o|son of|daughter of|wife of)\.?\s+(.*)$/i);
  if (!m) return { name: raw };
  return {
    name: m[1].trim(),
    relationType: RELATIONS[m[2].toLowerCase()],
    relationName: m[3].split(/,\s/)[0].trim(),
  };
}

function peopleOnSide(text: string): string[] {
  const cleaned = text.replace(/\s*(&|and)\s*(others?|ors?)\.?\s*$/i, "").trim();
  // Only numbered lists are split ("1) A , 2) B") — a bare "&" is just as
  // often part of one name, as in "Ahmed & Co".
  const numbered = cleaned
    .split(/\s*,?\s*\d+\)\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
  return numbered.length > 0 ? numbered : cleaned ? [cleaned] : [];
}

/** "Masood Ahmed S/o S. Aziz Ahmed V/S Wali Muhammad & Others" → party records. */
export function parseParties(title: string): ParsedParty[] {
  const [first = "", second = ""] = title.split(/\s+v\/?s\.?\s+/i);
  const isState = (s: string) => /^the state$/i.test(s.trim());
  const roles: [string, string] = isState(first)
    ? ["State", "Accused"]
    : isState(second)
      ? ["Applicant", "State"]
      : ["Plaintiff", "Defendant"];

  return ([[1, first], [2, second]] as const).flatMap(([side, text]) =>
    peopleOnSide(text).map((person) => ({ side, role: roles[side - 1], ...parsePerson(person) }))
  );
}

/** Which side an advocate appears on in a case profile, by advocate code. */
export function advocateSide(
  advocateCode: string | null | undefined,
  advocate1: string,
  advocate2: string
): PartySide | null {
  if (!advocateCode) return null;
  const code = advocateCode.toUpperCase();
  if (advocate1.toUpperCase().includes(code)) return 1;
  if (advocate2.toUpperCase().includes(code)) return 2;
  return null;
}
