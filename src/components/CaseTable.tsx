import { Landmark, Tag, ChevronRight } from "lucide-react";
import type { LegalCase, Hearing } from "@/lib/types";
import { dayNumber, formatDate, formatTime, monthShort, splitHearings } from "@/lib/format";
import { caseTone, daysUntil } from "@/lib/urgency";

/** The party this lawyer represents (the one whose role matches "Counsel
 *  For"), falling back to the first party on side 1. */
function clientName(c: LegalCase): string {
  const parties = c.parties ?? [];
  const client =
    parties.find((p) => p.role === c.counselFor) ?? parties.find((p) => p.side === 1) ?? parties[0];
  return client?.name ?? "";
}

/** The next hearing as a calendar-style block — the first thing a lawyer
 *  scans a case list for. Tinted with the case's tone (see caseTone). */
export function DateBlock({ iso, className, size }: { iso?: string; className: string; size: "sm" | "lg" }) {
  const box = size === "lg" ? "h-12 w-12 sm:h-14 sm:w-14" : "h-11 w-11";
  return (
    <span className={`flex ${box} shrink-0 flex-col items-center justify-center rounded-xl text-center ${className}`}>
      {!iso ? (
        <span className="text-[10px] font-semibold leading-tight">No<br />date</span>
      ) : daysUntil(iso) === 0 ? (
        <>
          <span className="text-[10px] font-bold uppercase leading-none">Today</span>
          <span className="mt-0.5 text-[10px] font-semibold leading-none">{formatTime(iso)}</span>
        </>
      ) : (
        <>
          <span className="text-[10px] font-bold uppercase leading-none">{monthShort(iso)}</span>
          <span className={`${size === "lg" ? "text-lg" : "text-base"} font-bold leading-tight`}>{dayNumber(iso)}</span>
        </>
      )}
    </span>
  );
}

export function CaseTable({
  cases,
  variant = "full",
  emptyMessage = "No cases found.",
  hearingsByCaseId,
}: {
  cases: LegalCase[];
  variant?: "full" | "compact";
  emptyMessage?: string;
  hearingsByCaseId?: Map<string, Hearing[]>;
}) {
  if (cases.length === 0) {
    return <p className="py-8 text-center text-sm text-muted">{emptyMessage}</p>;
  }

  const full = variant === "full";

  if (!full) {
    // Compact "card" style used for Recent Cases on the dashboard: next
    // hearing date block on the left, colored per case (hue) and by how soon
    // (depth). Three lines: number + client, title, court + last hearing.
    return (
      <div className="space-y-2.5">
        {cases.map((c) => {
          const { last, next } = splitHearings(hearingsByCaseId?.get(c.id));
          const tone = caseTone(c.id, next?.date);
          const client = clientName(c);
          return (
            <a
              key={c.id}
              href={`/cases/${c.id}`}
              style={tone.vars}
              className={`flex items-start gap-3 rounded-xl border border-l-4 border-line p-3 transition-[filter] hover:brightness-95 ${tone.card}`}
            >
              <DateBlock iso={next?.date} className={tone.chip} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="shrink-0 text-sm font-semibold text-ink">#{c.caseNumber}</span>
                  {client && <span className="truncate text-xs font-medium text-brand-700">{client}</span>}
                </span>
                <span className="block truncate text-xs text-muted">{c.title}</span>
                {/* One line, always: the court name truncates first. */}
                <span className="mt-1 flex items-center gap-3 whitespace-nowrap text-xs">
                  <span className="min-w-0 truncate text-faint">{c.court}</span>
                  {last && <span className="shrink-0 text-faint">Last: {formatDate(last.date)}</span>}
                </span>
              </span>
            </a>
          );
        })}
      </div>
    );
  }

  // Full list — used on the Cases page. A stack of richer cards (not a
  // table) so it reads well on mobile without horizontal scrolling, led by
  // the next-hearing date block and tinted with the same per-case tone as
  // the dashboard.
  return (
    <div className="space-y-3">
      {cases.map((c) => {
        const { next } = splitHearings(hearingsByCaseId?.get(c.id));
        const tone = caseTone(c.id, next?.date);
        return (
          <a
            key={c.id}
            href={`/cases/${c.id}`}
            style={tone.vars}
            className={`group relative flex items-start gap-3.5 overflow-hidden rounded-2xl border border-line p-4 pl-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md sm:items-center sm:gap-4 sm:p-4 sm:pl-6 ${tone.card}`}
          >
            <span aria-hidden className={`absolute inset-y-0 left-0 w-1.5 ${tone.bar}`} />

            <DateBlock iso={next?.date} className={tone.chip} size="lg" />

            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-ink group-hover:text-brand-700 sm:text-base">
                #{c.caseNumber}
              </span>
              <span className="mt-0.5 block truncate text-sm text-muted">{c.title}</span>

              <span className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-faint">
                <span className="inline-flex items-center gap-1">
                  <Landmark size={12} />
                  {c.court}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Tag size={12} />
                  {c.caseType}
                </span>
                <span>{c.stage}</span>
              </span>

            </span>

            <ChevronRight
              size={18}
              className="hidden shrink-0 text-faint transition-colors group-hover:text-brand-600 sm:block"
            />
          </a>
        );
      })}
    </div>
  );
}
