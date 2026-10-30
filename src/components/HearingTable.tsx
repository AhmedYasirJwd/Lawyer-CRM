import type { Hearing, LegalCase } from "@/lib/types";
import { formatDate, formatTime, splitHearings } from "@/lib/format";

export function HearingTable({
  hearings,
  casesById,
  hearingsByCaseId,
  emptyMessage = "No hearings found.",
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
    <div className="-mx-5 overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-line text-left text-[11px] font-semibold uppercase tracking-wide text-faint">
            <th className="px-5 py-2.5">Case</th>
            <th className="px-3 py-2.5">Next Hearing</th>
            <th className="px-3 py-2.5">Court</th>
            <th className="px-3 py-2.5">Stage</th>
            <th className="px-3 py-2.5">Last Hearing</th>
          </tr>
        </thead>
        <tbody>
          {hearings.map((h) => {
            const legalCase = casesById.get(h.caseId);
            const { last } = splitHearings(hearingsByCaseId?.get(h.caseId));
            return (
              <tr key={h.id} className="group border-b border-line last:border-b-0 hover:bg-background">
                <td className="px-5 py-3">
                  {/* Plain <a>, not next/link — this table appears on the
                      offline-enabled Calendar page, and case detail needs to
                      still open with no network (see CaseListItem.tsx). */}
                  { }
                  <a href={legalCase ? `/cases/${legalCase.id}` : "#"} className="block min-w-0">
                    <span className="block truncate text-sm font-semibold text-ink group-hover:text-brand-700">
                      {legalCase ? `#${legalCase.caseNumber}` : "—"}
                    </span>
                    <span className="block truncate text-xs text-muted">
                      {legalCase ? legalCase.title : h.purpose}
                    </span>
                  </a>
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-sm font-medium text-ink">
                  {formatDate(h.date)}
                  <span className="ml-1 font-normal text-muted">{formatTime(h.date)}</span>
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-sm text-muted">{legalCase?.court ?? "—"}</td>
                <td className="whitespace-nowrap px-3 py-3 text-sm text-muted">{legalCase?.stage ?? "—"}</td>
                <td className="whitespace-nowrap px-3 py-3 text-sm text-muted">
                  {last ? formatDate(last.date) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
