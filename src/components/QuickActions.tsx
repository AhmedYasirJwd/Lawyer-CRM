"use client";

import { CalendarPlus, ClipboardCheck, UploadCloud } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface QuickAction {
  icon: LucideIcon;
  label: string;
  href?: string;
  tone: "green" | "blue" | "amber" | "purple" | "slate";
}

const TONE_CLASSES: Record<QuickAction["tone"], string> = {
  green: "bg-brand-100 text-brand-700",
  blue: "bg-blue-50 text-blue-600",
  amber: "bg-amber-50 text-amber-600",
  purple: "bg-purple-50 text-purple-600",
  slate: "bg-slate-100 text-muted",
};

// Computed entirely inside this Client Component — icon components (functions)
// can't be serialized across the server/client boundary, so this can't live
// in a server-rendered page and be passed down as a prop.
function buildActions(caseId?: string): QuickAction[] {
  return [
    {
      icon: CalendarPlus,
      label: "Add Hearing",
      href: caseId ? `/cases/${caseId}/hearings/new` : "/calendar/new",
      tone: "blue",
    },
    {
      icon: ClipboardCheck,
      label: "Add Task",
      href: caseId ? `/tasks/new?caseId=${caseId}` : "/tasks/new",
      tone: "amber",
    },
    { icon: UploadCloud, label: "Upload Document", href: caseId ? "#documents" : undefined, tone: "purple" },
  ];
}

export function QuickActions({ caseId }: { caseId?: string }) {
  const actions = buildActions(caseId);

  return (
    <div className="card grid grid-cols-3 gap-1 p-4 sm:gap-2">
      {actions.map((action) => {
        const Icon = action.icon;
        const body = (
          <div className="flex flex-col items-center gap-2 text-center">
            <div
              className={`flex h-11 w-11 items-center justify-center rounded-2xl ${TONE_CLASSES[action.tone]}`}
            >
              <Icon size={18} />
            </div>
            <span className="text-[11px] font-medium leading-tight text-ink sm:text-xs">
              {action.label}
            </span>
          </div>
        );
        if (action.href) {
          return (
            // Plain <a>, not next/link — these destinations (hearing/task
            // create forms) are offline-enabled, and only a real navigation
            // is guaranteed to be caught by the service worker when
            // there's no network.
             
            <a key={action.label} href={action.href} className="rounded-xl py-1 hover:bg-background">
              {body}
            </a>
          );
        }
        return (
          <button key={action.label} type="button" className="rounded-xl py-1 hover:bg-background">
            {body}
          </button>
        );
      })}
    </div>
  );
}
