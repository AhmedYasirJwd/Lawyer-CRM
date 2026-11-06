import "server-only";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "./supabase/server";
import { CfmsError, fetchCauseList, type CauseList } from "./cfms";

/** The signed-in user's Supabase client and id, or a 401 to return. These routes
 *  reach an outside site, so they check this themselves. */
export async function requireApiUser() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return { error: NextResponse.json({ error: "Not signed in." }, { status: 401 }) } as const;
  return { supabase, userId } as const;
}

type ApiUser = Exclude<Awaited<ReturnType<typeof requireApiUser>>, { error: unknown }>;

export function cfmsErrorResponse(err: unknown) {
  if (!(err instanceof CfmsError)) console.error("CFMS request failed:", err);
  const message =
    err instanceof CfmsError ? err.message : "Couldn't reach the court website. Try again in a minute.";
  return NextResponse.json({ error: message }, { status: 502 });
}

export const NEEDS_PROFILE = {
  error: "Add your CNIC and advocate code in Settings first.",
  needsProfile: true,
};

export async function getAdvocateProfile({ supabase, userId }: ApiUser) {
  const { data } = await supabase
    .from("profiles")
    .select("cnic, advocate_code")
    .eq("user_id", userId)
    .maybeSingle();
  return data as { cnic: string; advocate_code: string } | null;
}

/** The advocate's listed hearings. The advocate code is what the court's own
 *  records print; fall back to the CNIC when nothing is listed under it. */
export async function fetchAdvocateList(profile: { cnic: string; advocate_code: string }): Promise<CauseList> {
  const list = await fetchCauseList({ advocateCode: profile.advocate_code });
  return list.rows.length > 0 ? list : fetchCauseList({ cnic: profile.cnic });
}
