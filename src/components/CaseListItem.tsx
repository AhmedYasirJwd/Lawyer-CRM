import { ChevronRight } from "lucide-react";
import type { LegalCase } from "@/lib/types";
import { caseCode } from "@/lib/format";
import { tint } from "@/lib/urgency";

export function CaseListItem({ item }: { item: LegalCase }) {
  const code = caseCode(item.caseType);
  return (
    // Plain <a>, not next/link: case detail is an offline-enabled route
    // (see public/sw.js) and only a real navigation is caught by the
    // service worker's fetch handler — Next's client-side RSC transition
    // is a plain fetch the service worker doesn't intercept, so it just
    // fails with no network, which is exactly what was breaking "open a
    // case" while offline.
     
    <a
      href={`/cases/${item.id}`}
      style={tint(item.id)}
      className="flex items-center gap-3 tint mb-2 rounded-xl border px-3 py-2.5 last:mb-0"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
        {code}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink">
          #{item.caseNumber}
        </p>
        <p className="truncate text-xs text-muted">{item.title}</p>
      </div>
      <ChevronRight size={16} className="shrink-0 text-faint" />
    </a>
  );
}
