import { NextRequest, NextResponse } from "next/server";
import { runNightlyCourtSync } from "@/lib/cfms-cron";

export const maxDuration = 300;

// Hit every night by Vercel Cron (see vercel.json) — not by a signed-in user, so
// the auth proxy lets /api/cron through and this checks CRON_SECRET itself, same
// as the notifications job.
export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 500 });
  }
  if (req.headers.get("authorization") !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    return NextResponse.json({ ok: true, ...(await runNightlyCourtSync()) });
  } catch (err) {
    console.error("Court sync cron failed:", err);
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
