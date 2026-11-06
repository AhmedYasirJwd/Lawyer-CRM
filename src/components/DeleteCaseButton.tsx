"use client";

import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import * as offlineDb from "@/lib/offline-db";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

/** Removes the case from this device's offline copy (and any queued writes
 *  for it, its hearings or its tasks) so it doesn't reappear from IndexedDB
 *  after the server has already deleted it. */
async function forgetLocally(caseId: string) {
  const [hearings, tasks] = await Promise.all([
    offlineDb.getManyByIndex<{ id: string }>("hearings", "caseId", caseId),
    offlineDb.getManyByIndex<{ id: string }>("tasks", "caseId", caseId),
  ]);
  await Promise.all([
    offlineDb.deleteOne("cases", caseId),
    offlineDb.deleteOne("outbox", `case:${caseId}`),
    ...hearings.flatMap((h) => [offlineDb.deleteOne("hearings", h.id), offlineDb.deleteOne("outbox", `hearing:${h.id}`)]),
    ...tasks.flatMap((t) => [offlineDb.deleteOne("tasks", t.id), offlineDb.deleteOne("outbox", `task:${t.id}`)]),
  ]);
  for (const store of ["cases", "hearings", "tasks"]) window.dispatchEvent(new Event(`lexcase:${store}-changed`));
}

/** "Delete" with an in-app confirmation. Deleting removes the case's
 *  hearings, tasks, parties, timeline and documents with it, so the dialog
 *  spells that out and needs a second, explicit tap. Needs a connection —
 *  deletes aren't queued offline. */
export function DeleteCaseButton({
  caseId,
  caseLabel,
  variant = "button",
}: {
  caseId: string;
  caseLabel: string;
  variant?: "button" | "link";
}) {
  const isOnline = useOnlineStatus();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/cases/${caseId}`, { method: "DELETE" });
      if (!res.ok && res.status !== 404) throw new Error(`${res.status}`);
      await forgetLocally(caseId);
      // Hard navigation — the Cases list is an offline-enabled route.
      window.location.href = "/cases";
    } catch {
      setError("Couldn't delete the case. Check your connection and try again.");
      setDeleting(false);
    }
  }

  return (
    <>
      {variant === "button" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Delete case"
          className="flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-sm font-semibold text-red-600 hover:border-red-300 hover:bg-red-50"
        >
          <Trash2 size={14} />
          <span className="hidden sm:inline">Delete</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 text-sm font-semibold text-red-600 hover:text-red-700"
        >
          <Trash2 size={14} />
          Delete this case
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <div role="alertdialog" aria-modal="true" aria-labelledby="delete-title" className="card w-full max-w-sm p-5">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-red-600">
              <Trash2 size={18} />
            </div>
            <h2 id="delete-title" className="text-base font-semibold text-ink">
              Delete {caseLabel}?
            </h2>
            <p className="mt-1 text-sm text-muted">
              This permanently removes the case with all its hearings, tasks, parties, timeline and uploaded
              documents. It can&apos;t be undone.
            </p>
            {!isOnline && (
              <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-700">
                You&apos;re offline. Connect to the internet to delete a case.
              </p>
            )}
            {error && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={deleting}
                className="flex-1 rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-ink hover:bg-background"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting || !isOnline}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {deleting && <Loader2 size={14} className="animate-spin" />}
                Delete case
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
