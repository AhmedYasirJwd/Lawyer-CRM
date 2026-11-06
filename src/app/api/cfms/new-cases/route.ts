import { NextResponse } from "next/server";
import { splitLegacyCaseNumber } from "@/lib/cfms-parse";
import type { CauseListRow } from "@/lib/cfms";
import { NEEDS_PROFILE, cfmsErrorResponse, fetchAdvocateList, getAdvocateProfile, requireApiUser } from "@/lib/cfms-api";

export const maxDuration = 60;

export interface NewCourtCase extends CauseListRow {
  caseCode: string;
  /** A case already in the app with the same number and year, not yet linked. */
  possibleMatch?: { id: string; caseNumber: string; title: string };
}

// The advocate's cases on the court website that aren't in the app yet.
export async function GET() {
  const user = await requireApiUser();
  if ("error" in user) return user.error;

  const profile = await getAdvocateProfile(user);
  if (!profile) return NextResponse.json(NEEDS_PROFILE, { status: 400 });

  try {
    const [list, casesResult] = await Promise.all([
      fetchAdvocateList(profile),
      user.supabase.from("cases").select("id, case_number, case_no, case_year, title, cfms_case_code"),
    ]);
    if (casesResult.error) throw casesResult.error;
    const cases = casesResult.data ?? [];

    const linked = new Set(cases.map((c) => c.cfms_case_code).filter(Boolean));
    const unlinkedByNumber = new Map<string, (typeof cases)[number]>();
    for (const c of cases) {
      if (c.cfms_case_code) continue;
      const legacy = splitLegacyCaseNumber(c.case_number);
      unlinkedByNumber.set(`${c.case_no ?? legacy.caseNo}/${c.case_year ?? legacy.caseYear}`, c);
    }

    // A case with several listed dates comes up more than once: keep the soonest.
    const byCode = new Map<string, NewCourtCase>();
    for (const row of list.rows) {
      if (!row.caseCode || linked.has(row.caseCode)) continue;
      const seen = byCode.get(row.caseCode);
      if (seen && (seen.hearingDate ?? "") <= (row.hearingDate ?? "")) continue;
      const match = unlinkedByNumber.get(`${row.caseNo}/${row.caseYear}`);
      byCode.set(row.caseCode, {
        ...row,
        caseCode: row.caseCode,
        possibleMatch: match && { id: match.id, caseNumber: match.case_number, title: match.title },
      });
    }

    return NextResponse.json({
      advocateName: list.advocateName,
      totalListed: list.rows.length,
      newCases: [...byCode.values()].sort((a, b) => (a.hearingDate ?? "").localeCompare(b.hearingDate ?? "")),
    });
  } catch (err) {
    return cfmsErrorResponse(err);
  }
}
