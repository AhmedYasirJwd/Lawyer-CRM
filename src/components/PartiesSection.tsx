"use client";

import { useState } from "react";
import { Phone, IdCard, MapPin, User } from "lucide-react";
import type { Party, PartySide } from "@/lib/types";
import { tint } from "@/lib/urgency";

function PartyCard({ party, showRole }: { party: Party; showRole: boolean }) {
  return (
    <div style={tint(party.id)} className="tint flex-1 rounded-xl border p-3">
      <div className="flex items-center gap-2 text-sm font-medium text-ink">
        <User size={15} className="text-faint" />
        {party.name}
      </div>
      {showRole && <p className="mt-0.5 text-xs text-faint">{party.role}</p>}
      {(party.relationType || party.relationName) && (
        <div className="mt-1 text-xs text-muted">
          {[party.relationType, party.relationName].filter(Boolean).join(" ")}
        </div>
      )}
      {party.phone && (
        <div className="mt-1.5 flex items-center gap-2 text-xs text-muted">
          <Phone size={13} className="text-faint" />
          {party.phone}
        </div>
      )}
      {party.cnic && (
        <div className="mt-1.5 flex items-center gap-2 text-xs text-muted">
          <IdCard size={13} className="text-faint" />
          {party.cnic}
        </div>
      )}
      {party.address && (
        <div className="mt-1.5 flex items-center gap-2 text-xs text-muted">
          <MapPin size={13} className="text-faint" />
          {party.address}
        </div>
      )}
    </div>
  );
}

function PartySideColumn({ parties, side, label }: { parties: Party[]; side: PartySide; label: string }) {
  const sideParties = parties.filter((p) => (p.side ?? 1) === side);
  // A single person's own role reads better as the column heading; once
  // there's more than one, the heading goes generic and each card labels
  // its own role instead, since they don't have to match.
  const heading = sideParties.length === 1 ? sideParties[0].role : label;
  return (
    <div className="flex-1">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-faint">{heading}</p>
      {sideParties.length === 0 ? (
        <p className="text-sm text-faint">—</p>
      ) : (
        <div className="space-y-4">
          {sideParties.map((p) => (
            <PartyCard key={p.id} party={p} showRole={sideParties.length > 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export function PartiesSection({ parties }: { parties: Party[] }) {
  const [expanded, setExpanded] = useState(false);

  if (parties.length === 0) {
    return <p className="text-sm text-muted">No parties added yet.</p>;
  }

  // Anyone beyond the first couple of names per side is folded away by
  // default so a case with a long list of co-plaintiffs/co-defendants
  // doesn't dominate the page at a glance.
  const VISIBLE_PER_SIDE = 2;
  const side1 = parties.filter((p) => (p.side ?? 1) === 1);
  const side2 = parties.filter((p) => (p.side ?? 1) === 2);
  const hiddenCount = Math.max(0, side1.length - VISIBLE_PER_SIDE) + Math.max(0, side2.length - VISIBLE_PER_SIDE);
  const visible = expanded
    ? parties
    : [...side1.slice(0, VISIBLE_PER_SIDE), ...side2.slice(0, VISIBLE_PER_SIDE)];

  return (
    <div>
      <div className="flex flex-col gap-6 sm:flex-row">
        <PartySideColumn parties={visible} side={1} label="Plaintiff / Petitioner" />
        <PartySideColumn parties={visible} side={2} label="Defendant / Respondent" />
      </div>

      {hiddenCount > 0 && !expanded && (
        <div className="mt-4 border-t border-line pt-4">
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="text-sm font-medium text-brand-600 hover:text-brand-700"
          >
            View All Parties ({parties.length})
          </button>
        </div>
      )}
    </div>
  );
}
