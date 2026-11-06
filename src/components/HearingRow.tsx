import { ChevronRight, Pencil } from "lucide-react";
import type { Hearing, LegalCase } from "@/lib/types";
import { dayNumber, monthShort, formatTime, relativeDayLabel } from "@/lib/format";
import { tint } from "@/lib/urgency";

export function HearingRow({ hearing, legalCase }: { hearing: Hearing; legalCase?: LegalCase }) {
  const label = relativeDayLabel(hearing.date);
  const isToday = label === "Today";

  return (
    <div style={tint(hearing.caseId)} className="flex items-center gap-2 tint mb-2 rounded-xl border px-3 py-2.5 last:mb-0">
      <a href={legalCase ? `/cases/${legalCase.id}` : "#"} className="flex min-w-0 flex-1 items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-brand-50 text-brand-700">
          <span className="text-[10px] font-medium leading-none">{monthShort(hearing.date)}</span>
          <span className="text-base font-bold leading-tight">{dayNumber(hearing.date)}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">
            {legalCase ? `#${legalCase.caseNumber}` : "Hearing"}
          </p>
          <p className="truncate text-xs text-muted">
            {legalCase?.title ?? hearing.purpose} · {legalCase?.court ?? hearing.court}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="text-xs font-medium text-ink">{formatTime(hearing.date)}</span>
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
              isToday ? "bg-brand-100 text-brand-700" : "bg-slate-100 text-muted"
            }`}
          >
            {label}
          </span>
        </div>
        <ChevronRight size={16} className="shrink-0 text-faint" />
      </a>
      {legalCase && (
        // Plain <a>, not next/link — the edit page is offline-enabled, and
        // only a real navigation is guaranteed to be caught by the service
        // worker when there's no network.
         
        <a
          href={`/cases/${legalCase.id}/hearings/${hearing.id}/edit`}
          aria-label="Edit hearing"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-faint hover:bg-background hover:text-ink"
        >
          <Pencil size={14} />
        </a>
      )}
    </div>
  );
}
