"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { FileEdit, Search, X } from "lucide-react";
import { PageHeader } from "./PageHeader";
import type { DraftTemplate } from "@/lib/drafts";
import { tint } from "@/lib/urgency";

export function DraftsExplorer({ templates }: { templates: DraftTemplate[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter(
      (d) => d.name.toLowerCase().includes(q) || d.description.toLowerCase().includes(q)
    );
  }, [templates, query]);

  return (
    <div>
      <PageHeader title="Drafts" subtitle={`${templates.length} document templates`} />

      {/* Sticky search — stays reachable while the grid below scrolls */}
      <div className="sticky top-0 z-20 -mx-4 mb-5 bg-background/85 px-4 pb-3 pt-1 backdrop-blur-md sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="relative">
          <Search size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search drafts by name..."
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

      {filtered.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted">No drafts match &quot;{query}&quot;.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((d) => (
            <Link
              key={d.id}
              href={`/drafts/${d.id}`}
              style={tint(d.id)}
              className="card tint flex flex-col gap-3 p-5 transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
                <FileEdit size={19} />
              </div>
              <div>
                <p className="font-semibold text-ink">{d.name}</p>
                <p className="mt-0.5 text-sm text-muted">{d.description}</p>
              </div>
              <span className="mt-auto text-xs font-semibold text-brand-700">Open & edit →</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
