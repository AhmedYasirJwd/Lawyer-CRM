"use client";

import { useState } from "react";
import { Link2Off, Loader2, RefreshCw } from "lucide-react";
import type { LegalCase } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { cfmsDistrictValue } from "@/lib/cfms-parse";

function Detail({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-sm font-medium text-ink">{value}</dd>
    </div>
  );
}

/** A case's link to the district courts website: its saved record and diary, or
 *  why it isn't linked and how to link it. */
export function CourtRecordSection({ item }: { item: LegalCase }) {
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function update() {
    setUpdating(true);
    setError(null);
    try {
      const res = await fetch(`/api/cfms/sync/${item.id}`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Couldn't reach the court website.");
      setUpdating(false);
    }
  }

  if (!item.cfmsCaseCode) {
    const isHighCourt = item.district === "high-court";
    return (
      <div className="flex items-start gap-3 text-sm text-muted">
        <Link2Off size={16} className="mt-0.5 shrink-0 text-faint" />
        <div>
          {isHighCourt ? (
            <p>High Court cases aren&apos;t on the district courts website, so hearings here are updated by hand.</p>
          ) : (
            <>
              <p>
                {cfmsDistrictValue(item.district)
                  ? "Not linked to a court record yet, so its hearings won't update automatically."
                  : "Add this case's district and number to link it to its court record."}
              </p>
              <a
                href={`/cases/${item.id}/edit`}
                className="mt-1 inline-block font-semibold text-brand-600 hover:text-brand-700"
              >
                Find it on the court website
              </a>
            </>
          )}
        </div>
      </div>
    );
  }

  const record = item.cfmsRecord;
  return (
    <div className="space-y-4">
      <dl className="grid gap-3 sm:grid-cols-2">
        <Detail label="Status at court" value={item.cfmsStatus} />
        <Detail label="Court" value={record?.court} />
        <Detail label="Under section" value={record?.sections} />
        <Detail label="Advocate (side 1)" value={record?.advocate1} />
        <Detail label="Advocate (side 2)" value={record?.advocate2} />
      </dl>

      {record && record.diary.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-faint">Court diary</h3>
          <ol className="space-y-2">
            {record.diary.map((entry) => (
              <li key={entry.date} className="border-l-2 border-line pl-3">
                <p className="text-sm font-semibold text-ink">{formatDate(entry.date)}</p>
                <p className="text-sm text-muted">{entry.text || "Next hearing"}</p>
              </li>
            ))}
          </ol>
        </div>
      )}

      {error && <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-600">{error}</p>}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
        <p className="text-xs text-faint">
          {item.cfmsSyncedAt
            ? `Last updated ${new Date(item.cfmsSyncedAt).toLocaleString("en-GB", {
                dateStyle: "medium",
                timeStyle: "short",
              })}. Updates every night.`
            : "Updates every night."}
        </p>
        <button
          type="button"
          onClick={update}
          disabled={updating}
          className="flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-sm font-semibold text-ink hover:bg-background disabled:opacity-60"
        >
          {updating ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          Update now
        </button>
      </div>
    </div>
  );
}
