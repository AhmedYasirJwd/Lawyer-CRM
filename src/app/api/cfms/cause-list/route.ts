import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CfmsError, fetchCauseList, type CauseList } from "@/lib/cfms";

export const maxDuration = 60;

// The signed-in advocate's daily cause list from CFMS. The CNIC/advocate code
// come from their own profile row (RLS-scoped), never from the request, so
// one account can't pull someone else's list through this route.
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("cnic, advocate_code")
    .eq("user_id", userId)
    .maybeSingle();
  if (!profile) {
    return NextResponse.json(
      { error: "Add your CNIC and advocate code in Settings first.", needsProfile: true },
      { status: 400 }
    );
  }

  try {
    // CNIC is the more reliable key; fall back to the advocate code when CFMS
    // has nothing filed under the CNIC.
    let list: CauseList = await fetchCauseList({ cnic: profile.cnic });
    let searchedBy: "cnic" | "advocateCode" = "cnic";
    if (list.rows.length === 0 && profile.advocate_code) {
      list = await fetchCauseList({ advocateCode: profile.advocate_code });
      searchedBy = "advocateCode";
    }
    return NextResponse.json({ ...list, searchedBy, fetchedAt: new Date().toISOString() });
  } catch (err) {
    const message =
      err instanceof CfmsError ? err.message : "Couldn't reach the court website. Try again in a minute.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
