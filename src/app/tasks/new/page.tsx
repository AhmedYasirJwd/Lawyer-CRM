"use client";

import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import type { LegalCase } from "@/lib/types";
import { TaskForm } from "@/components/TaskForm";
import { useOfflineCollection } from "@/hooks/useOfflineData";

function NewTaskForm() {
  const { data: cases, loading } = useOfflineCollection<LegalCase>("cases", "/api/cases");
  if (loading) return <div className="card h-64 animate-pulse p-5" />;
  return <TaskForm cases={cases} />;
}

export default function NewTaskPage() {
  return (
    <div>
      <div className="mb-5">
        {/* Plain <a>, not next/link — this page is reachable offline, and
            "back to Tasks" needs to stay reachable offline too. */}
        { }
        <a href="/tasks" className="flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
          <ArrowLeft size={17} />
          Back to Tasks
        </a>
        <h1 className="mt-2 text-xl font-bold text-ink sm:text-2xl">New Task</h1>
      </div>
      <Suspense>
        <NewTaskForm />
      </Suspense>
    </div>
  );
}
