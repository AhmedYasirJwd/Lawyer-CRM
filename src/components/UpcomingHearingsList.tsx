import { ChevronRight, MapPin } from "lucide-react";
import type { Hearing, LegalCase } from "@/lib/types";
import { dayNumber, formatDate, formatTime, monthShort, splitHearings } from "@/lib/format";
import { caseTone, daysUntil } from "@/lib/urgency";

function isToday(iso: string): boolean {
  return daysUntil(iso) === 0;
}

export function UpcomingHearingsList({
  hearings,
  casesById,
  hearingsByCaseId,
  emptyMessage = "No upcoming hearings scheduled.",
}: {
  hearings: Hearing[];
  casesById: Map<string, LegalCase>;
  hearingsByCaseId?: Map<string, Hearing[]>;
  emptyMessage?: string;
}) {
  if (hearings.length === 0) {
    return <p className="py-8 text-center text-sm text-muted">{emptyMessage}</p>;
  }

  return (
    <div className="space-y-2.5">
      {hearings.map((h) => {
        const tone = caseTone(h.caseId, h.date);
        const c = casesById.get(h.caseId);
        const today = isToday(h.date);
        const { last } = splitHearings(hearingsByCaseId?.get(h.caseId));

        return (
          <a
            key={h.id}
            href={c ? `/cases/${c.id}` : "/calendar"}
            style={tone.vars}
            className={`flex items-start gap-3 rounded-xl border border-l-4 border-line p-3.5 transition-[filter] hover:brightness-95 ${tone.card}`}
          >
            <div
              className={`flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl text-center ${tone.chip}`}
            >
              {today ? (
                <span className="text-[11px] font-bold leading-tight">{formatTime(h.date)}</span>
              ) : (
                <>
                  <span className="text-[10px] font-bold uppercase leading-none">{monthShort(h.date)}</span>
                  <span className="text-base font-bold leading-tight">{dayNumber(h.date)}</span>
                </>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5">
                <p className="truncate text-sm font-semibold text-ink">
                  {c ? `${c.caseType} No. ${c.caseNumber}` : h.purpose}
                </p>
                {today && (
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${tone.chip}`}>
                    {formatTime(h.date)}
                  </span>
                )}
              </div>
              <p className="truncate text-xs text-muted">{c ? c.title : ""}</p>
              <p className="mt-1 truncate text-xs text-faint">{h.purpose}</p>

              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="inline-flex items-center gap-1 text-[13px] font-medium text-ink">
                  <MapPin size={13} className="text-faint" />
                  {c?.court ?? h.court}
                </span>
                {!today && <span className="text-xs text-faint">{formatDate(h.date)}</span>}
                {last && <span className="text-xs text-faint">Last hearing: {formatDate(last.date)}</span>}
              </div>
            </div>

            <ChevronRight size={16} className="mt-1 shrink-0 text-faint" />
          </a>
        );
      })}
    </div>
  );
}
