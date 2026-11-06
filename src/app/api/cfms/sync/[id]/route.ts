import { NextResponse, type NextRequest } from "next/server";
import { syncCase, type SyncableCase } from "@/lib/cfms-sync";
import { cfmsErrorResponse, requireApiUser } from "@/lib/cfms-api";

export const maxDuration = 60;

type Params = { params: Promise<{ id: string }> };

// Updates one linked case from its court record right now, rather than waiting
// for the nightly run. RLS limits this to the signed-in user's own cases.
export async function POST(_req: NextRequest, { params }: Params) {
  const user = await requireApiUser();
  if ("error" in user) return user.error;

  const { id } = await params;
  const { data: row } = await user.supabase.from("cases").select("*").eq("id", id).maybeSingle();
  if (!row) return NextResponse.json({ error: "Case not found." }, { status: 404 });
  if (!row.cfms_case_code) {
    return NextResponse.json({ error: "This case isn't linked to a court record." }, { status: 400 });
  }

  try {
    return NextResponse.json(await syncCase(user.supabase, row as SyncableCase));
  } catch (err) {
    return cfmsErrorResponse(err);
  }
}
