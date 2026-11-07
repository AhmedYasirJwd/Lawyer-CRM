"use client";

import { useMemo, useState } from "react";
import { Search as SearchIcon, ChevronRight } from "lucide-react";
import type { LegalCase, Task } from "@/lib/types";
import { PageHeader } from "./PageHeader";
import { caseCode, formatDate } from "@/lib/format";
import { tint } from "@/lib/urgency";

export function SearchExplorer({ cases, tasks }: { cases: LegalCase[]; tasks: Task[] }) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const matchedCases = useMemo(() => {
    if (!q) return [];
    return cases.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.caseNumber.toLowerCase().includes(q) ||
        c.court.toLowerCase().includes(q) ||
        c.counselFor.toLowerCase().includes(q) ||
        c.parties.some((p) => p.name.toLowerCase().includes(q))
    );
  }, [cases, q]);

  const matchedTasks = useMemo(() => {
    if (!q) return [];
    return tasks.filter((t) => t.title.toLowerCase().includes(q));
  }, [tasks, q]);

  return (
    <div>
      <PageHeader title="Search" subtitle="Find cases and tasks across your workspace" />

      <div className="relative mb-5">
        <SearchIcon size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search cases, parties, courts, tasks..."
          className="w-full rounded-xl border border-line bg-surface py-3 pl-10 pr-3 text-sm text-ink placeholder:text-faint focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
        />
      </div>

      {!q ? (
        <p className="text-sm text-muted">Start typing to search across cases and tasks.</p>
      ) : (
        <div className="space-y-4">
          {matchedCases.length > 0 && (
            <div className="card p-5">
              <h2 className="mb-3 text-sm font-semibold text-ink">Cases ({matchedCases.length})</h2>
              {matchedCases.map((c) => (
                <a
                  key={c.id}
                  href={`/cases/${c.id}`}
                  style={tint(c.id)}
                  className="flex items-center gap-3 tint mb-2 rounded-xl border px-3 py-2.5 last:mb-0"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                    {caseCode(c.caseType)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">
                      #{c.caseNumber}
                    </p>
                    <p className="truncate text-xs text-muted">{c.title}</p>
                  </div>
                  <ChevronRight size={16} className="shrink-0 text-faint" />
                </a>
              ))}
            </div>
          )}

          {matchedTasks.length > 0 && (
            <div className="card p-5">
              <h2 className="mb-3 text-sm font-semibold text-ink">Tasks ({matchedTasks.length})</h2>
              {matchedTasks.map((t) => (
                <div
                  key={t.id}
                  style={tint(t.caseId ?? t.id)}
                  className="flex items-center justify-between gap-3 tint mb-2 rounded-xl border px-3 py-2.5 last:mb-0"
                >
                  <p className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{t.title}</p>
                  {t.dueDate && <span className="shrink-0 text-xs text-muted">Due {formatDate(t.dueDate)}</span>}
                </div>
              ))}
            </div>
          )}

          {matchedCases.length === 0 && matchedTasks.length === 0 && (
            <p className="py-8 text-center text-sm text-muted">No results for &quot;{query}&quot;.</p>
          )}
        </div>
      )}
    </div>
  );
}
