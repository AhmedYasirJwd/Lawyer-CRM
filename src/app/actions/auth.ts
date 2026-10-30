"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { parseProfileFields } from "@/lib/profile";

// Only same-origin paths — "//evil.com" and "/\evil.com" start with "/" too
// but browsers treat them as another host.
function safeNext(next: string): string {
  return next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/";
}

const CNIC_TAKEN = "This CNIC is already registered to another account.";

export async function signIn(_prevState: unknown, formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/");

  if (!email || !password) return { error: "Enter your email and password." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };

  redirect(safeNext(next));
}

export async function signUp(_prevState: unknown, formData: FormData) {
  const fullName = String(formData.get("fullName") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (!fullName) return { error: "Enter your full name." };
  if (!phone) return { error: "Enter your phone number." };
  if (!email || !password) return { error: "Enter your email and password." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  if (password !== confirm) return { error: "Passwords don't match." };
  const parsed = parseProfileFields(formData);
  if (!parsed.profile) return { error: parsed.error };
  const { cnic, advocateCode } = parsed.profile;

  // Checked before creating the auth user so a duplicate CNIC doesn't leave
  // behind an account with no profile. The unique index is the real guard.
  const admin = createSupabaseAdminClient();
  const { data: existing } = await admin.from("profiles").select("user_id").eq("cnic", cnic).maybeSingle();
  if (existing) return { error: CNIC_TAKEN };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/auth/callback`,
      // Shows up on Settings, the sidebar/dashboard avatar + greeting, and
      // the /accounts phone column. Stored on the Supabase auth user itself
      // (user_metadata.full_name / user_metadata.phone) — the "phone" here
      // is distinct from Supabase's own auth "phone" field, which is for
      // SMS login and isn't in use here.
      data: { full_name: fullName, phone },
    },
  });
  if (error) return { error: error.message };

  // Written with the service-role client because, with email confirmation
  // on, there's no session yet for RLS to authorize the insert against.
  // data.user.id comes straight from signUp, never from the form.
  if (data.user) {
    const { error: profileError } = await admin
      .from("profiles")
      .upsert({ user_id: data.user.id, cnic, advocate_code: advocateCode });
    if (profileError?.code === "23505") return { error: CNIC_TAKEN };
    // Any other failure is non-fatal: the account works, and the person can
    // fill these in from Settings.
  }

  // If email confirmation is off in the Supabase project, signUp already
  // returns a live session — take the person straight in.
  if (data.session) redirect("/");

  return {
    success:
      "Account created. Check your email to confirm your address, then sign in.",
  };
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function updateProfile(_prevState: unknown, formData: FormData) {
  const parsed = parseProfileFields(formData);
  if (!parsed.profile) return { error: parsed.error };

  const supabase = await createSupabaseServerClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return { error: "You're signed out — sign in again." };

  const { error } = await supabase.from("profiles").upsert({
    user_id: userId,
    cnic: parsed.profile.cnic,
    advocate_code: parsed.profile.advocateCode,
    updated_at: new Date().toISOString(),
  });
  if (error) return { error: error.code === "23505" ? CNIC_TAKEN : error.message };

  revalidatePath("/settings");
  return { success: "Saved." };
}
