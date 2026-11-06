"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, BookOpen, ChevronRight } from "lucide-react";
import type { LawActMeta } from "@/lib/types";
import { PageHeader } from "./PageHeader";
import { tint } from "@/lib/urgency";

export function MajorActsExplorer({ acts }: { acts: LawActMeta[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return acts;
    return acts.filter((a) => a.act.toLowerCase().includes(q));
  }, [acts, query]);

  return (
    <div>
      <PageHeader title="Major Acts" subtitle={`${acts.length} statutes • search any section by number or title`} />

      <div className="relative mb-4">
        <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search books, e.g. Penal Code, Contract Act..."
          className="w-full rounded-xl border border-line bg-surface py-2.5 pl-10 pr-3 text-sm text-ink placeholder:text-faint focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="card flex flex-col items-center justify-center gap-2 p-12 text-center">
          <p className="text-sm font-semibold text-ink">No books match &ldquo;{query}&rdquo;</p>
          <p className="text-sm text-muted">Try a different search term.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((act) => (
            <Link
              key={act.slug}
              href={`/major-acts/${act.slug}`}
              style={tint(act.slug)}
              className="card tint flex items-start gap-3 p-4 transition-colors hover:border-brand-600 hover:bg-brand-50/40"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
                <BookOpen size={19} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">{act.act}</p>
                <p className="mt-0.5 text-xs text-muted">
                  {act.hasIndex ? `${act.sectionCount} sections` : "Full text"}
                </p>
              </div>
              <ChevronRight size={18} className="mt-1 shrink-0 text-faint" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
