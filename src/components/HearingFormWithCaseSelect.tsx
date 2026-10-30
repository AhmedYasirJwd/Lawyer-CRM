"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { WifiOff } from "lucide-react";
import type { Hearing, LegalCase } from "@/lib/types";
import { saveHearing } from "@/lib/hearing-sync";
import { WhatsAppPrompt } from "@/components/WhatsAppPrompt";

const inputClass =
  "w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-faint focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600";

export function HearingFormWithCaseSelect({ cases }: { cases: LegalCase[] }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedOfflineNotice, setSavedOfflineNotice] = useState(false);
  const [caseId, setCaseId] = useState(cases[0]?.id ?? "");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState("11:00");
  const [purpose, setPurpose] = useState("");

  // Decided up front so the hearing can be saved to the device and the
  // case page can show it immediately, online or off.
  const idRef = useRef(crypto.randomUUID());
  const [savedHearing, setSavedHearing] = useState<Hearing | null>(null);

  const selected = cases.find((c) => c.id === caseId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setSubmitting(true);
    setError(null);
    setSavedOfflineNotice(false);

    const payload = {
      caseId: selected.id,
      date: new Date(`${date}T${time}:00`).toISOString(),
      purpose,
      court: selected.court,
      counselFor: selected.counselFor,
    };
    const localHearing: Hearing = {
      id: idRef.current,
      caseId: payload.caseId,
      date: payload.date,
      purpose: payload.purpose,
      court: payload.court,
      counselFor: payload.counselFor,
    };

    const result = await saveHearing(localHearing, "create", payload);

    if (!result.ok) {
      setError(result.error);
      setSubmitting(false);
      return;
    }

    if (!result.synced) setSavedOfflineNotice(true);
    setSavedHearing(localHearing);
  }

  function leave() {
    // Hard navigation — see HearingForm for why (the Calendar page is
    // offline-enabled and needs a real navigation for the service worker
    // to serve it with no network).
    window.location.href = "/calendar";
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {savedHearing && selected && (
        <WhatsAppPrompt legalCase={selected} hearing={savedHearing} onDone={leave} />
      )}
      {error && <p className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</p>}
      {savedOfflineNotice && (
        <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-4 py-2.5 text-sm text-amber-700">
          <WifiOff size={16} className="mt-0.5 shrink-0" />
          Saved on this device. It&apos;ll sync automatically once you&apos;re back online.
        </p>
      )}
      <div className="card space-y-4 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-xs font-medium text-muted">Case</span>
            <select required className={inputClass} value={caseId} onChange={(e) => setCaseId(e.target.value)}>
              {cases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.caseType} #{c.caseNumber} — {c.title}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted">Date</span>
            <input
              required
              type="date"
              className={inputClass}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted">Time</span>
            <input
              required
              type="time"
              className={inputClass}
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-xs font-medium text-muted">Purpose</span>
            <input
              required
              className={inputClass}
              placeholder="e.g. Cross examination of plaintiff witness"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
            />
          </label>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-ink hover:bg-background"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting || !selected}
          className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {submitting ? "Saving..." : "Schedule Hearing"}
        </button>
      </div>
    </form>
  );
}
