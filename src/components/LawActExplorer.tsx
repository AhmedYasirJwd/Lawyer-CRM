"use client";

import { useMemo, useState } from "react";
import Fuse from "fuse.js";
import { Search, FileText } from "lucide-react";
import type { LawActDetail, LawSection } from "@/lib/types";
import { PageHeader } from "./PageHeader";
import { LawPdfViewer } from "./LawPdfViewer";
import { tint } from "@/lib/urgency";

export function LawActExplorer({ act, pdfUrl }: { act: LawActDetail; pdfUrl: string }) {
  const [query, setQuery] = useState("");
  const [activeSection, setActiveSection] = useState<LawSection | null>(null);

  const fuse = useMemo(
    () =>
      new Fuse(act.sections, {
        keys: [
          { name: "number", weight: 3 },
          { name: "title", weight: 2 },
          { name: "text", weight: 1 },
        ],
        threshold: 0.35,
        ignoreLocation: true,
      }),
    [act.sections]
  );

  const results = useMemo(() => {
    const q = query.trim();
    if (!q) return act.sections;
    // exact/prefix section-number match always surfaces first
    const numberMatches = act.sections.filter((s) => s.number === q || s.number.startsWith(q));
    const fuzzy = fuse.search(q).map((r) => r.item);
    const seen = new Set<string>();
    const merged: LawSection[] = [];
    for (const s of [...numberMatches, ...fuzzy]) {
      if (!seen.has(s.number)) {
        seen.add(s.number);
        merged.push(s);
      }
    }
    return merged;
  }, [query, act.sections, fuse]);

  function openSection(section: LawSection) {
    setActiveSection(section);
  }

  return (
    <div>
      <PageHeader
        title={act.act}
        subtitle={act.hasIndex ? `${act.sections.length} sections` : "Section index not available for this book yet"}
      />

      {act.hasIndex ? (
        <>
          <div className="relative mb-4">
            <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder='Search a section number or title'
              className="w-full rounded-xl border border-line bg-surface py-2.5 pl-10 pr-3 text-sm text-ink placeholder:text-faint focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
              autoFocus
            />
          </div>

          {results.length === 0 ? (
            <div className="card flex flex-col items-center justify-center gap-2 p-10 text-center">
              <p className="text-sm font-semibold text-ink">No sections match &ldquo;{query}&rdquo;</p>
              <p className="text-sm text-muted">Try just the section number, or a keyword from the title.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {results.map((s) => (
                <button
                  key={s.number}
                  type="button"
                  onClick={() => openSection(s)}
                  style={tint(String(s.number))}
                  className="card tint flex items-start gap-3 p-3.5 text-left transition-colors hover:border-brand-600 hover:bg-brand-50/40"
                >
                  <span className="mt-0.5 flex h-8 min-w-[2.25rem] shrink-0 items-center justify-center rounded-lg bg-brand-100 px-2 text-xs font-bold text-brand-700">
                    {s.number}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink">{s.title}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted">{s.text}</p>
                  </div>
                  <FileText size={16} className="mt-1 shrink-0 text-faint" />
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <button
          type="button"
          onClick={() => setActiveSection({ number: "", title: act.act, page: 1, text: "" })}
          className="card flex w-full items-center gap-3 p-4 text-left transition-colors hover:border-brand-600 hover:bg-brand-50/40"
        >
          <FileText size={20} className="text-brand-700" />
          <span className="text-sm font-semibold text-ink">Open full PDF</span>
        </button>
      )}

      {activeSection && (
        <LawPdfViewer
          actName={act.act}
          sectionLabel={activeSection.number ? `Section ${activeSection.number} — ${activeSection.title}` : undefined}
          fileUrl={pdfUrl}
          page={activeSection.page}
          onClose={() => setActiveSection(null)}
        />
      )}
    </div>
  );
}
