"use client";

import { use } from "react";
import { ArrowLeft, FolderX } from "lucide-react";
import { HearingForm } from "@/components/HearingForm";
import { useOfflineCaseDetail } from "@/hooks/useOfflineData";

// Client component, no server data fetching — same reasoning as
// hearings/new: the case and its hearings both come from IndexedDB via
// useOfflineCaseDetail, so editing a hearing works offline too, including
// one that was itself only ever created offline.
export default function EditHearingPage({
  params,
}: {
  params: Promise<{ id: string; hearingId: string }>;
}) {
  const { id, hearingId } = use(params);
  const { legalCase: item, hearings, loading, notCached, isOffline } = useOfflineCaseDetail(id);
  const hearing = hearings.find((h) => h.id === hearingId);

  return (
    <div>
      <div className="mb-5">
        {/* Plain <a>, not next/link — this page is reachable offline. */}
        { }
        <a
          href={`/cases/${id}`}
          className="flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink"
        >
          <ArrowLeft size={17} />
          Back to Case Details
        </a>
        <h1 className="mt-2 text-xl font-bold text-ink sm:text-2xl">Edit Hearing</h1>
        {item && (
          <p className="mt-1 text-sm text-muted">
            {item.caseType} No. {item.caseNumber} · {item.title}
          </p>
        )}
      </div>

      {loading ? (
        <div className="card h-64 animate-pulse p-5" />
      ) : !item || !hearing ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-line bg-surface p-10 text-center">
          <FolderX size={28} className="mb-3 text-faint" />
          {notCached && isOffline ? (
            <>
              <p className="text-sm font-semibold text-ink">This isn&apos;t available offline yet</p>
              <p className="mt-1 max-w-sm text-sm text-muted">
                Open this case once while connected to the internet and it&apos;ll be saved for offline viewing.
              </p>
            </>
          ) : (
            <p className="text-sm font-semibold text-ink">Hearing not found</p>
          )}
        </div>
      ) : (
        <HearingForm legalCase={item} initial={hearing} />
      )}
    </div>
  );
}
