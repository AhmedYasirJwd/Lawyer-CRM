"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Check, Loader2, X } from "lucide-react";
import { formatDate } from "@/lib/format";
import type { CaseSearchResult } from "@/lib/cfms";
import type { CaseHeading } from "@/lib/cfms-parse";
import type { PartySide } from "@/lib/types";

/** The court case the person picked, with what's needed to fill in the form. */
export interface LinkedCourtCase {
  caseCode: string;
  status: string;
  heading?: CaseHeading;
  court?: string;
  institutedOn?: string;
  disposed?: boolean;
  /** Which side the advocate is on, when the court record lists them. */
  counselSide?: PartySide | null;
}

type State =
  | { status: "searching" }
  | { status: "error"; error: string }
  | { status: "results"; results: CaseSearchResult[] };

/** Searches the court website and asks which result is the case. Several cases
 *  often share a number, so the person chooses. Opened by Save (`whileSaving`),
 *  it stays out of the way when there's nothing to choose from, so a court site
 *  that's down or has no match never stops a case from being saved. */
export function CourtSearchPicker({
  query,
  whileSaving,
  onPick,
  onClose,
  onSaveWithoutLink,
}: {
  query: Record<string, string>;
  whileSaving: boolean;
  onPick: (picked: LinkedCourtCase) => void;
  onClose: () => void;
  onSaveWithoutLink: () => void;
}) {
  const [state, setState] = useState<State>({ status: "searching" });
  const [picking, setPicking] = useState<string | null>(null);

  async function pick(result: CaseSearchResult) {
    setPicking(result.caseCode);
    // The profile only adds which side the advocate is on: not worth failing over.
    let counselSide: PartySide | null = null;
    try {
      const res = await fetch(`/api/cfms/case-profile?code=${encodeURIComponent(result.caseCode)}`);
      if (res.ok) counselSide = (await res.json()).mySide;
    } catch {
      // Keep going without it.
    }
    onPick({
      caseCode: result.caseCode,
      status: result.status,
      heading: { caseType: result.caseType, caseNo: result.caseNo, caseYear: result.caseYear, title: result.title },
      court: result.court,
      institutedOn: result.institutedOn,
      disposed: result.disposed,
      counselSide,
    });
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const params = new URLSearchParams(Object.entries(query).filter(([, v]) => v));
        const res = await fetch(`/api/cfms/search?${params}`);
        const body = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(body.error);

        const results = [...(body.results as CaseSearchResult[])].sort(
          (a, b) => Number(a.disposed) - Number(b.disposed)
        );
        if (results.length === 0 && whileSaving) return onSaveWithoutLink();
        // One match from the Search button: nothing to choose. Save still asks,
        // since it's about to commit the form.
        if (results.length === 1 && !whileSaving) return void pick(results[0]);
        setState({ status: "results", results });
      } catch (err) {
        if (cancelled) return;
        if (whileSaving) return onSaveWithoutLink();
        setState({
          status: "error",
          error: err instanceof Error && err.message ? err.message : "Couldn't reach the court website.",
        });
      }
    })();
    return () => {
      cancelled = true;
    };
    // Runs once per opening: the picker is mounted fresh each time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="court-search-title"
        className="card flex max-h-[85vh] w-full max-w-lg flex-col p-5"
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 id="court-search-title" className="text-base font-semibold text-ink">
              {state.status === "results" ? "Which one is your case?" : "Court records"}
            </h2>
            {state.status === "results" && state.results.length > 0 && (
              <p className="text-sm text-muted">
                {state.results.length === 1
                  ? "1 case found on the court website."
                  : `${state.results.length} cases share this number on the court website.`}
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-faint hover:text-ink">
            <X size={18} />
          </button>
        </div>

        {state.status === "searching" && (
          <p className="flex items-center gap-2 py-6 text-sm text-muted">
            <Loader2 size={16} className="animate-spin" /> Searching the court website…
          </p>
        )}

        {state.status === "error" && (
          <p className="flex items-start gap-2 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-600">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            {state.error}
          </p>
        )}

        {state.status === "results" && state.results.length === 0 && (
          <p className="py-6 text-center text-sm text-muted">
            No case found. Check the district and the numbers, or fill in the details by hand.
          </p>
        )}

        {state.status === "results" && state.results.length > 0 && (
          <ul className="-mx-1 flex-1 space-y-2 overflow-y-auto px-1">
            {state.results.map((r) => (
              <li key={r.caseCode}>
                <button
                  type="button"
                  disabled={picking !== null}
                  onClick={() => pick(r)}
                  className="w-full rounded-xl border border-line p-3 text-left hover:border-brand-600 hover:bg-brand-50 disabled:opacity-60"
                >
                  <span className="flex items-start justify-between gap-2">
                    <span className="text-sm font-semibold text-ink">
                      {r.caseType} {r.caseNo}/{r.caseYear}
                    </span>
                    {picking === r.caseCode ? (
                      <Loader2 size={15} className="mt-0.5 shrink-0 animate-spin text-brand-600" />
                    ) : (
                      <Check size={15} className="mt-0.5 shrink-0 text-faint" />
                    )}
                  </span>
                  <span className="mt-0.5 block text-sm text-muted">{r.title}</span>
                  <span className="mt-0.5 block text-xs text-faint">{r.court}</span>
                  <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
                    <span className={r.disposed ? "text-faint" : "font-semibold text-success-700"}>{r.status}</span>
                    {r.hearingDate && <span className="text-ink">Next: {formatDate(r.hearingDate)}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {whileSaving && state.status === "results" && (
          <button
            type="button"
            onClick={onSaveWithoutLink}
            className="mt-3 w-full rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-ink hover:bg-background"
          >
            None of these: save without linking
          </button>
        )}
      </div>
    </div>
  );
}
