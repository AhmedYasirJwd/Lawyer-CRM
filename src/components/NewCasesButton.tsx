"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Link2, Loader2, Plus, ScanSearch, X } from "lucide-react";
import { formatDate } from "@/lib/format";
import type { NewCourtCase } from "@/app/api/cfms/new-cases/route";

type State =
  | { status: "loading" }
  | { status: "error"; error: string; needsProfile?: boolean }
  | { status: "ready"; advocateName: string; cases: NewCourtCase[] };

/** "Check for new cases": looks the advocate up on the court website and lists
 *  cases that aren't in the app yet, each with a button to add it. */
export function NewCasesButton() {
  const [state, setState] = useState<State | null>(null);
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [failed, setFailed] = useState<Record<string, string>>({});
  const [addingAll, setAddingAll] = useState(false);

  async function check() {
    setState({ status: "loading" });
    setAdded(new Set());
    setFailed({});
    try {
      const res = await fetch("/api/cfms/new-cases", { cache: "no-store" });
      const body = await res.json();
      if (!res.ok) return setState({ status: "error", ...body });
      setState({ status: "ready", advocateName: body.advocateName, cases: body.newCases });
    } catch {
      setState({ status: "error", error: "You're offline. Checking for new cases needs a connection." });
    }
  }

  async function add(row: NewCourtCase, caseId?: string) {
    setSaving((s) => new Set(s).add(row.caseCode));
    setFailed((f) => {
      const next = { ...f };
      delete next[row.caseCode];
      return next;
    });
    try {
      const res = await fetch("/api/cfms/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...row, caseId }),
      });
      const body = await res.json();
      // 409: it's in the list already, which is what was wanted.
      if (!res.ok && res.status !== 409) throw new Error(body.error);
      setAdded((s) => new Set(s).add(row.caseCode));
    } catch (err) {
      const message = err instanceof Error && err.message ? err.message : "Couldn't add this case.";
      setFailed((f) => ({ ...f, [row.caseCode]: message }));
    } finally {
      setSaving((s) => {
        const next = new Set(s);
        next.delete(row.caseCode);
        return next;
      });
    }
  }

  // One at a time: each add looks the case up on the court's server.
  async function addAll(rows: NewCourtCase[]) {
    setAddingAll(true);
    for (const row of rows) await add(row);
    setAddingAll(false);
  }

  function close() {
    if (addingAll) return;
    setState(null);
    // The list behind this needs the new cases.
    if (added.size > 0) window.location.reload();
  }

  const remaining =
    state?.status === "ready" ? state.cases.filter((c) => !added.has(c.caseCode) && !c.possibleMatch) : [];

  return (
    <>
      <button
        type="button"
        onClick={check}
        aria-label="Check for new cases"
        className="flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3.5 py-2 text-sm font-semibold text-ink hover:bg-background"
      >
        <ScanSearch size={16} />
        <span className="hidden sm:inline">Check for new cases</span>
      </button>

      {state && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-cases-title"
            className="card flex max-h-[85vh] w-full max-w-lg flex-col p-5"
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h2 id="new-cases-title" className="text-base font-semibold text-ink">
                  New cases from court
                </h2>
                {state.status === "ready" && (
                  <p className="text-sm text-muted">
                    {state.cases.length === 0
                      ? "You're up to date."
                      : `${state.cases.length} ${state.cases.length === 1 ? "case isn't" : "cases aren't"} in your list yet.`}
                  </p>
                )}
              </div>
              <button type="button" onClick={close} aria-label="Close" className="text-faint hover:text-ink">
                <X size={18} />
              </button>
            </div>

            {state.status === "loading" && (
              <p className="flex items-center gap-2 py-6 text-sm text-muted">
                <Loader2 size={16} className="animate-spin" /> Searching the court website…
              </p>
            )}

            {state.status === "error" && (
              <div className="text-sm">
                <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-red-600">{state.error}</p>
                {state.needsProfile && (
                  <Link
                    href="/settings"
                    className="mt-3 inline-block font-semibold text-brand-600 hover:text-brand-700"
                  >
                    Go to Settings
                  </Link>
                )}
              </div>
            )}

            {state.status === "ready" && state.cases.length === 0 && (
              <p className="py-6 text-center text-sm text-muted">
                Every case listed for {state.advocateName || "you"} is already in your list.
              </p>
            )}

            {state.status === "ready" && state.cases.length > 0 && (
              <>
                <ul className="-mx-1 flex-1 space-y-2 overflow-y-auto px-1">
                  {state.cases.map((row) => {
                    const isAdded = added.has(row.caseCode);
                    const isSaving = saving.has(row.caseCode);
                    return (
                      <li key={row.caseCode} className="rounded-xl border border-line p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-ink">
                              {row.caseType} {row.caseNo}/{row.caseYear}
                            </p>
                            <p className="text-sm text-muted">{row.title}</p>
                            <p className="text-xs text-faint">{row.court}</p>
                            {row.hearingDate && (
                              <p className="mt-1 text-xs font-medium text-ink">Next: {formatDate(row.hearingDate)}</p>
                            )}
                          </div>
                          {isAdded ? (
                            <span className="flex shrink-0 items-center gap-1 text-sm font-semibold text-success-700">
                              <Check size={15} /> Added
                            </span>
                          ) : (
                            !row.possibleMatch && (
                              <button
                                type="button"
                                onClick={() => add(row)}
                                disabled={isSaving || addingAll}
                                className="flex shrink-0 items-center gap-1 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
                              >
                                {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                                Add
                              </button>
                            )
                          )}
                        </div>

                        {/* Already in the app under the same number: link rather than duplicate. */}
                        {row.possibleMatch && !isAdded && (
                          <div className="mt-2 flex flex-wrap gap-2 border-t border-line pt-2">
                            <button
                              type="button"
                              onClick={() => add(row, row.possibleMatch!.id)}
                              disabled={isSaving || addingAll}
                              className="flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
                            >
                              {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Link2 size={13} />}
                              Link to #{row.possibleMatch.caseNumber}, {row.possibleMatch.title}
                            </button>
                            <button
                              type="button"
                              onClick={() => add(row)}
                              disabled={isSaving || addingAll}
                              className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink hover:bg-background disabled:opacity-60"
                            >
                              Add as a new case
                            </button>
                          </div>
                        )}

                        {failed[row.caseCode] && <p className="mt-2 text-xs text-red-600">{failed[row.caseCode]}</p>}
                      </li>
                    );
                  })}
                </ul>

                {remaining.length > 1 && (
                  <button
                    type="button"
                    onClick={() => addAll(remaining)}
                    disabled={addingAll}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
                  >
                    {addingAll ? (
                      <>
                        <Loader2 size={15} className="animate-spin" /> Adding… {remaining.length} left
                      </>
                    ) : (
                      `Add all ${remaining.length}`
                    )}
                  </button>
                )}
              </>
            )}

            {state.status === "ready" && (
              <p className="mt-3 text-xs text-faint">
                The court website only lists cases that have an upcoming hearing, so a case with no date yet won&apos;t
                show here. Add it with New Case.
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
