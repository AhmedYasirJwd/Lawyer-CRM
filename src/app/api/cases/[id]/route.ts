import { NextRequest, NextResponse } from "next/server";
import { getCaseById, updateCase, deleteCase } from "@/lib/db";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DOCUMENTS_BUCKET } from "@/lib/storage";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const found = await getCaseById(id);
  if (!found) return NextResponse.json({ error: "Case not found" }, { status: 404 });
  return NextResponse.json(found);
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const patch = await req.json();
  const updated = await updateCase(id, patch);
  if (!updated) return NextResponse.json({ error: "Case not found" }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  // Deleting the case cascades its document rows in Postgres, but not the
  // files in Storage — collect their paths first so they can be removed too.
  const supabase = await createSupabaseServerClient();
  const { data: docs } = await supabase.from("documents").select("storage_path").eq("case_id", id);

  const ok = await deleteCase(id);
  if (!ok) return NextResponse.json({ error: "Case not found" }, { status: 404 });

  const paths = (docs ?? []).map((d) => d.storage_path as string).filter(Boolean);
  if (paths.length > 0) {
    await supabase.storage.from(DOCUMENTS_BUCKET).remove(paths);
    // If this fails the rows are already gone — the files are just orphaned.
  }
  return NextResponse.json({ success: true });
}
