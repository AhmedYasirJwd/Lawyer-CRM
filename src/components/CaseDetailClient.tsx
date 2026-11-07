"use client";

import { useState } from "react";
import { ArrowLeft, Pencil, ChevronRight, FolderX } from "lucide-react";
import { formatDate, formatTime } from "@/lib/format";
import { SectionCard } from "@/components/SectionCard";
import { QuickActions } from "@/components/QuickActions";
import { CaseInfoGrid } from "@/components/CaseInfoGrid";
import { PartiesSection } from "@/components/PartiesSection";
import { Timeline } from "@/components/Timeline";
import { DocumentsSection } from "@/components/DocumentsSection";
import { CaseTasksSection } from "@/components/CaseTasksSection";
import { useOfflineCaseDetail } from "@/hooks/useOfflineData";
import type { TimelineEvent } from "@/lib/types";
import { DeleteCaseButton } from "@/components/DeleteCaseButton";
import { CourtRecordSection } from "@/components/CourtRecordSection";
import { DateBlock } from "@/components/CaseTable";
import { caseTone, tint } from "@/lib/urgency";

export function CaseDetailClient({ caseId }: { caseId: string }) {
  const { legalCase: item, hearings, tasks, documents, loading, notCached, isOffline } =
    useOfflineCaseDetail(caseId);
  // Computed once per mount (not per render) so it stays a pure value for
  // React's purity rules, and before any early return below so the hook
  // call itself is always made unconditionally.
  const [now] = useState(() => Date.now());

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-40 animate-pulse rounded-lg bg-surface" />
        <div className="card h-28 animate-pulse p-5" />
        <div className="card h-64 animate-pulse p-5" />
      </div>
    );
  }

  if (!item) {
    return (
      <div>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- intentional: forces a real navigation so the service worker can serve the offline shell */}
        <a href="/cases" className="flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
          <ArrowLeft size={17} />
          Back to Cases
        </a>
        <div className="mt-5 flex flex-col items-center rounded-2xl border border-dashed border-line bg-surface p-10 text-center">
          <FolderX size={28} className="mb-3 text-faint" />
          {notCached && isOffline ? (
            <>
              <p className="text-sm font-semibold text-ink">This case isn&apos;t available offline yet</p>
              <p className="mt-1 max-w-sm text-sm text-muted">
                Open this case once while connected to the internet and it&apos;ll be saved for offline viewing.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-ink">Case not found</p>
              <p className="mt-1 max-w-sm text-sm text-muted">
                It may have been deleted, or the link is incorrect.
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  const upcoming = [...hearings]
    .filter((h) => new Date(h.date).getTime() >= now)
    .sort((a, b) => a.date.localeCompare(b.date));
  const past = [...hearings]
    .filter((h) => new Date(h.date).getTime() < now)
    .sort((a, b) => b.date.localeCompare(a.date));
  const nextHearing = upcoming[0];
  const lastHearing = past[0];

  const hearingTimelineEvents: TimelineEvent[] = hearings.map((h) => ({
    id: h.id,
    title: new Date(h.date).getTime() >= now ? "Next Hearing" : "Hearing",
    date: h.date.slice(0, 10),
    description: h.purpose,
    type: "hearing",
  }));
  const combinedTimeline = [...item.timeline, ...hearingTimelineEvents];

  const tone = caseTone(item.id, nextHearing?.date);

  return (
    // The whole page takes this case's own color: section header bands,
    // info tiles and the header card (see .case-accent in globals.css).
    <div style={tint(item.id)} className="case-accent">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- intentional: forces a real navigation so the service worker can serve the offline shell */}
        <a href="/cases" className="flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
          <ArrowLeft size={17} />
          Back to Cases
        </a>
        <h1 className="hidden text-base font-semibold text-ink sm:block">Case Details</h1>
        <div className="flex items-center gap-2">
          <DeleteCaseButton caseId={item.id} caseLabel={`case #${item.caseNumber}`} />
          { }
          <a
            href={`/cases/${item.id}/edit`}
            className="flex items-center gap-1.5 rounded-xl bg-ink px-3.5 py-2 text-sm font-semibold text-white hover:bg-ink/90"
          >
            <Pencil size={14} />
            Edit
          </a>
        </div>
      </div>

      <div
        style={tone.vars}
        className={`card mb-4 flex flex-col gap-4 border-l-4 p-5 sm:flex-row sm:items-center sm:justify-between ${tone.card}`}
      >
        <div className="flex items-center gap-3.5">
          <DateBlock iso={nextHearing?.date} className={tone.chip} size="lg" />
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-ink">
              {item.caseType} No. {item.caseNumber}
            </h2>
            <p className="text-sm text-muted">{item.title}</p>
            <p className="text-sm text-muted">{item.court}</p>
          </div>
        </div>

        {nextHearing && (
          <a
            href="/calendar"
            className="tint flex shrink-0 items-center gap-3 rounded-xl border bg-white px-4 py-3 sm:min-w-[220px]"
          >
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted">Next Hearing</p>
              <p className="text-sm font-semibold text-ink">{formatDate(nextHearing.date)}</p>
              <p className="text-xs text-muted">{formatTime(nextHearing.date)}</p>
              <p className="mt-0.5 truncate text-xs text-faint">{item.counselFor}</p>
            </div>
            <ChevronRight size={16} className="text-faint" />
          </a>
        )}
      </div>

      <div className="mb-4">
        <QuickActions caseId={item.id} />
      </div>

      <div className="space-y-4">
        <SectionCard title="Case Information" collapsible defaultOpen>
          <CaseInfoGrid item={item} lastHearing={lastHearing} nextHearing={nextHearing} />
        </SectionCard>

        <SectionCard title="Parties" collapsible defaultOpen>
          <PartiesSection parties={item.parties} />
        </SectionCard>

        <SectionCard title="Court Record" collapsible defaultOpen>
          <CourtRecordSection item={item} />
        </SectionCard>

        <SectionCard title="Case Timeline">
          <Timeline events={combinedTimeline} />
        </SectionCard>

        <SectionCard title="Tasks">
          <CaseTasksSection caseId={item.id} initialTasks={tasks} />
        </SectionCard>

        <div id="documents">
          <SectionCard title="Documents">
            <DocumentsSection caseId={item.id} initialDocuments={documents} />
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
