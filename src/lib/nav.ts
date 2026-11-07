import type { LucideIcon } from "lucide-react";
import { LayoutDashboard, Briefcase, Calendar, ListChecks, Gavel, FileEdit, Settings } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/cases", label: "Cases", icon: Briefcase },
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/cause-list", label: "Cause List", icon: ListChecks },
  { href: "/major-acts", label: "Major Acts", icon: Gavel },
  { href: "/drafts", label: "Drafts", icon: FileEdit },
];

// Phone bottom bar: the daily destinations, plus "More" for the rest.
// The desktop sidebar still lists everything in NAV_ITEMS.
const MORE_HREFS = ["/major-acts", "/drafts"];
export const BOTTOM_NAV_ITEMS: NavItem[] = NAV_ITEMS.filter((item) => !MORE_HREFS.includes(item.href));
export const MORE_NAV_ITEMS: NavItem[] = [
  ...NAV_ITEMS.filter((item) => MORE_HREFS.includes(item.href)),
  { href: "/settings", label: "Settings", icon: Settings },
];
