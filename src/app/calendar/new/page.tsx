"use client";

import { ArrowLeft } from "lucide-react";
import type { LegalCase } from "@/lib/types";
import { HearingFormWithCaseSelect } from "@/components/HearingFormWithCaseSelect";
import { useOfflineCollection } from "@/hooks/useOfflineData";

export default function NewHearingFromCalendarPage() {
  const { data: cases, loading } = useOfflineCollection<LegalCase>("cases", "/api/cases");

  return (
    <div>
      <div className="mb-5">
        {/* Plain <a>, not next/link — this page is reachable offline, and
            "back to Calendar" needs to stay reachable offline too. */}
        { }
        <a href="/calendar" className="flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
          <ArrowLeft size={17} />
          Back to Calendar
        </a>
        <h1 className="mt-2 text-xl font-bold text-ink sm:text-2xl">Schedule Hearing</h1>
      </div>
      {loading ? (
        <div className="card h-64 animate-pulse p-5" />
      ) : cases.length === 0 ? (
        <p className="text-sm text-muted">Create a case first before scheduling a hearing.</p>
      ) : (
        <HearingFormWithCaseSelect cases={cases} />
      )}
    </div>
  );
}
