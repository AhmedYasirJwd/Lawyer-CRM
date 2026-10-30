"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import type { Hearing, LegalCase } from "@/lib/types";
import { HearingRow } from "./HearingRow";
import { PageHeader } from "./PageHeader";
import { useOfflineCollection } from "@/hooks/useOfflineData";

function localDateKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function CalendarExplorer() {
  const { data: hearings, isOffline } = useOfflineCollection<Hearing>("hearings", "/api/hearings");
  const { data: cases } = useOfflineCollection<LegalCase>("cases", "/api/cases");
  const neverSynced = isOffline && hearings.length === 0 && cases.length === 0;
  // Seed as `null` and only set real dates on the client, in an effect. `new Date()`
  // depends on the machine's clock/timezone — computing "today" during server
  // render (which can be in a different timezone than the visitor's phone) and
  // reusing it for the client's first paint causes a hydration mismatch, which
  // can leave this grid's day buttons non-interactive until a full reload.
  const [currentMonth, setCurrentMonth] = useState<Date | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [slideDir, setSlideDir] = useState<1 | -1>(1);

  useEffect(() => {
    const now = new Date();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- client-only "today" (see above); must run after hydration
    setCurrentMonth(startOfMonth(now));
    setSelectedDate(now);
  }, []);

  function goToPrevMonth() {
    setSlideDir(-1);
    setCurrentMonth((m) => (m ? subMonths(m, 1) : m));
  }

  function goToNextMonth() {
    setSlideDir(1);
    setCurrentMonth((m) => (m ? addMonths(m, 1) : m));
  }

  // Swipe support for touch devices — swipe left for the previous month,
  // swipe right for the next month. Mostly-vertical touches (page scrolling)
  // and small accidental drags are ignored.
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  function handleTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  }

  function handleTouchEnd(e: React.TouchEvent) {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy) * 1.3) return;
    if (dx < 0) {
      goToPrevMonth();
    } else {
      goToNextMonth();
    }
  }

  const casesById = useMemo(() => new Map(cases.map((c) => [c.id, c])), [cases]);

  const hearingsByDate = useMemo(() => {
    const map = new Map<string, Hearing[]>();
    for (const h of hearings) {
      const key = localDateKey(h.date);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(h);
    }
    for (const list of map.values()) list.sort((a, b) => a.date.localeCompare(b.date));
    return map;
  }, [hearings]);

  const days = useMemo(() => {
    if (!currentMonth) return [];
    const start = startOfWeek(startOfMonth(currentMonth));
    const end = endOfWeek(endOfMonth(currentMonth));
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  if (!currentMonth || !selectedDate) {
    return (
      <div>
        <PageHeader title="Calendar" subtitle={`${hearings.length} scheduled hearings`} />
        <div className="card h-[420px] animate-pulse p-4 sm:p-5" />
        <div className="mt-4 card h-24 animate-pulse p-5" />
      </div>
    );
  }

  const selectedKey = format(selectedDate, "yyyy-MM-dd");
  const selectedHearings = hearingsByDate.get(selectedKey) ?? [];

  return (
    <div>
      <PageHeader
        title="Calendar"
        subtitle={`${hearings.length} scheduled hearings`}
        action={
          // Plain <a>, not next/link — /calendar/new is offline-enabled
          // and needs a real navigation for the service worker to serve
          // it with no network.
           
          <a
            href="/calendar/new"
            className="flex items-center gap-1.5 rounded-xl bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">Add Hearing</span>
          </a>
        }
      />

      {neverSynced && (
        <div className="mb-4 rounded-2xl border border-dashed border-line bg-surface p-6 text-center text-sm text-muted">
          This information isn&apos;t available offline yet. Connect to the internet once to load your calendar.
        </div>
      )}

      <div
        className="card select-none overflow-hidden p-4 sm:p-5"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">{format(currentMonth, "MMMM yyyy")}</h2>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                const today = new Date();
                setCurrentMonth(startOfMonth(today));
                setSelectedDate(today);
              }}
              className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold text-muted hover:bg-background"
            >
              Today
            </button>
            <button
              type="button"
              aria-label="Previous month"
              onClick={goToPrevMonth}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-transform hover:bg-background active:scale-90"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              aria-label="Next month"
              onClick={goToNextMonth}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-transform hover:bg-background active:scale-90"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        <div
          key={format(currentMonth, "yyyy-MM")}
          className={slideDir === 1 ? "animate-month-in-right" : "animate-month-in-left"}
        >
          <div className="grid grid-cols-7 gap-1 text-center">
            {WEEKDAYS.map((d) => (
              <div key={d} className="py-1.5 text-[11px] font-semibold uppercase tracking-wide text-faint">
                {d}
              </div>
            ))}
            {days.map((day) => {
              const key = format(day, "yyyy-MM-dd");
              const count = hearingsByDate.get(key)?.length ?? 0;
              const inMonth = isSameMonth(day, currentMonth);
              const selected = isSameDay(day, selectedDate);
              const today = isToday(day);

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedDate(day)}
                  className={`relative flex aspect-square flex-col items-center justify-center rounded-xl text-sm transition-colors ${
                    selected
                      ? "bg-ink text-white"
                      : count > 0
                        ? "bg-brand-50 text-brand-700 hover:bg-brand-100"
                        : "text-ink hover:bg-background"
                  } ${!inMonth ? "opacity-35" : ""}`}
                >
                  <span className={`font-medium ${today && !selected ? "text-brand-700" : ""}`}>{format(day, "d")}</span>
                {today && (
                  <span
                    className={`absolute bottom-1.5 h-1 w-1 rounded-full ${selected ? "bg-white" : "bg-brand-600"}`}
                  />
                )}
                {count > 0 && !today && (
                  <span
                    className={`mt-0.5 text-[9px] font-semibold leading-none ${selected ? "text-white" : "text-brand-600"}`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
          </div>
        </div>
      </div>

      <div className="mt-4 card p-5">
        <h2 className="mb-3 text-sm font-semibold text-ink">
          {isToday(selectedDate) ? "Today" : format(selectedDate, "EEEE, d MMMM yyyy")}
          {isToday(selectedDate) && (
            <span className="ml-2 text-xs font-normal text-muted">{format(selectedDate, "d MMMM yyyy")}</span>
          )}
        </h2>
        {selectedHearings.length === 0 ? (
          <p className="text-sm text-muted">No hearings scheduled for this date.</p>
        ) : (
          selectedHearings.map((h) => <HearingRow key={h.id} hearing={h} legalCase={casesById.get(h.caseId)} />)
        )}
      </div>
    </div>
  );
}
