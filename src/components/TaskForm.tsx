"use client";

import { useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Trash2, WifiOff } from "lucide-react";
import type { LegalCase, Task } from "@/lib/types";
import { saveTask } from "@/lib/task-sync";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

const inputClass =
  "w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-faint focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600";

export function TaskForm({ cases, initial }: { cases: LegalCase[]; initial?: Task }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const presetCaseId = searchParams.get("caseId") ?? "";
  const isOnline = useOnlineStatus();
  const isEdit = Boolean(initial);

  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedOfflineNotice, setSavedOfflineNotice] = useState(false);

  // A create's id is decided up front so the task can be saved to the
  // device and shown immediately, online or off — same reasoning as
  // CaseForm/HearingForm.
  const idRef = useRef(initial?.id ?? crypto.randomUUID());

  const [title, setTitle] = useState(initial?.title ?? "");
  const [caseId, setCaseId] = useState(initial?.caseId ?? presetCaseId);
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? new Date().toISOString().slice(0, 10));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSavedOfflineNotice(false);

    const payload = { title, caseId: caseId || undefined, dueDate };
    const localTask: Task = {
      id: idRef.current,
      caseId: caseId || undefined,
      title,
      dueDate,
      status: initial?.status ?? "Pending",
    };

    const result = await saveTask(localTask, isEdit ? "update" : "create", payload);

    if (!result.ok) {
      setError(result.error);
      setSubmitting(false);
      return;
    }

    if (!result.synced) setSavedOfflineNotice(true);
    // Hard navigation, not router.push — see HearingForm for why: the
    // destination (a case's page, or the Tasks list) is offline-enabled
    // and only a real navigation is guaranteed to be caught by the
    // service worker when there's no network.
    window.location.href = caseId ? `/cases/${caseId}` : "/tasks";
  }

  async function handleDelete() {
    if (!initial) return;
    if (!window.confirm("Delete this task? This can't be undone.")) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/tasks/${initial.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Request failed");
      router.push(caseId ? `/cases/${caseId}` : "/tasks");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
      setDeleting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && <p className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</p>}
      {savedOfflineNotice && (
        <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-4 py-2.5 text-sm text-amber-700">
          <WifiOff size={16} className="mt-0.5 shrink-0" />
          Saved on this device. It&apos;ll sync automatically once you&apos;re back online.
        </p>
      )}
      <div className="card space-y-4 p-5">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-muted">Task</span>
          <input
            required
            className={inputClass}
            placeholder="e.g. Prepare cross-examination questions"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-xs font-medium text-muted">Linked Case (optional)</span>
            <select className={inputClass} value={caseId} onChange={(e) => setCaseId(e.target.value)}>
              <option value="">General (no case)</option>
              {cases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.caseType} #{c.caseNumber} — {c.title}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted">Due Date</span>
            <input
              type="date"
              className={inputClass}
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </label>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3">
        {isEdit && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={submitting || deleting || !isOnline}
            title={!isOnline ? "Requires an internet connection" : undefined}
            className="mr-auto flex items-center gap-1.5 rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 size={15} />
            {deleting ? "Deleting..." : "Delete"}
          </button>
        )}
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-ink hover:bg-background"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting || deleting}
          className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {submitting ? "Saving..." : isEdit ? "Save Changes" : "Add Task"}
        </button>
      </div>
    </form>
  );
}
