import { NextResponse } from "next/server";
import { NEEDS_PROFILE, cfmsErrorResponse, fetchAdvocateList, getAdvocateProfile, requireApiUser } from "@/lib/cfms-api";

export const maxDuration = 60;

// The signed-in advocate's upcoming hearings from CFMS. The CNIC/advocate code
// come from their own profile row (RLS-scoped), never from the request, so one
// account can't pull someone else's list through this route.
export async function GET() {
  const user = await requireApiUser();
  if ("error" in user) return user.error;

  const profile = await getAdvocateProfile(user);
  if (!profile) return NextResponse.json(NEEDS_PROFILE, { status: 400 });

  try {
    const list = await fetchAdvocateList(profile);
    return NextResponse.json({ ...list, fetchedAt: new Date().toISOString() });
  } catch (err) {
    return cfmsErrorResponse(err);
  }
}
