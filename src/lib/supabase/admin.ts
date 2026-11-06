import { createClient } from "@supabase/supabase-js";

// Service-role client for server-only, cross-user work: the notifications
// cron (src/app/api/cron/notifications), which looks across every user's
// hearings/tasks/subscriptions, the nightly court update (src/lib/cfms-cron.ts),
// and the signUp action, which writes the new user's profile row before they
// have a session.
//
// This key bypasses Row Level Security entirely. Never import this file from
// client code, and never let a caller choose which user id it acts on.
export function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
