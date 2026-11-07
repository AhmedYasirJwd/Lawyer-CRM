"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2, WifiOff } from "lucide-react";
import type { Task } from "@/lib/types";
import { formatDate, relativeDayLabel } from "@/lib/format";
import { saveTask } from "@/lib/task-sync";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { tint } from "@/lib/urgency";

export function CaseTasksSection({ caseId, initialTasks }: { caseId: string; initialTasks: Task[] }) {
  const router = useRouter();
  const isOnline = useOnlineStatus();
  const [tasks, setTasks] = useState(initialTasks);
  const [, startTransition] = useTransition();

  // Toggling completion is itself just an "edit" — it goes through the
  // same offline-aware save path as the task form, so checking a task off
  // works with no connection too.
  async function toggleTask(task: Task) {
    const nextStatus = task.status === "Completed" ? "Pending" : "Completed";
    const updated: Task = { ...task, status: nextStatus };
    setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
    await saveTask(updated, "update", { status: nextStatus });
    startTransition(() => router.refresh());
  }

  async function removeTask(task: Task) {
    setTasks((prev) => prev.filter((t) => t.id !== task.id));
    await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
    startTransition(() => router.refresh());
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-end">
        {/* Plain <a>, not next/link — /tasks/new is offline-enabled and
            needs a real navigation for the service worker to serve it
            with no network. */}
        { }
        <a
          href={`/tasks/new?caseId=${caseId}`}
          className="flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700"
        >
          <Plus size={15} />
          Add Task
        </a>
      </div>

      {tasks.length === 0 ? (
        <p className="text-sm text-muted">No tasks for this case yet.</p>
      ) : (
        <div>
          {tasks
            .slice()
            .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""))
            .map((task) => {
              const done = task.status === "Completed";
              return (
                <div
                  key={task.id}
                  style={tint(task.caseId ?? task.id)}
                  className="flex items-center gap-3 tint mb-2 rounded-xl border px-3 py-2.5 last:mb-0"
                >
                  <button
                    type="button"
                    onClick={() => toggleTask(task)}
                    aria-label={done ? "Mark as pending" : "Mark as completed"}
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                      done ? "border-brand-600 bg-brand-600" : "border-line"
                    }`}
                  >
                    {done && <span className="h-2 w-2 rounded-full bg-white" />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-sm font-medium ${done ? "text-faint line-through" : "text-ink"}`}>
                      {task.title}
                    </p>
                    {task.dueDate && (
                      <p className="truncate text-xs text-muted">
                        Due {formatDate(task.dueDate)} ({relativeDayLabel(task.dueDate)})
                      </p>
                    )}
                  </div>
                  {/* Plain <a>, not next/link — same reasoning as "Add Task" above. */}
                  { }
                  <a
                    href={`/tasks/${task.id}/edit`}
                    aria-label="Edit task"
                    className="shrink-0 text-faint hover:text-ink"
                  >
                    <Pencil size={15} />
                  </a>
                  <button
                    type="button"
                    onClick={() => removeTask(task)}
                    disabled={!isOnline}
                    aria-label="Delete task"
                    title={!isOnline ? "Requires an internet connection" : undefined}
                    className="shrink-0 text-faint hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {isOnline ? <Trash2 size={16} /> : <WifiOff size={15} />}
                  </button>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
