"use client";

import { ArrowLeft, FolderX } from "lucide-react";
import { CaseForm } from "@/components/CaseForm";
import { useOfflineCaseDetail } from "@/hooks/useOfflineData";
import { DeleteCaseButton } from "@/components/DeleteCaseButton";

export function EditCaseClient({ caseId }: { caseId: string }) {
  const { legalCase: item, loading, notCached, isOffline } = useOfflineCaseDetail(caseId);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-40 animate-pulse rounded-lg bg-surface" />
        <div className="card h-64 animate-pulse p-5" />
      </div>
    );
  }

  if (!item) {
    return (
      <div>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- forces a real navigation so the service worker can serve the offline shell */}
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
                Open this case once while connected to the internet and it&apos;ll be saved for offline editing.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-ink">Case not found</p>
              <p className="mt-1 max-w-sm text-sm text-muted">It may have been deleted, or the link is incorrect.</p>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-5">
        { }
        <a
          href={`/cases/${item.id}`}
          className="flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink"
        >
          <ArrowLeft size={17} />
          Back to Case Details
        </a>
        <h1 className="mt-2 text-xl font-bold text-ink sm:text-2xl">Edit Case</h1>
      </div>
      <CaseForm initial={item} />
      <div className="mt-8 flex justify-center border-t border-line pt-5">
        <DeleteCaseButton caseId={item.id} caseLabel={`case #${item.caseNumber}`} variant="link" />
      </div>
    </div>
  );
}
