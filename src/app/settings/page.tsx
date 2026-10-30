import { Avatar } from "@/components/Avatar";
import { PageHeader } from "@/components/PageHeader";
import { NotificationSettings } from "@/components/NotificationSettings";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ProfileForm } from "@/components/ProfileForm";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { signOut } from "@/app/actions/auth";

export default async function SettingsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user?.email ?? "";
  const fullName = (user?.user_metadata?.full_name as string | undefined)?.trim();
  const displayName = fullName || email || "?";
  const { data: profile } = user
    ? await supabase.from("profiles").select("cnic, advocate_code").eq("user_id", user.id).maybeSingle()
    : { data: null };

  return (
    <div>
      <PageHeader title="Settings" subtitle="Your profile and workspace preferences" />

      <div className="card flex items-center justify-between gap-4 p-5">
        <div className="flex items-center gap-4">
          <Avatar name={displayName} size="lg" />
          <div>
            <p className="text-base font-semibold text-ink">{fullName || email}</p>
            <p className="text-sm text-muted">{fullName ? email : "Signed in"}</p>
          </div>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            className="rounded-xl border border-line px-4 py-2 text-sm font-semibold text-ink hover:bg-background"
          >
            Sign Out
          </button>
        </form>
      </div>

      <ProfileForm cnic={profile?.cnic ?? ""} advocateCode={profile?.advocate_code ?? ""} />

      <ThemeToggle />

      <NotificationSettings />

      <div className="card mt-4 p-5">
        <h2 className="mb-1 text-sm font-semibold text-ink">About the data in this app</h2>
        <p className="text-sm text-muted">
          Case, hearing, and task records are stored in Supabase — your data is private to your account and
          isolated from every other user via Postgres row-level security.
        </p>
      </div>
    </div>
  );
}
