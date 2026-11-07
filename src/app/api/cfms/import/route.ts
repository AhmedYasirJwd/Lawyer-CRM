import { NextResponse, type NextRequest } from "next/server";
import { createCase, updateCase } from "@/lib/db";
import { CfmsSession, fetchCaseProfile } from "@/lib/cfms";
import { syncCase, type SyncableCase } from "@/lib/cfms-sync";
import {
  advocateSide,
  caseNumberLabel,
  districtFromCourt,
  parseParties,
  pktDate,
} from "@/lib/cfms-parse";
import { cfmsErrorResponse, getAdvocateProfile, requireApiUser } from "@/lib/cfms-api";

export const maxDuration = 60;

const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");

// Adds a case found on the advocate's list, or links it to the existing case
// named by `caseId`. Either way its hearings come in straight away.
export async function POST(req: NextRequest) {
  const user = await requireApiUser();
  if ("error" in user) return user.error;

  const body = await req.json();
  const caseCode = text(body.caseCode);
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(caseCode)) {
    return NextResponse.json({ error: "Invalid case code." }, { status: 400 });
  }

  const caseNo = text(body.caseNo);
  const caseYear = text(body.caseYear);
  // "386/2025, Kharadar"
  const fir = text(body.firNo).match(/^(\d+)\s*\/\s*(\d{4})\s*,?\s*(.*)$/);
  const reference = {
    caseNo,
    caseYear,
    firNo: fir?.[1] ?? "",
    firYear: fir?.[2] ?? "",
    policeStationName: fir?.[3] ?? "",
    district: districtFromCourt(text(body.court)) ?? "",
    cfmsCaseCode: caseCode,
  };

  try {
    const session = new CfmsSession();
    const record = await fetchCaseProfile(caseCode, session);
    const profile = await getAdvocateProfile(user);
    const parties = parseParties(text(body.title));
    const side = advocateSide(profile?.advocate_code, record.advocate1, record.advocate2);
    const court = record.court || text(body.court);

    let id = text(body.caseId);
    if (id) {
      const updated = await updateCase(id, { ...reference, court });
      if (!updated) return NextResponse.json({ error: "Case not found." }, { status: 404 });
    } else {
      // The site doesn't give a filing date here; the oldest diary entry is the
      // closest thing it has, and it can be corrected on the case.
      const oldest = record.diary.map((e) => e.date).sort()[0];
      const created = await createCase({
        ...reference,
        caseNumber: caseNumberLabel(reference),
        title: text(body.title) || caseNumberLabel(reference),
        court,
        filingDate: oldest ?? pktDate(Date.now()),
        caseType: text(body.caseType) || "Civil Suit",
        counselFor: parties.find((p) => p.side === side)?.role ?? "",
        stage: "Filed / Institution",
        parties: parties.map((p) => ({ ...p, id: crypto.randomUUID() })),
      });
      id = created.id;
    }

    const { data: row, error } = await user.supabase.from("cases").select("*").eq("id", id).single();
    if (error) throw error;
    await syncCase(user.supabase, row as SyncableCase, session, record);

    return NextResponse.json({ id });
  } catch (err) {
    if ((err as { code?: string }).code === "23505") {
      return NextResponse.json({ error: "This case is already in your list." }, { status: 409 });
    }
    return cfmsErrorResponse(err);
  }
}
