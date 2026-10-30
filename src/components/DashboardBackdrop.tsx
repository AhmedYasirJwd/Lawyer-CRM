"use client";

import Image from "next/image";
import { useTheme } from "@/lib/theme-context";

// Karachi-skyline illustration behind the dashboard greeting. Its height
// matches the greeting block exactly (h-28 / sm:h-32 in DashboardClient) so
// the ad slot below starts where the image ends instead of covering it. Sized per
// breakpoint so the skyline itself (not just sky) stays in frame on both a
// narrow phone and a wide desktop viewport, then fades into the page
// background at the bottom so it blends in instead of cutting off hard.
// Swaps to the night skyline when the app's dark-mode preference (see
// theme-context.tsx) is on; the fade itself just targets bg-background,
// which already resolves to the dark palette app-wide in that case.
export function DashboardBackdrop() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-28 overflow-hidden rounded-b-[1.75rem] bg-background sm:h-32 sm:rounded-b-[2rem]"
    >
      <Image
        src={isDark ? "/images/dashboard-skyline-dark.webp" : "/images/dashboard-skyline.webp"}
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover object-[center_top] opacity-90"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background" />
    </div>
  );
}
