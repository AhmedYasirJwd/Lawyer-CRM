"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Scale } from "lucide-react";
import { signUp } from "@/app/actions/auth";

const inputClass =
  "w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-faint focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600";

export default function SignupPage() {
  const [state, formAction, pending] = useActionState(signUp, null);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-100 text-brand-700">
            <Scale size={20} />
          </div>
          <h1 className="text-xl font-bold text-ink">Create your LexCase account</h1>
          <p className="text-sm text-muted">Case, hearing, and task management</p>
        </div>

        <form action={formAction} className="card space-y-4 p-5">
          {state?.error && <p className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-600">{state.error}</p>}
          {state?.success && (
            <p className="rounded-xl bg-brand-50 px-4 py-2.5 text-sm text-brand-700">{state.success}</p>
          )}

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted">Full name</span>
            <input required type="text" name="fullName" autoComplete="name" className={inputClass} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted">Phone number</span>
            <input required type="tel" name="phone" autoComplete="tel" className={inputClass} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted">CNIC</span>
            <input
              required
              type="text"
              name="cnic"
              inputMode="numeric"
              placeholder="42101-1234567-1"
              pattern="\d{5}-?\d{7}-?\d"
              title="13 digits, e.g. 42101-1234567-1"
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted">Advocate code</span>
            <input required type="text" name="advocateCode" autoCapitalize="characters" className={inputClass} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted">Email</span>
            <input required type="email" name="email" autoComplete="email" className={inputClass} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted">Password</span>
            <input
              required
              type="password"
              name="password"
              autoComplete="new-password"
              minLength={8}
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted">Confirm password</span>
            <input
              required
              type="password"
              name="confirm"
              autoComplete="new-password"
              minLength={8}
              className={inputClass}
            />
          </label>

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {pending ? "Creating account..." : "Create Account"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-muted">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-brand-600 hover:text-brand-700">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
