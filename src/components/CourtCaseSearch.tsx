"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, ExternalLink, Loader2, Plus, Search } from "lucide-react";
import { formatDate } from "@/lib/format";
import { DISTRICTS } from "@/lib/cfms-parse";
import { usePoliceStations } from "@/hooks/usePoliceStations";
import type { CaseSearchResult } from "@/lib/cfms";
import type { LegalCase } from "@/lib/types";

const inputClass =
  "w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-faint focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600";

// The High Court isn't on the district courts website, so it can't be searched.
const SEARCHABLE = DISTRICTS.filter((d) => d.cfms);

type Mode = "case" | "fir";
type SearchState =
  | { status: "idle" }
  | { status: "searching" }
  | { status: "error"; error: string }
  | { status: "done"; results: CaseSearchResult[] };

function Label({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted">{text}</span>
      {children}
    </label>
  );
}

/** Looks a case up on the court website's case search, by case no + year or by
 *  FIR, and lets any result be added to the app with its hearings. */
export function CourtCaseSearch({ casesByCode }: { casesByCode: Map<string, LegalCase> }) {
  const [mode, setMode] = useState<Mode>("case");
  const [district, setDistrict] = useState<string>(SEARCHABLE[0].key);
  const [caseNo, setCaseNo] = useState("");
  const [caseYear, setCaseYear] = useState("");
  const [firNo, setFirNo] = useState("");
  const [firYear, setFirYear] = useState("");
  const [policeStation, setPoliceStation] = useState({ code: "", name: "" });
  const { stations, failed: stationsFailed } = usePoliceStations(mode === "fir" ? district : "");

  const [search, setSearch] = useState<SearchState>({ status: "idle" });
  // What this search's FIR was, for the cases added from it.
  const [searchedFir, setSearchedFir] = useState("");
  const [adding, setAdding] = useState<string | null>(null);
  const [added, setAdded] = useState<Record<string, string>>({});
  const [addErrors, setAddErrors] = useState<Record<string, string>>({});

  const year = /^\d{4}$/;
  const ready =
    mode === "case"
      ? /^\d+$/.test(caseNo) && year.test(caseYear)
      : /^\d+$/.test(firNo) && year.test(firYear) && Boolean(policeStation.code);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return;
    setSearch({ status: "searching" });
    setAddErrors({});
    const query: Record<string, string> =
      mode === "case"
        ? { district, caseNo, caseYear }
        : { district, firNo, firYear, policeStation: policeStation.code };
    try {
      const res = await fetch(`/api/cfms/search?${new URLSearchParams(query)}`, { cache: "no-store" });
      const body = await res.json();
      if (!res.ok) return setSearch({ status: "error", error: body.error ?? "The search didn't work. Try again." });
      // Pending cases first: those are the ones worth adding.
      const results = [...(body.results as CaseSearchResult[])].sort(
        (a, b) => Number(a.disposed) - Number(b.disposed)
      );
      setSearchedFir(mode === "fir" ? `${firNo}/${firYear}, ${policeStation.name}` : "");
      setSearch({ status: "done", results });
    } catch {
      setSearch({ status: "error", error: "You're offline. Searching the court website needs a connection." });
    }
  }

  async function add(result: CaseSearchResult) {
    setAdding(result.caseCode);
    setAddErrors((errs) => {
      const next = { ...errs };
      delete next[result.caseCode];
      return next;
    });
    try {
      const res = await fetch("/api/cfms/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseCode: result.caseCode,
          caseType: result.caseType,
          caseNo: result.caseNo,
          caseYear: result.caseYear,
          title: result.title,
          court: result.court,
          firNo: searchedFir,
        }),
      });
      const body = await res.json();
      if (res.status === 409) return setAddErrors((errs) => ({ ...errs, [result.caseCode]: body.error }));
      if (!res.ok) throw new Error(body.error);
      setAdded((a) => ({ ...a, [result.caseCode]: body.id }));
    } catch (err) {
      const message = err instanceof Error && err.message ? err.message : "Couldn't add this case.";
      setAddErrors((errs) => ({ ...errs, [result.caseCode]: message }));
    } finally {
      setAdding(null);
    }
  }

  const tab = (value: Mode, label: string) => (
    <button
      type="button"
      onClick={() => setMode(value)}
      aria-pressed={mode === value}
      className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold ${
        mode === value ? "bg-brand-600 text-white" : "text-muted hover:text-ink"
      }`}
    >
      {label}
    </button>
  );

  return (
    <section className="card mb-5 p-5">
      <div className="section-head mb-3">
        <h2 className="text-sm font-semibold text-ink">Search a case</h2>
        <p className="text-xs text-muted">Find any case on the court website by its number or FIR.</p>
      </div>

      <form onSubmit={run} className="space-y-3">
        <div className="flex gap-1 rounded-xl border border-line bg-background p-1">
          {tab("case", "Case No")}
          {tab("fir", "FIR No")}
        </div>

        <Label text="District">
          <select className={inputClass} value={district} onChange={(e) => setDistrict(e.target.value)}>
            {SEARCHABLE.map((d) => (
              <option key={d.key} value={d.key}>
                {d.label}
              </option>
            ))}
          </select>
        </Label>

        {mode === "case" ? (
          <div className="grid grid-cols-2 gap-3">
            <Label text="Case No">
              <input
                className={inputClass}
                inputMode="numeric"
                placeholder="e.g. 100"
                value={caseNo}
                onChange={(e) => setCaseNo(e.target.value.replace(/\D/g, ""))}
              />
            </Label>
            <Label text="Case Year">
              <input
                className={inputClass}
                inputMode="numeric"
                maxLength={4}
                placeholder="e.g. 2024"
                value={caseYear}
                onChange={(e) => setCaseYear(e.target.value.replace(/\D/g, ""))}
              />
            </Label>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Label text="FIR No">
                <input
                  className={inputClass}
                  inputMode="numeric"
                  placeholder="e.g. 386"
                  value={firNo}
                  onChange={(e) => setFirNo(e.target.value.replace(/\D/g, ""))}
                />
              </Label>
              <Label text="FIR Year">
                <input
                  className={inputClass}
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="e.g. 2025"
                  value={firYear}
                  onChange={(e) => setFirYear(e.target.value.replace(/\D/g, ""))}
                />
              </Label>
            </div>
            <Label text="Police Station">
              <select
                className={inputClass}
                value={policeStation.code}
                disabled={!stations}
                onChange={(e) =>
                  setPoliceStation({ code: e.target.value, name: e.target.selectedOptions[0]?.text ?? "" })
                }
              >
                <option value="">
                  {stations ? "Choose a police station…" : stationsFailed ? "Couldn't load police stations" : "Loading…"}
                </option>
                {stations?.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Label>
          </>
        )}

        <button
          type="submit"
          disabled={!ready || search.status === "searching"}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {search.status === "searching" ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
          {search.status === "searching" ? "Searching the court website…" : "Search"}
        </button>
      </form>

      {search.status === "error" && (
        <p className="mt-3 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-600">{search.error}</p>
      )}

      {search.status === "done" && (
        <div className="mt-4">
          <p className="mb-2 text-xs text-muted">
            {search.results.length === 0
              ? "No case found. Check the district and the numbers."
              : `${search.results.length} ${search.results.length === 1 ? "case" : "cases"} found`}
          </p>
          <ul className="space-y-2">
            {search.results.map((r) => {
              const existing = casesByCode.get(r.caseCode);
              const addedId = added[r.caseCode];
              const caseId = existing?.id ?? addedId;
              return (
                <li key={r.caseCode} className="rounded-xl border border-line p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink">
                        {r.caseType} {r.caseNo}/{r.caseYear}
                      </p>
                      <p className="text-sm text-muted">{r.title}</p>
                      <p className="text-xs text-faint">{r.court}</p>
                      <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
                        <span className={r.disposed ? "text-faint" : "font-semibold text-success-700"}>{r.status}</span>
                        {r.hearingDate && <span className="text-ink">Next: {formatDate(r.hearingDate)}</span>}
                      </p>
                    </div>
                    {caseId ? (
                      <Link
                        href={`/cases/${caseId}`}
                        className="flex shrink-0 items-center gap-1 rounded-lg bg-brand-50 px-2.5 py-1.5 text-xs font-semibold text-brand-700"
                      >
                        {addedId ? <Check size={13} /> : null}
                        {addedId ? "Added" : "In your cases"} <ExternalLink size={12} />
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() => add(r)}
                        disabled={adding !== null}
                        className="flex shrink-0 items-center gap-1 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
                      >
                        {adding === r.caseCode ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                        Add to my cases
                      </button>
                    )}
                  </div>
                  {addErrors[r.caseCode] && <p className="mt-2 text-xs text-red-600">{addErrors[r.caseCode]}</p>}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
