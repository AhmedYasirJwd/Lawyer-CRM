import { createSupabaseServerClient, requireUserId } from "./supabase/server";
import type { LegalCase, Hearing, Task, DashboardStats, CaseDocument, Party, TimelineEvent } from "./types";

// ---------------------------------------------------------- row <-> app shape --
// Postgres columns are snake_case; the rest of the app already speaks the
// camelCase shapes in ./types.ts (unchanged from before this migration), so
// every read maps rows back into those shapes and every write maps the other
// way. This is the only file that knows about the database schema.

/* eslint-disable @typescript-eslint/no-explicit-any */

function mapParty(row: any): Party {
  return {
    id: row.id,
    side: (row.side ?? 1) as Party["side"],
    name: row.name,
    role: row.role,
    phone: row.phone ?? undefined,
    cnic: row.cnic ?? undefined,
    address: row.address ?? undefined,
    relationType: row.relation_type ?? undefined,
    relationName: row.relation_name ?? undefined,
  };
}

function mapTimelineEvent(row: any): TimelineEvent {
  return {
    id: row.id,
    title: row.title,
    date: row.date,
    description: row.description ?? "",
    type: row.type ?? "other",
  };
}

function mapCase(row: any): LegalCase {
  const parties = (row.parties ?? [])
    .slice()
    .sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0))
    .map(mapParty);
  const timeline = (row.timeline_events ?? []).map(mapTimelineEvent);

  return {
    id: row.id,
    caseNumber: row.case_number,
    title: row.title,
    court: row.court,
    filingDate: row.filing_date,
    caseType: row.case_type,
    counselFor: row.counsel_for ?? "",
    stage: row.stage,
    lastUpdated: row.last_updated,
    parties,
    timeline,
    notes: row.notes ?? undefined,
    district: row.district ?? undefined,
    caseNo: row.case_no ?? undefined,
    caseYear: row.case_year ?? undefined,
    firNo: row.fir_no ?? undefined,
    firYear: row.fir_year ?? undefined,
    policeStation: row.police_station ?? undefined,
    policeStationName: row.police_station_name ?? undefined,
    cfmsCaseCode: row.cfms_case_code ?? undefined,
    cfmsStatus: row.cfms_status ?? undefined,
    cfmsSyncedAt: row.cfms_synced_at ?? undefined,
    cfmsRecord: row.cfms_record ?? undefined,
  };
}

function mapHearing(row: any): Hearing {
  return {
    id: row.id,
    caseId: row.case_id,
    date: row.date,
    purpose: row.purpose,
    court: row.court,
    counselFor: row.counsel_for ?? undefined,
  };
}

function mapTask(row: any): Task {
  return {
    id: row.id,
    caseId: row.case_id ?? undefined,
    title: row.title,
    dueDate: row.due_date ?? undefined,
    status: row.status,
  };
}

function mapDocument(row: any): CaseDocument {
  return {
    id: row.id,
    caseId: row.case_id,
    name: row.name,
    size: row.size,
    mimeType: row.mime_type,
    uploadedAt: row.uploaded_at,
    storedPath: row.storage_path,
  };
}

const CASE_SELECT = "*, parties(*), timeline_events(*)";

function orderCaseEmbeds<T extends { order: (...args: any[]) => any }>(query: T) {
  return query
    .order("position", { referencedTable: "parties", ascending: true })
    .order("date", { referencedTable: "timeline_events", ascending: true });
}

export const newId = () => crypto.randomUUID();

// ---------------------------------------------------------------- Cases --
export async function getCases(): Promise<LegalCase[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await orderCaseEmbeds(
    supabase.from("cases").select(CASE_SELECT).order("last_updated", { ascending: false })
  );
  if (error) throw error;
  return (data ?? []).map(mapCase);
}

export async function getCaseById(id: string): Promise<LegalCase | undefined> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await orderCaseEmbeds(
    supabase.from("cases").select(CASE_SELECT).eq("id", id)
  ).maybeSingle();
  if (error) throw error;
  return data ? mapCase(data) : undefined;
}

export async function createCase(
  data: Omit<LegalCase, "id" | "lastUpdated" | "timeline" | "parties"> &
    Partial<Pick<LegalCase, "id" | "timeline" | "parties">>
): Promise<LegalCase> {
  const supabase = await createSupabaseServerClient();
  const userId = await requireUserId();

  const { data: inserted, error } = await supabase
    .from("cases")
    .insert({
      // Lets an offline-created case keep the id it was given on the
      // device (see saveCase in src/lib/case-sync.ts) instead of getting a
      // second, different id once it reaches the server — otherwise the
      // locally-cached copy and the synced copy would end up as two
      // separate cases.
      ...(data.id ? { id: data.id } : {}),
      user_id: userId,
      case_number: data.caseNumber,
      title: data.title,
      court: data.court,
      filing_date: data.filingDate,
      case_type: data.caseType,
      counsel_for: data.counselFor,
      stage: data.stage,
      notes: data.notes ?? null,
      district: data.district ?? null,
      case_no: data.caseNo || null,
      case_year: data.caseYear || null,
      fir_no: data.firNo || null,
      fir_year: data.firYear || null,
      police_station: data.policeStation || null,
      police_station_name: data.policeStationName || null,
      cfms_case_code: data.cfmsCaseCode || null,
      cfms_status: data.cfmsStatus || null,
    })
    .select()
    .single();
  if (error) throw error;

  const caseId = inserted.id as string;

  const parties = data.parties ?? [];
  if (parties.length > 0) {
    const { error: partyErr } = await supabase.from("parties").insert(
      parties.map((p, i) => ({
        user_id: userId,
        case_id: caseId,
        position: i,
        side: p.side ?? 1,
        name: p.name,
        role: p.role,
        phone: p.phone || null,
        cnic: p.cnic || null,
        address: p.address || null,
        relation_type: p.relationType || null,
        relation_name: p.relationName || null,
      }))
    );
    if (partyErr) throw partyErr;
  }

  const timeline = data.timeline ?? [
    {
      title: "Case Filed",
      date: data.filingDate,
      description: `Case has been filed in ${data.court}.`,
      type: "filed" as const,
    },
  ];
  const { error: timelineErr } = await supabase.from("timeline_events").insert(
    timeline.map((t) => ({
      user_id: userId,
      case_id: caseId,
      title: t.title,
      date: t.date,
      description: t.description,
      type: t.type,
    }))
  );
  if (timelineErr) throw timelineErr;

  const created = await getCaseById(caseId);
  return created!;
}

export async function updateCase(id: string, patch: Partial<LegalCase>): Promise<LegalCase | undefined> {
  const supabase = await createSupabaseServerClient();
  const userId = await requireUserId();

  const columnPatch: Record<string, unknown> = { last_updated: new Date().toISOString() };
  if (patch.caseNumber !== undefined) columnPatch.case_number = patch.caseNumber;
  if (patch.title !== undefined) columnPatch.title = patch.title;
  if (patch.court !== undefined) columnPatch.court = patch.court;
  if (patch.filingDate !== undefined) columnPatch.filing_date = patch.filingDate;
  if (patch.caseType !== undefined) columnPatch.case_type = patch.caseType;
  if (patch.counselFor !== undefined) columnPatch.counsel_for = patch.counselFor;
  if (patch.stage !== undefined) columnPatch.stage = patch.stage;
  if (patch.notes !== undefined) columnPatch.notes = patch.notes;
  if (patch.district !== undefined) columnPatch.district = patch.district || null;
  if (patch.caseNo !== undefined) columnPatch.case_no = patch.caseNo || null;
  if (patch.caseYear !== undefined) columnPatch.case_year = patch.caseYear || null;
  if (patch.firNo !== undefined) columnPatch.fir_no = patch.firNo || null;
  if (patch.firYear !== undefined) columnPatch.fir_year = patch.firYear || null;
  if (patch.policeStation !== undefined) columnPatch.police_station = patch.policeStation || null;
  if (patch.policeStationName !== undefined) columnPatch.police_station_name = patch.policeStationName || null;
  if (patch.cfmsCaseCode !== undefined) columnPatch.cfms_case_code = patch.cfmsCaseCode || null;
  if (patch.cfmsStatus !== undefined) columnPatch.cfms_status = patch.cfmsStatus || null;

  const { error } = await supabase.from("cases").update(columnPatch).eq("id", id);
  if (error) throw error;

  if (patch.parties) {
    const { error: delErr } = await supabase.from("parties").delete().eq("case_id", id);
    if (delErr) throw delErr;
    if (patch.parties.length > 0) {
      const { error: insErr } = await supabase.from("parties").insert(
        patch.parties.map((p, i) => ({
          user_id: userId,
          case_id: id,
          position: i,
          side: p.side ?? 1,
          name: p.name,
          role: p.role,
          phone: p.phone || null,
          cnic: p.cnic || null,
          address: p.address || null,
          relation_type: p.relationType || null,
          relation_name: p.relationName || null,
        }))
      );
      if (insErr) throw insErr;
    }
  }

  return getCaseById(id);
}

export async function deleteCase(id: string): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const { error, count } = await supabase.from("cases").delete({ count: "exact" }).eq("id", id);
  if (error) throw error;
  return (count ?? 0) > 0;
}

export async function addTimelineEvent(
  caseId: string,
  event: Omit<LegalCase["timeline"][number], "id">
): Promise<LegalCase | undefined> {
  const supabase = await createSupabaseServerClient();
  const userId = await requireUserId();

  const { error } = await supabase.from("timeline_events").insert({
    user_id: userId,
    case_id: caseId,
    title: event.title,
    date: event.date,
    description: event.description,
    type: event.type,
  });
  if (error) throw error;

  await supabase.from("cases").update({ last_updated: new Date().toISOString() }).eq("id", caseId);
  return getCaseById(caseId);
}

// -------------------------------------------------------------- Hearings --
export async function getHearings(): Promise<Hearing[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("hearings").select("*").order("date", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapHearing);
}

export async function getHearingsForCase(caseId: string): Promise<Hearing[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("hearings")
    .select("*")
    .eq("case_id", caseId)
    .order("date", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapHearing);
}

export async function createHearing(data: Omit<Hearing, "id">): Promise<Hearing> {
  const supabase = await createSupabaseServerClient();
  const userId = await requireUserId();

  const { data: inserted, error } = await supabase
    .from("hearings")
    .insert({
      user_id: userId,
      case_id: data.caseId,
      date: data.date,
      purpose: data.purpose,
      court: data.court,
      counsel_for: data.counselFor ?? null,
    })
    .select()
    .single();
  if (error) throw error;

  await supabase.from("timeline_events").insert({
    user_id: userId,
    case_id: data.caseId,
    title: "Hearing Scheduled",
    date: data.date.slice(0, 10),
    description: data.purpose,
    type: "hearing",
  });
  await supabase.from("cases").update({ last_updated: new Date().toISOString() }).eq("id", data.caseId);

  return mapHearing(inserted);
}

export async function updateHearing(id: string, patch: Partial<Hearing>): Promise<Hearing | undefined> {
  const supabase = await createSupabaseServerClient();

  const columnPatch: Record<string, unknown> = {};
  if (patch.date !== undefined) columnPatch.date = patch.date;
  if (patch.purpose !== undefined) columnPatch.purpose = patch.purpose;
  if (patch.court !== undefined) columnPatch.court = patch.court;
  if (patch.counselFor !== undefined) columnPatch.counsel_for = patch.counselFor;

  const { data, error } = await supabase.from("hearings").update(columnPatch).eq("id", id).select().maybeSingle();
  if (error) throw error;
  if (!data) return undefined;

  const updated = mapHearing(data);
  // Keep the case's "last updated" stamp honest — same as createHearing
  // does on insert.
  await supabase.from("cases").update({ last_updated: new Date().toISOString() }).eq("id", updated.caseId);
  return updated;
}

export async function deleteHearing(id: string): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const { error, count } = await supabase.from("hearings").delete({ count: "exact" }).eq("id", id);
  if (error) throw error;
  return (count ?? 0) > 0;
}

// ----------------------------------------------------------------- Tasks --
export async function getTasks(): Promise<Task[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("tasks").select("*").order("due_date", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapTask);
}

export async function getTasksForCase(caseId: string): Promise<Task[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("case_id", caseId)
    .order("due_date", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapTask);
}

export async function createTask(data: Omit<Task, "id" | "status"> & { status?: Task["status"] }): Promise<Task> {
  const supabase = await createSupabaseServerClient();
  const userId = await requireUserId();

  const { data: inserted, error } = await supabase
    .from("tasks")
    .insert({
      user_id: userId,
      case_id: data.caseId ?? null,
      title: data.title,
      due_date: data.dueDate ?? null,
      status: data.status ?? "Pending",
    })
    .select()
    .single();
  if (error) throw error;
  return mapTask(inserted);
}

export async function updateTask(id: string, patch: Partial<Task>): Promise<Task | undefined> {
  const supabase = await createSupabaseServerClient();

  const columnPatch: Record<string, unknown> = {};
  if (patch.title !== undefined) columnPatch.title = patch.title;
  if (patch.caseId !== undefined) columnPatch.case_id = patch.caseId;
  if (patch.dueDate !== undefined) columnPatch.due_date = patch.dueDate;
  if (patch.status !== undefined) columnPatch.status = patch.status;

  const { data, error } = await supabase.from("tasks").update(columnPatch).eq("id", id).select().maybeSingle();
  if (error) throw error;
  return data ? mapTask(data) : undefined;
}

export async function deleteTask(id: string): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const { error, count } = await supabase.from("tasks").delete({ count: "exact" }).eq("id", id);
  if (error) throw error;
  return (count ?? 0) > 0;
}

// ------------------------------------------------------------- Documents --
export async function getDocumentsForCase(caseId: string): Promise<CaseDocument[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("case_id", caseId)
    .order("uploaded_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapDocument);
}

export async function getDocumentById(id: string): Promise<CaseDocument | undefined> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("documents").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? mapDocument(data) : undefined;
}

export async function addDocument(data: Omit<CaseDocument, "id" | "uploadedAt">): Promise<CaseDocument> {
  const supabase = await createSupabaseServerClient();
  const userId = await requireUserId();

  const { data: inserted, error } = await supabase
    .from("documents")
    .insert({
      user_id: userId,
      case_id: data.caseId,
      name: data.name,
      size: data.size,
      mime_type: data.mimeType,
      storage_path: data.storedPath,
    })
    .select()
    .single();
  if (error) throw error;
  return mapDocument(inserted);
}

export async function deleteDocument(id: string): Promise<CaseDocument | undefined> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("documents").delete().eq("id", id).select().maybeSingle();
  if (error) throw error;
  return data ? mapDocument(data) : undefined;
}

// -------------------------------------------------------------- Dashboard --
export async function getDashboardStats(): Promise<DashboardStats> {
  const supabase = await createSupabaseServerClient();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

  const [
    { count: totalCases },
    { count: hearingsThisMonth },
    { count: pendingTasks },
    { count: overdueTasks },
  ] = await Promise.all([
    supabase.from("cases").select("*", { count: "exact", head: true }),
    supabase
      .from("hearings")
      .select("*", { count: "exact", head: true })
      .gte("date", monthStart)
      .lt("date", monthEnd),
    supabase.from("tasks").select("*", { count: "exact", head: true }).eq("status", "Pending"),
    supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .eq("status", "Pending")
      .lt("due_date", todayStart),
  ]);

  return {
    totalCases: totalCases ?? 0,
    hearingsThisMonth: hearingsThisMonth ?? 0,
    pendingTasks: pendingTasks ?? 0,
    overdueTasks: overdueTasks ?? 0,
  };
}
