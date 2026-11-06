"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { MoreHorizontal, X } from "lucide-react";
import { BOTTOM_NAV_ITEMS, MORE_NAV_ITEMS } from "@/lib/nav";

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export function BottomNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const inMore = MORE_NAV_ITEMS.some((item) => isActive(pathname, item.href));
  // "More" is the last slot, and is the active one on any page it holds.
  const activeIndex = inMore
    ? BOTTOM_NAV_ITEMS.length
    : Math.max(0, BOTTOM_NAV_ITEMS.findIndex((item) => isActive(pathname, item.href)));
  const n = BOTTOM_NAV_ITEMS.length + 1;

  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMoreOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [moreOpen]);

  const itemClass =
    "relative z-10 flex flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl py-2 text-[10px] font-medium transition-transform duration-150 active:scale-90";

  return (
    <>
      {moreOpen && (
        <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setMoreOpen(false)} aria-hidden />
      )}

      <nav className="fixed inset-x-0 bottom-0 z-30 lg:hidden">
        {/* "More" sheet — slides up from just above the bar. */}
        {moreOpen && (
          <div
            id="more-menu"
            className="border-t border-white/10 bg-gradient-to-br from-sidebar-from to-sidebar-to px-3 pb-2 pt-3"
          >
            <div className="mx-auto max-w-md">
              <div className="mb-2 flex items-center justify-between px-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-white/60">More</span>
                <button
                  type="button"
                  onClick={() => setMoreOpen(false)}
                  aria-label="Close menu"
                  className="text-white/70 hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {MORE_NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(pathname, item.href);
                  return (
                    <a
                      key={item.href}
                      href={item.href}
                      className={`flex flex-col items-center gap-1.5 rounded-xl px-2 py-3 text-xs font-medium ${
                        active ? "bg-white text-brand-600" : "bg-white/10 text-white hover:bg-white/15"
                      }`}
                    >
                      <Icon size={20} />
                      {item.label}
                    </a>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Full-width, square bar docked to the bottom edge. The safe-area
            padding sits inside it so the bar's background also fills the
            home-indicator strip on notched phones. */}
        <div
          className="relative overflow-hidden border-t border-white/10 bg-gradient-to-br from-sidebar-from/95 to-sidebar-to/95 px-1.5 pt-1.5 backdrop-blur-xl"
          style={{ paddingBottom: "calc(0.375rem + env(safe-area-inset-bottom))" }}
        >
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/10 to-transparent" />

          {/* This inner element has no padding of its own, so it shares the exact
              same box as its flex children — the sliding indicator's percentage
              math below then lines up with every tab regardless of item count. */}
          <div className="relative mx-auto flex max-w-md items-stretch justify-between">
            {/* Sliding active indicator — frosted glass pill with a liquid,
                slightly overshooting slide as it moves between tabs. */}
            <div
              aria-hidden
              className="ease-liquid absolute inset-y-0 rounded-2xl border border-white/50 bg-white/80 shadow-[0_2px_10px_rgba(0,0,0,0.25),inset_0_1px_0_0_rgba(255,255,255,0.6)] backdrop-blur-md transition-all duration-500"
              style={{
                width: `${100 / n}%`,
                left: `${(activeIndex * 100) / n}%`,
              }}
            />
            {BOTTOM_NAV_ITEMS.map((item, i) => {
              const active = i === activeIndex;
              const Icon = item.icon;
              return (
                // Plain <a>, not next/link: this forces a full navigation
                // instead of Next's client-side RSC transition, which is what
                // lets the service worker reliably serve the cached offline
                // shell for these routes when there's no network.
                <a key={item.href} href={item.href} className={itemClass}>
                  <Icon
                    size={19}
                    strokeWidth={active ? 2.4 : 2}
                    className={active ? "animate-nav-pop text-brand-600" : "text-white/70"}
                  />
                  <span className={active ? "text-brand-600" : "text-white/70"}>{item.label}</span>
                </a>
              );
            })}
            <button
              type="button"
              onClick={() => setMoreOpen((o) => !o)}
              aria-expanded={moreOpen}
              aria-controls="more-menu"
              className={itemClass}
            >
              <MoreHorizontal
                size={19}
                strokeWidth={inMore ? 2.4 : 2}
                className={inMore ? "animate-nav-pop text-brand-600" : "text-white/70"}
              />
              <span className={inMore ? "text-brand-600" : "text-white/70"}>More</span>
            </button>
          </div>
        </div>
      </nav>
    </>
  );
}
