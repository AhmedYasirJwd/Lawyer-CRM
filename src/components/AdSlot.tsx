import type { ReactNode } from "react";

// Reserved banner space for ads. Sized to the standard IAB units ad networks
// serve — 320×100 "large mobile banner" on phones, 728×90 "leaderboard" from
// sm up — so a real ad can be dropped in as `children` later without the
// page shifting around it. Until then it shows a quiet placeholder.
export function AdSlot({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return (
    <div
      className={`mx-auto flex h-[100px] w-full max-w-[320px] items-center justify-center overflow-hidden rounded-xl sm:h-[90px] sm:max-w-[728px] ${
        children ? "" : "border border-dashed border-line bg-surface/70 backdrop-blur-sm"
      } ${className}`}
    >
      {children ?? <span className="text-[11px] font-medium uppercase tracking-wider text-faint">Advertisement</span>}
    </div>
  );
}
