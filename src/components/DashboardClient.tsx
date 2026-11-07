"use client";

import Link from "next/link";
import { Calendar, ClipboardCheck, Plus } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { AdSlot } from "@/components/AdSlot";
import { StatCard } from "@/components/StatCard";
import { SectionCard } from "@/components/SectionCard";
import { UpcomingHearingsList } from "@/components/UpcomingHearingsList";
import { DashboardTasksList } from "@/components/DashboardTasksList";
import { CaseTable } from "@/components/CaseTable";
import { DashboardBackdrop } from "@/components/DashboardBackdrop";
import { useOfflineCollection } from "@/hooks/useOfflineData";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import type { LegalCase, Hearing, Task } from "@/lib/types";

export function DashboardClient() {
  const { name } = useCurrentUser();
  const { data: cases, isOffline: casesOffline } = useOfflineCollection<LegalCase>("cases", "/api/cases");
  const { data: hearings } = useOfflineCollection<Hearing>("hearings", "/api/hearings");
  const { data: tasks } = useOfflineCollection<Task>("tasks", "/api/tasks");

  const casesById = new Map(cases.map((c) => [c.id, c]));

  const upcomingHearings = [...hearings]
    .filter((h) => new Date(h.date).getTime() >= new Date().setHours(0, 0, 0, 0))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5);

  const hearingsByCaseId = new Map<string, Hearing[]>();
  for (const h of hearings) {
    if (!hearingsByCaseId.has(h.caseId)) hearingsByCaseId.set(h.caseId, []);
    hearingsByCaseId.get(h.caseId)!.push(h);
  }

  const pendingTasks = [...tasks]
    .filter((t) => t.status === "Pending")
    .sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"))
    .slice(0, 5);

  const recentCases = [...cases].sort((a, b) => b.lastUpdated.localeCompare(a.lastUpdated)).slice(0, 5);

  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
  const monthEnd = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).getTime();
  const stats = {
    hearingsThisMonth: hearings.filter((h) => {
      const t = new Date(h.date).getTime();
      return t >= monthStart && t < monthEnd;
    }).length,
    pendingTasks: tasks.filter((t) => t.status === "Pending").length,
  };

  const neverSynced = casesOffline && cases.length === 0 && hearings.length === 0 && tasks.length === 0;

  return (
    <div className="relative isolate">
      <DashboardBackdrop />

      <div className="mb-4 flex min-h-28 items-center justify-between gap-3 py-3 sm:min-h-32">
        <div className="min-w-0">
          <h1 className="break-words text-xl font-bold text-ink sm:text-2xl">Welcome back, {name} 👋</h1>
          <p className="mt-0.5 text-sm text-muted">Here&apos;s what&apos;s happening today.</p>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <Link href="/settings">
            <Avatar name={name} size="sm" />
          </Link>
        </div>
      </div>

      <AdSlot className="mb-4" />

      {/* Plain <a>, not next/link — the mobile floating action button is the
          main way phones create a case, so it has to work offline too. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a
        href="/cases/new"
        aria-label="New Case"
        className="fixed bottom-24 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-brand-600 to-brand-700 text-white shadow-lg shadow-brand-700/40 transition-transform active:scale-90 lg:hidden"
      >
        <Plus size={24} />
      </a>

      {neverSynced ? (
        <div className="rounded-2xl border border-dashed border-line bg-surface p-6 text-center text-sm text-muted">
          This information isn&apos;t available offline yet. Connect to the internet once to load your dashboard.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <StatCard
              icon={Calendar}
              value={stats.hearingsThisMonth}
              label="Hearings (Month)"
              tone="purple"
              href="/calendar"
            />
            <StatCard icon={ClipboardCheck} value={stats.pendingTasks} label="Pending Tasks" tone="amber" href="/tasks" />
          </div>

          <div className="mt-4">
            <SectionCard title="Upcoming Hearings" viewAllHref="/calendar">
              <UpcomingHearingsList
                hearings={upcomingHearings}
                casesById={casesById}
                hearingsByCaseId={hearingsByCaseId}
                emptyMessage="No upcoming hearings scheduled."
              />
            </SectionCard>
          </div>

          <div className="mt-4">
            <SectionCard title="Recent Cases" viewAllHref="/cases">
              <CaseTable cases={recentCases} variant="compact" hearingsByCaseId={hearingsByCaseId} />
            </SectionCard>
          </div>

          <div className="mt-4">
            <SectionCard title="Important Tasks" viewAllHref="/tasks">
              <DashboardTasksList tasks={pendingTasks} emptyMessage="No pending tasks. Nice work." />
            </SectionCard>
          </div>
        </>
      )}
    </div>
  );
}
