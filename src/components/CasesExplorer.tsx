"use client";

import { useMemo, useState } from "react";
import { Plus, Search, X } from "lucide-react";
import type { LegalCase, Hearing } from "@/lib/types";
import { CaseTable } from "./CaseTable";
import { PageHeader } from "./PageHeader";
import { useOfflineCollection } from "@/hooks/useOfflineData";
import { NewCasesButton } from "@/components/NewCasesButton";

export function CasesExplorer() {
  const { data: cases, isOffline } = useOfflineCollection<LegalCase>("cases", "/api/cases");
  const { data: hearings } = useOfflineCollection<Hearing>("hearings", "/api/hearings");

  const [query, setQuery] = useState("");

  const hearingsByCaseId = useMemo(() => {
    const map = new Map<string, Hearing[]>();
    for (const h of hearings) {
      if (!map.has(h.caseId)) map.set(h.caseId, []);
      map.get(h.caseId)!.push(h);
    }
    return map;
  }, [hearings]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return cases
      .filter((c) =>
        q
          ? c.title.toLowerCase().includes(q) ||
            c.caseNumber.toLowerCase().includes(q) ||
            c.court.toLowerCase().includes(q)
          : true
      )
      .sort((a, b) => b.lastUpdated.localeCompare(a.lastUpdated));
  }, [cases, query]);

  const neverSynced = isOffline && cases.length === 0;

  return (
    <div>
      <PageHeader
        title="Cases"
        subtitle={`${cases.length} total cases`}
        action={
          <div className="flex items-center gap-2">
            <NewCasesButton />
            {/* Plain <a>, not next/link — this route needs to work offline,
                and only a real navigation is caught by the service worker's
                fetch handler (see public/sw.js and CaseListItem.tsx). */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/cases/new"
              className="flex items-center gap-1.5 rounded-xl bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm shadow-brand-600/30 transition-all hover:-translate-y-0.5 hover:bg-brand-700 hover:shadow-md active:translate-y-0 active:scale-95"
            >
              <Plus size={16} />
              <span className="hidden sm:inline">New Case</span>
            </a>
          </div>
        }
      />

      {/* Sticky search — stays reachable while the list below scrolls */}
      <div className="sticky top-0 z-20 -mx-4 mb-4 bg-background/85 px-4 pb-3 pt-1 backdrop-blur-md sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="relative">
          <Search size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by case number, party, or court"
            className="w-full rounded-2xl border border-line bg-surface py-3 pl-11 pr-10 text-sm text-ink placeholder:text-faint shadow-sm transition-all focus:border-brand-600 focus:shadow-[0_0_0_4px_rgba(30,64,175,0.12)] focus:outline-none"
          />
          {query && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-faint hover:bg-background hover:text-ink"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {neverSynced ? (
        <div className="rounded-2xl border border-dashed border-line bg-surface p-6 text-center text-sm text-muted">
          This information isn&apos;t available offline yet. Connect to the internet once to load your cases.
        </div>
      ) : (
        <CaseTable
          cases={filtered}
          variant="full"
          emptyMessage="No cases match your search."
          hearingsByCaseId={hearingsByCaseId}
        />
      )}
    </div>
  );
}
