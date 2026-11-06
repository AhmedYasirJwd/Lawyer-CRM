import { NextResponse, type NextRequest } from "next/server";
import { fetchCaseProfile } from "@/lib/cfms";
import { advocateSide } from "@/lib/cfms-parse";
import { cfmsErrorResponse, getAdvocateProfile, requireApiUser } from "@/lib/cfms-api";

export const maxDuration = 60;

// A case's court record. These are public on CFMS, so this only checks the
// code's shape. `mySide` says which side the signed-in advocate is on, if listed.
export async function GET(request: NextRequest) {
  const user = await requireApiUser();
  if ("error" in user) return user.error;

  const code = request.nextUrl.searchParams.get("code")?.trim() ?? "";
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(code)) {
    return NextResponse.json({ error: "Invalid case code." }, { status: 400 });
  }

  try {
    const [record, profile] = await Promise.all([fetchCaseProfile(code), getAdvocateProfile(user)]);
    return NextResponse.json({
      record,
      mySide: advocateSide(profile?.advocate_code, record.advocate1, record.advocate2),
    });
  } catch (err) {
    return cfmsErrorResponse(err);
  }
}
