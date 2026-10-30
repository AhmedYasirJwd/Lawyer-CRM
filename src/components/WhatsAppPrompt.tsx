"use client";

import { MessageCircle, X } from "lucide-react";
import type { Hearing, LegalCase, Party } from "@/lib/types";
import { formatDate, formatTime } from "@/lib/format";

// Pakistani mobile numbers are usually saved locally ("0300 1234567");
// wa.me needs the international form without "+" ("923001234567").
function waNumber(phone: string): string | null {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  else if (digits.startsWith("0")) digits = `92${digits.slice(1)}`;
  return digits.length >= 10 ? digits : null;
}

function hearingMessage(legalCase: LegalCase, hearing: Hearing, name?: string): string {
  return [
    `Assalam-o-Alaikum${name ? ` ${name}` : ""},`,
    `Your case ${legalCase.title} (No. ${legalCase.caseNumber}) is fixed for hearing on ` +
      `${formatDate(hearing.date)} at ${formatTime(hearing.date)}, ${hearing.court || legalCase.court}.`,
    hearing.purpose ? `Purpose: ${hearing.purpose}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Shown right after a hearing is saved: offers to send the date to the
 *  client on WhatsApp. Opening WhatsApp is always the user's choice —
 *  "Not now" just carries on to where the form was going. */
export function WhatsAppPrompt({
  legalCase,
  hearing,
  onDone,
}: {
  legalCase: LegalCase;
  hearing: Hearing;
  onDone: () => void;
}) {
  // The client's side first (role matching "Counsel For"), then anyone else
  // on the case who has a phone number saved.
  const recipients = (legalCase.parties ?? [])
    .filter((p): p is Party & { phone: string } => Boolean(p.phone && waNumber(p.phone)))
    .sort((a, b) => Number(b.role === legalCase.counselFor) - Number(a.role === legalCase.counselFor));

  function send(name?: string, phone?: string) {
    const text = encodeURIComponent(hearingMessage(legalCase, hearing, name));
    const number = phone ? waNumber(phone) : null;
    window.open(number ? `https://wa.me/${number}?text=${text}` : `https://wa.me/?text=${text}`, "_blank");
    onDone();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <div role="dialog" aria-modal="true" aria-labelledby="wa-title" className="card w-full max-w-sm p-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 id="wa-title" className="text-base font-semibold text-ink">
              Hearing saved
            </h2>
            <p className="text-sm text-muted">Send the date to your client on WhatsApp?</p>
          </div>
          <button type="button" onClick={onDone} aria-label="Close" className="text-faint hover:text-ink">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-2">
          {recipients.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => send(p.name, p.phone)}
              className="flex w-full items-center gap-3 rounded-xl bg-[#25D366] px-4 py-3 text-left text-white hover:brightness-95"
            >
              <MessageCircle size={18} className="shrink-0" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{p.name}</span>
                <span className="block truncate text-xs opacity-90">
                  {p.role} · {p.phone}
                </span>
              </span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => send()}
            className="flex w-full items-center gap-3 rounded-xl border border-line px-4 py-3 text-sm font-semibold text-ink hover:bg-background"
          >
            <MessageCircle size={18} className="shrink-0 text-[#25D366]" />
            {recipients.length ? "Choose another contact…" : "Choose a contact in WhatsApp…"}
          </button>
          <button
            type="button"
            onClick={onDone}
            className="w-full rounded-xl px-4 py-2.5 text-sm font-medium text-muted hover:text-ink"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
