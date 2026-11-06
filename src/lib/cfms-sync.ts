import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CfmsSession, fetchCaseProfile, searchCases } from "./cfms";
import { pktDate, pktDateTime } from "./cfms-parse";
import { formatDate } from "./format";
import type { CourtRecord } from "./types";

/** Purpose on a hearing the court has listed but not recorded anything for yet.
 *  Replaced by the diary entry once there is one. */
const AWAITING_DIARY = "Hearing (from court record)";

/** The columns of a `cases` row this module reads. */
export interface SyncableCase {
  id: string;
  user_id: string;
  court: string;
  counsel_for: string | null;
  status: string;
  district: string | null;
  case_no: string | null;
  case_year: string | null;
  fir_no: string | null;
  fir_year: string | null;
  police_station: string | null;
  cfms_case_code: string;
  cfms_status: string | null;
}

export interface SyncResult {
  /** ISO date of the next hearing per the court, if it has listed one. */
  nextHearing?: string;
  /** The date the next hearing was moved from, when it changed. */
  movedFrom?: string;
  hearingsAdded: number;
  disposed: boolean;
}

/** The hearing time from a diary entry like "put off to 21-11-2026 at 9:30 a.m",
 *  or 9:00, when courts sit, if the entry doesn't say. */
function hearingTime(date: string, diary: CourtRecord["diary"]): { hour: number; minute: number } {
  const [y, m, d] = date.split("-").map(Number);
  const pattern = new RegExp(`0?${d}-0?${m}-${y}\\s*at\\s*(\\d{1,2})[:.](\\d{2})\\s*([ap])?`, "i");
  for (const entry of diary) {
    const match = entry.text.match(pattern);
    if (!match) continue;
    let hour = Number(match[1]);
    if (match[3]?.toLowerCase() === "p" && hour < 12) hour += 12;
    if (hour < 24 && Number(match[2]) < 60) return { hour, minute: Number(match[2]) };
  }
  return { hour: 9, minute: 0 };
}

/** Whether the court now lists the case as disposed. The profile page doesn't
 *  say, only the search does, so this is only worth asking when the diary has
 *  no upcoming date. Never fails the sync: the answer is a bonus. */
async function lookUpStatus(row: SyncableCase, session: CfmsSession) {
  if (!row.district) return undefined;
  try {
    const results = await searchCases(
      row.case_no && row.case_year
        ? { district: row.district, caseNo: row.case_no, caseYear: row.case_year }
        : {
            district: row.district,
            firNo: row.fir_no ?? "",
            firYear: row.fir_year ?? "",
            policeStation: row.police_station ?? "",
          },
      session
    );
    return results.find((r) => r.caseCode === row.cfms_case_code);
  } catch {
    return undefined;
  }
}

/** Brings one linked case in line with its court record: the next hearing, any
 *  diary entries not yet saved as hearings, the court, and the status.
 *
 *  Throws if the court site can't be read, before anything is written, so a bad
 *  night never removes or changes data. */
export async function syncCase(
  db: SupabaseClient,
  row: SyncableCase,
  session = new CfmsSession(),
  /** Pass it if already fetched, to save a request. */
  fetched?: CourtRecord
): Promise<SyncResult> {
  const record = fetched ?? (await fetchCaseProfile(row.cfms_case_code, session));
  const court = record.court || row.court;
  const today = pktDate(Date.now());

  const { data: hearingRows, error } = await db.from("hearings").select("id, date, purpose").eq("case_id", row.id);
  if (error) throw error;
  const hearings = (hearingRows ?? []) as { id: string; date: string; purpose: string }[];
  const hearingOn = new Map(hearings.map((h) => [pktDate(h.date), h]));
  const diaryDates = new Set(record.diary.map((e) => e.date));

  const next = record.diary.filter((e) => e.date >= today).sort((a, b) => b.date.localeCompare(a.date))[0];
  const newRows = (entry: { date: string; text: string }, time = { hour: 9, minute: 0 }) => ({
    user_id: row.user_id,
    case_id: row.id,
    date: pktDateTime(entry.date, time.hour, time.minute),
    purpose: entry.text || AWAITING_DIARY,
    court,
    counsel_for: row.counsel_for,
  });

  const result: SyncResult = { nextHearing: next?.date, hearingsAdded: 0, disposed: false };
  const inserts: ReturnType<typeof newRows>[] = [];

  if (next && !hearingOn.has(next.date)) {
    const time = hearingTime(next.date, record.diary);
    // The court's date wins: the next hearing on file moves to it. A date that's
    // in the diary is a hearing that really happened (or is today), so it stays.
    const upcoming = hearings
      .filter((h) => pktDate(h.date) >= today && !diaryDates.has(pktDate(h.date)))
      .sort((a, b) => a.date.localeCompare(b.date))[0];

    if (upcoming) {
      const { error: moveError } = await db
        .from("hearings")
        .update({
          date: pktDateTime(next.date, time.hour, time.minute),
          court,
          // Reminders were for the old date; the new one needs its own.
          reminder_24h_sent_at: null,
          reminder_1h_sent_at: null,
        })
        .eq("id", upcoming.id);
      if (moveError) throw moveError;
      result.movedFrom = pktDate(upcoming.date);
    } else {
      inserts.push(newRows(next, time));
    }
  }

  for (const entry of record.diary) {
    if (entry.date === next?.date) continue;
    const existing = hearingOn.get(entry.date);
    if (!existing) {
      inserts.push(newRows(entry));
    } else if (existing.purpose === AWAITING_DIARY && entry.text) {
      const { error: purposeError } = await db.from("hearings").update({ purpose: entry.text }).eq("id", existing.id);
      if (purposeError) throw purposeError;
    }
  }

  if (inserts.length > 0) {
    const { error: insertError } = await db.from("hearings").insert(inserts);
    if (insertError) throw insertError;
    result.hearingsAdded = inserts.length;
  }

  const patch: Record<string, unknown> = {
    court,
    cfms_record: record,
    cfms_synced_at: new Date().toISOString(),
  };

  if (!next) {
    const found = await lookUpStatus(row, session);
    if (found) {
      patch.cfms_status = found.status;
      // Only on the change to disposed, so a lawyer who reopens the case by hand
      // isn't overridden every night afterwards.
      const newlyDisposed = found.disposed && !/^disposed/i.test(row.cfms_status ?? "");
      if (newlyDisposed && row.status !== "Closed" && row.status !== "Disposed") {
        patch.status = "Disposed";
        result.disposed = true;
      }
    }
  }

  const events = [
    result.movedFrom && next
      ? {
          title: "Next hearing changed",
          description: `The court moved the next hearing from ${formatDate(result.movedFrom)} to ${formatDate(next.date)}.`,
          type: "hearing",
        }
      : null,
    result.disposed
      ? { title: "Case disposed", description: `Court record: ${String(patch.cfms_status)}.`, type: "other" }
      : null,
  ].filter((e) => e !== null);

  if (events.length > 0) {
    const { error: timelineError } = await db
      .from("timeline_events")
      .insert(events.map((e) => ({ ...e, user_id: row.user_id, case_id: row.id, date: today })));
    if (timelineError) throw timelineError;
  }

  // "Last updated" means something changed, not that the nightly job ran.
  if (result.movedFrom || result.hearingsAdded > 0 || result.disposed || court !== row.court) {
    patch.last_updated = new Date().toISOString();
  }

  const { error: updateError } = await db.from("cases").update(patch).eq("id", row.id);
  if (updateError) throw updateError;

  return result;
}
