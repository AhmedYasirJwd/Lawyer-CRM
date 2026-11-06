import type { Task } from "@/lib/types";
import { formatDate, relativeDayLabel } from "@/lib/format";
import { tint } from "@/lib/urgency";

function urgency(dueDate?: string): "overdue" | "today" | "tomorrow" | "later" | "none" {
  if (!dueDate) return "none";
  const label = relativeDayLabel(dueDate);
  if (label === "Today") return "today";
  if (label === "Tomorrow") return "tomorrow";
  if (label.endsWith("days ago")) return "overdue";
  return "later";
}

const URGENCY_STYLE: Record<ReturnType<typeof urgency>, string> = {
  overdue: "bg-red-50 text-red-600",
  today: "bg-red-50 text-red-600",
  tomorrow: "bg-amber-50 text-amber-600",
  later: "bg-blue-50 text-blue-600",
  none: "bg-slate-100 text-muted",
};

export function DashboardTasksList({
  tasks,
  emptyMessage = "No pending tasks.",
}: {
  tasks: Task[];
  emptyMessage?: string;
}) {
  if (tasks.length === 0) {
    return <p className="py-8 text-center text-sm text-muted">{emptyMessage}</p>;
  }

  return (
    <div className="space-y-2">
      {tasks.map((t) => {
        const u = urgency(t.dueDate);
        const label = t.dueDate ? (u === "today" || u === "tomorrow" ? relativeDayLabel(t.dueDate) : formatDate(t.dueDate)) : "No due date";
        return (
          <a
            key={t.id}
            href={t.caseId ? `/cases/${t.caseId}` : "/tasks"}
            style={tint(t.caseId ?? t.id)}
            className="tint flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 transition-[filter] hover:brightness-95"
          >
            <span className="min-w-0 truncate text-sm font-medium text-ink">{t.title}</span>
            <span
              className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${URGENCY_STYLE[u]}`}
            >
              {label}
            </span>
          </a>
        );
      })}
    </div>
  );
}
