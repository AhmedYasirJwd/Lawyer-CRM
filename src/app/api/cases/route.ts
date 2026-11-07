import { NextRequest, NextResponse } from "next/server";
import { getCases, getCaseById, createCase } from "@/lib/db";

export async function GET() {
  const cases = await getCases();
  return NextResponse.json(cases);
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  if (!body.caseNumber || !body.title || !body.court || !body.filingDate) {
    return NextResponse.json(
      { error: "caseNumber, title, court, and filingDate are required" },
      { status: 400 }
    );
  }

  // A retried outbox entry (e.g. the first attempt's response never made it
  // back to the device even though the insert succeeded) would otherwise
  // create a duplicate case — if this id already exists, treat it as
  // already-synced and hand that case back instead of erroring or doubling it up.
  if (body.id) {
    const existing = await getCaseById(body.id);
    if (existing) return NextResponse.json(existing, { status: 200 });
  }

  const created = await createCase({
    id: body.id,
    caseNumber: body.caseNumber,
    title: body.title,
    court: body.court,
    filingDate: body.filingDate,
    caseType: body.caseType ?? "Civil Suit",
    counselFor: body.counselFor ?? "",
    stage: body.stage ?? "Filed",
    parties: body.parties ?? [],
    district: body.district,
    caseNo: body.caseNo,
    caseYear: body.caseYear,
    firNo: body.firNo,
    firYear: body.firYear,
    policeStation: body.policeStation,
    policeStationName: body.policeStationName,
    cfmsCaseCode: body.cfmsCaseCode,
    cfmsStatus: body.cfmsStatus,
  });

  return NextResponse.json(created, { status: 201 });
}
