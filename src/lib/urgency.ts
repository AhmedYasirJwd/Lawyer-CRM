import type { CSSProperties } from "react";

export function daysUntil(iso: string): number {
  const d = new Date(iso);
  d.setHours(0, 0, 0, 0);
  const n = new Date();
  n.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - n.getTime()) / 86400000);
}

// Distinct hues (degrees) for telling cases apart at a glance — blue,
// violet, teal, rose, amber, indigo, emerald, orange, fuchsia, cyan.
const CASE_HUES = [217, 262, 174, 345, 38, 235, 152, 22, 295, 192];

function hueFor(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return CASE_HUES[h % CASE_HUES.length];
}

/** Per-case color for hearing/case cards: the hue identifies the case
 *  (stable for its id), the depth says how soon — today is the strongest
 *  shade, fading for hearings a month or more away. Returns CSS variables
 *  plus class names; the actual colors live in globals.css (.tone-*) so
 *  light and dark mode can each use their own scale. With no date (no
 *  hearing scheduled) the card stays plain and only the chip carries the hue. */
export function caseTone(caseId: string, iso?: string) {
  const t = iso ? Math.min(Math.max(daysUntil(iso), 0), 30) / 30 : 1; // 0 = today … 1 = 30+ days
  const none = iso ? "" : " tone-none";
  const hue = hueFor(caseId);
  return {
    vars: {
      "--h": hue,
      "--t": t,
      // Light-mode chip: white text on the deep shades, dark text on pale ones.
      "--tone-fg": 30 + t * 50 < 58 ? "#ffffff" : `hsl(${hue} 70% 22%)`,
    } as CSSProperties,
    card: `tone-card${none}`,
    chip: `tone-chip${none}`,
    bar: `tone-bar${none}`,
  };
}

/** The light background every item card gets (the `tint` class in
 *  globals.css). The hue is derived from the key, so each item gets its own
 *  shade automatically — new entries included — and keeps it. Pass the
 *  case id for anything belonging to a case so it matches that case's color. */
export function tint(key: string): CSSProperties {
  return { "--h": hueFor(key) } as CSSProperties;
}
