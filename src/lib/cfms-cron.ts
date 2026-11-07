import "server-only";
import { createSupabaseAdminClient } from "./supabase/admin";
import { CfmsSession } from "./cfms";
import { syncCase, type SyncableCase } from "./cfms-sync";

// Vercel stops the function at 300s; leave room to finish what's in flight.
const TIME_BUDGET_MS = 270_000;
// Gentle on the court's server: a few at a time, not hundreds at once.
const CONCURRENCY = 3;
// A case updated within this long doesn't need it again. Lets the second nightly
// run (see vercel.json) pick up only what the first didn't reach.
const FRESH_MS = 12 * 60 * 60 * 1000;

/** Updates every linked case the court hasn't disposed of, across all accounts, from the court website,
 *  least recently updated first. One case failing doesn't stop the rest: it just
 *  stays the stalest, so it's first in line next time. */
export async function runNightlyCourtSync() {
  const started = Date.now();
  const db = createSupabaseAdminClient();

  const { data, error } = await db
    .from("cases")
    .select("*")
    .not("cfms_case_code", "is", null)
    // Not a plain .not(): that would also drop cases with no court status yet.
    .or("cfms_status.is.null,cfms_status.not.ilike.disposed*")
    .or(`cfms_synced_at.is.null,cfms_synced_at.lt.${new Date(started - FRESH_MS).toISOString()}`)
    .order("cfms_synced_at", { ascending: true, nullsFirst: true })
    .limit(1000);
  if (error) throw error;

  const queue = [...((data ?? []) as SyncableCase[])];
  const total = queue.length;
  const summary = { total, updated: 0, hearingsMoved: 0, hearingsAdded: 0, disposed: 0, failed: 0 };
  const session = new CfmsSession();

  async function worker() {
    while (queue.length > 0 && Date.now() - started < TIME_BUDGET_MS) {
      const row = queue.shift()!;
      try {
        const result = await syncCase(db, row, session);
        summary.updated += 1;
        if (result.movedFrom) summary.hearingsMoved += 1;
        summary.hearingsAdded += result.hearingsAdded;
        if (result.disposed) summary.disposed += 1;
      } catch (err) {
        summary.failed += 1;
        console.error(`Court sync failed for case ${row.id}:`, err);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  return { ...summary, notReached: queue.length };
}
