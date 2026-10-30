"use client";

import { Suspense, use } from "react";
import { ArrowLeft, FolderX } from "lucide-react";
import type { LegalCase, Task } from "@/lib/types";
import { TaskForm } from "@/components/TaskForm";
import { useOfflineCollection, useOfflineRecord } from "@/hooks/useOfflineData";

// Client component, no server data fetching — the task and the case list
// both come from IndexedDB, so editing a task works offline too, including
// one that was itself only ever created offline.
export default function EditTaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: task, loading: taskLoading } = useOfflineRecord<Task>("tasks", id);
  const { data: cases, loading: casesLoading } = useOfflineCollection<LegalCase>("cases", "/api/cases");
  const loading = taskLoading || casesLoading;

  return (
    <div>
      <div className="mb-5">
        {/* Plain <a>, not next/link — this page is reachable offline. */}
        { }
        <a
          href={task?.caseId ? `/cases/${task.caseId}` : "/tasks"}
          className="flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink"
        >
          <ArrowLeft size={17} />
          Back
        </a>
        <h1 className="mt-2 text-xl font-bold text-ink sm:text-2xl">Edit Task</h1>
      </div>

      {loading ? (
        <div className="card h-64 animate-pulse p-5" />
      ) : !task ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-line bg-surface p-10 text-center">
          <FolderX size={28} className="mb-3 text-faint" />
          <p className="text-sm font-semibold text-ink">This task isn&apos;t available offline yet</p>
          <p className="mt-1 max-w-sm text-sm text-muted">
            Open the Tasks list once while connected to the internet and it&apos;ll be saved for offline editing.
          </p>
        </div>
      ) : (
        <Suspense>
          <TaskForm cases={cases} initial={task} />
        </Suspense>
      )}
    </div>
  );
}
