"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { CourtCaseSearch } from "@/components/CourtCaseSearch";
import { useOfflineCollection } from "@/hooks/useOfflineData";
import { formatDate } from "@/lib/format";
import { tint } from "@/lib/urgency";
import type { CourtRecord, LegalCase } from "@/lib/types";
import type { CauseList, CauseListRow } from "@/lib/cfms";

type CauseListResponse = CauseList & { fetchedAt: string };
type LoadState =
  | { status: "loading" }
  | { status: "error"; error: string; needsProfile?: boolean }
  | { status: "ready"; data: CauseListResponse };

export function CauseListExplorer() {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const { data: cases } = useOfflineCollection<LegalCase>("cases", "/api/cases");

  const load = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const res = await fetch("/api/cfms/cause-list", { cache: "no-store" });
      const body = await res.json();
      setState(res.ok ? { status: "ready", data: body } : { status: "error", ...body });
    } catch {
      setState({ status: "error", error: "You're offline. The cause list needs a connection." });
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetches from CFMS on mount
    load();
  }, [load]);

  const casesByCode = useMemo(
    () => new Map(cases.filter((c) => c.cfmsCaseCode).map((c) => [c.cfmsCaseCode!, c])),
    [cases]
  );

  return (
    <div>
      <PageHeader
        title="Cause List"
        subtitle="Your upcoming hearings from the District Courts of Sindh"
        action={
          <button
            type="button"
            onClick={load}
            disabled={state.status === "loading"}
            className="flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-2 text-sm font-semibold text-ink hover:bg-background disabled:opacity-60"
          >
            <RefreshCw size={14} className={state.status === "loading" ? "animate-spin" : ""} />
            Refresh
          </button>
        }
      />

      <CourtCaseSearch casesByCode={casesByCode} />

      <h2 className="mb-2 text-sm font-semibold text-ink">Your upcoming hearings</h2>

      {state.status === "loading" && (
        <div className="card flex items-center gap-2 p-5 text-sm text-muted">
          <Loader2 size={16} className="animate-spin" /> Fetching from the court website…
        </div>
      )}

      {state.status === "error" && (
        <div className="card p-5 text-sm">
          <p className="text-red-600">{state.error}</p>
          {state.needsProfile && (
            <Link href="/settings" className="mt-2 inline-block font-semibold text-brand-600 hover:text-brand-700">
              Go to Settings
            </Link>
          )}
        </div>
      )}

      {state.status === "ready" && (
        <>
          <p className="mb-3 text-xs text-muted">
            {state.data.advocateName ? `${state.data.advocateName} · ` : ""}
            {state.data.rows.length} listed · fetched {new Date(state.data.fetchedAt).toLocaleTimeString()}
          </p>
          {state.data.rows.length === 0 ? (
            <div className="card p-5 text-sm text-muted">No upcoming hearings listed for you.</div>
          ) : (
            <div className="space-y-3">
              {state.data.rows.map((row, i) => (
                <CauseListItem
                  key={`${row.caseCode ?? i}-${row.hearingDate}`}
                  row={row}
                  match={row.caseCode ? casesByCode.get(row.caseCode) : undefined}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function CauseListItem({ row, match }: { row: CauseListRow; match?: LegalCase }) {
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState<{ record: CourtRecord } | { error: string } | null>(null);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (!next || profile || !row.caseCode) return;
    try {
      const res = await fetch(`/api/cfms/case-profile?code=${encodeURIComponent(row.caseCode)}`);
      setProfile(await res.json());
    } catch {
      setProfile({ error: "Couldn't load the case profile." });
    }
  }

  return (
    <div style={tint(row.caseCode ?? row.caseNo)} className="card tint p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-ink">
            {row.caseType} {row.caseNo}/{row.caseYear}
          </p>
          <p className="text-sm text-muted">{row.title}</p>
          <p className="text-xs text-faint">{row.court}</p>
          {row.hearingDate && <p className="mt-1 text-sm font-semibold text-ink">{formatDate(row.hearingDate)}</p>}
        </div>
        {match ? (
          <Link
            href={`/cases/${match.id}`}
            className="flex items-center gap-1 rounded-lg bg-brand-50 px-2 py-1 text-xs font-semibold text-brand-700"
          >
            In your cases <ExternalLink size={12} />
          </Link>
        ) : (
          <span className="rounded-lg bg-background px-2 py-1 text-xs text-muted">Not in your cases</span>
        )}
      </div>

      <dl className="mt-3 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
        {[
          ["Sections", row.sections],
          ["FIR No", row.firNo],
          ["Advocate side 1", row.advocateSide1],
          ["Advocate side 2", row.advocateSide2],
        ]
          .filter(([, v]) => v)
          .map(([label, value]) => (
            <div key={label} className="flex gap-2">
              <dt className="shrink-0 text-muted">{label}:</dt>
              <dd className="min-w-0 text-ink">{value}</dd>
            </div>
          ))}
      </dl>

      {row.caseCode && (
        <button
          type="button"
          onClick={toggle}
          className="mt-3 flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700"
        >
          <ChevronDown size={14} className={open ? "rotate-180" : ""} />
          Court diary
        </button>
      )}

      {open && (
        <div className="mt-2 rounded-xl bg-white p-3 text-sm">
          {!profile ? (
            <span className="flex items-center gap-2 text-muted">
              <Loader2 size={14} className="animate-spin" /> Loading…
            </span>
          ) : "error" in profile ? (
            <span className="text-red-600">{profile.error}</span>
          ) : profile.record.diary.length > 0 ? (
            <ol className="space-y-2">
              {profile.record.diary.map((entry) => (
                <li key={entry.date}>
                  <p className="font-semibold text-ink">{formatDate(entry.date)}</p>
                  <p className="text-muted">{entry.text || "Next hearing"}</p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-muted">No diary entries yet.</p>
          )}
        </div>
      )}
    </div>
  );
}
