import { NextResponse, type NextRequest } from "next/server";
import { fetchPoliceStations } from "@/lib/cfms";
import { cfmsErrorResponse, requireApiUser } from "@/lib/cfms-api";

export async function GET(request: NextRequest) {
  const user = await requireApiUser();
  if ("error" in user) return user.error;

  try {
    const stations = await fetchPoliceStations(request.nextUrl.searchParams.get("district") ?? "");
    return NextResponse.json({ stations });
  } catch (err) {
    return cfmsErrorResponse(err);
  }
}
