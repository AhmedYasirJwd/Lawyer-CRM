"use client";

import { useActionState } from "react";
import { updateProfile } from "@/app/actions/auth";

const inputClass =
  "w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-faint focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600";

/** CNIC + advocate code, used to look the lawyer up on CFMS. */
export function ProfileForm({ cnic, advocateCode }: { cnic: string; advocateCode: string }) {
  const [state, formAction, pending] = useActionState(updateProfile, null);

  return (
    <form action={formAction} className="card mt-4 space-y-4 p-5">
      <div>
        <h2 className="mb-1 text-sm font-semibold text-ink">Advocate details</h2>
        <p className="text-sm text-muted">Used to fetch your cases from the court system.</p>
      </div>
      {state?.error && <p className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-600">{state.error}</p>}
      {state?.success && (
        <p className="rounded-xl bg-brand-50 px-4 py-2.5 text-sm text-brand-700">{state.success}</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-muted">CNIC</span>
          <input
            required
            type="text"
            name="cnic"
            inputMode="numeric"
            defaultValue={cnic}
            placeholder="42101-1234567-1"
            pattern="\d{5}-?\d{7}-?\d"
            title="13 digits, e.g. 42101-1234567-1"
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-muted">Advocate code</span>
          <input
            required
            type="text"
            name="advocateCode"
            defaultValue={advocateCode}
            autoCapitalize="characters"
            className={inputClass}
          />
        </label>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {pending ? "Saving..." : "Save"}
      </button>
    </form>
  );
}
