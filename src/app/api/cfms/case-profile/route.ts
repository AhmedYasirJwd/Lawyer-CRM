import { NextResponse, type NextRequest } from "next/server";
import { CfmsError, fetchCaseProfile } from "@/lib/cfms";

export const maxDuration = 60;

// Case profiles are public on CFMS (the site shows them to anyone with the
// cause list), so this only checks the code's shape — signed-in access is
// already enforced by the proxy.
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code")?.trim() ?? "";
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(code)) {
    return NextResponse.json({ error: "Invalid case code." }, { status: 400 });
  }

  try {
    return NextResponse.json(await fetchCaseProfile(code));
  } catch (err) {
    const message =
      err instanceof CfmsError ? err.message : "Couldn't reach the court website. Try again in a minute.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
