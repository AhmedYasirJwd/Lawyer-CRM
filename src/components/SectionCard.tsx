"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

export function SectionCard({
  title,
  children,
  viewAllHref,
  collapsible = false,
  defaultOpen = true,
  className = "",
}: {
  title: string;
  children: ReactNode;
  viewAllHref?: string;
  collapsible?: boolean;
  defaultOpen?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className={`card p-5 ${className}`}>
      {/* "section-head" turns into a tinted band inside a .case-accent wrapper (globals.css). */}
      <div className="section-head flex items-center justify-between">
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        <div className="flex items-center gap-3">
          {viewAllHref && (
            <a href={viewAllHref} className="text-sm font-medium text-brand-600 hover:text-brand-700">
              View All
            </a>
          )}
          {collapsible && (
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-label={open ? "Collapse" : "Expand"}
              className="text-faint transition-transform"
            >
              <ChevronDown
                size={18}
                className={`transition-transform duration-200 ${open ? "" : "-rotate-90"}`}
              />
            </button>
          )}
        </div>
      </div>
      {(!collapsible || open) && <div className="mt-4">{children}</div>}
    </section>
  );
}
