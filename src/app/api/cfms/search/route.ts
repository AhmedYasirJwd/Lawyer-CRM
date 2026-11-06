import { NextResponse, type NextRequest } from "next/server";
import { searchCases } from "@/lib/cfms";
import { cfmsDistrictValue } from "@/lib/cfms-parse";
import { cfmsErrorResponse, requireApiUser } from "@/lib/cfms-api";

export const maxDuration = 60;

const isNumber = (s: string) => /^\d{1,10}$/.test(s);

// The court website's case search, by case no + year or FIR no + year + police
// station. Many cases can share a number, so this can return several.
export async function GET(request: NextRequest) {
  const user = await requireApiUser();
  if ("error" in user) return user.error;

  const param = (name: string) => request.nextUrl.searchParams.get(name)?.trim() ?? "";
  const district = param("district");
  const caseNo = param("caseNo");
  const caseYear = param("caseYear");
  const firNo = param("firNo");
  const firYear = param("firYear");
  const policeStation = param("policeStation");

  if (!cfmsDistrictValue(district)) {
    return NextResponse.json({ error: "This district isn't on the court website." }, { status: 400 });
  }
  const byCase = isNumber(caseNo) && isNumber(caseYear);
  const byFir = isNumber(firNo) && isNumber(firYear) && isNumber(policeStation);
  if (!byCase && !byFir) {
    return NextResponse.json(
      { error: "Enter a case number and year, or an FIR number, year and police station." },
      { status: 400 }
    );
  }

  try {
    const results = await searchCases(
      byCase ? { district, caseNo, caseYear } : { district, firNo, firYear, policeStation }
    );
    return NextResponse.json({ results });
  } catch (err) {
    return cfmsErrorResponse(err);
  }
}
