import type { LucideIcon } from "lucide-react";

const TONE_CLASSES: Record<string, string> = {
  green: "bg-success-100 text-success-700",
  success: "bg-success-100 text-success-700",
  blue: "bg-blue-50 text-blue-600",
  amber: "bg-amber-50 text-amber-600",
  purple: "bg-purple-50 text-purple-600",
  red: "bg-red-50 text-red-600",
};

export function StatCard({
  icon: Icon,
  value,
  label,
  tone = "green",
  href,
}: {
  icon: LucideIcon;
  value: number | string;
  label: string;
  tone?: "green" | "success" | "blue" | "amber" | "purple" | "red";
  href?: string;
}) {
  const content = (
    <div className={`card flex items-center gap-2 p-2.5 sm:gap-2.5 sm:p-3 ${href ? "transition-colors hover:bg-background" : ""}`}>
      {/* Icon drops on phones so three cards fit on one row. */}
      <div className={`hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg sm:flex ${TONE_CLASSES[tone]}`}>
        <Icon size={15} />
      </div>
      <div className="min-w-0">
        <div className="text-lg font-bold text-ink leading-none">{value}</div>
        <div className="mt-1 truncate text-xs font-medium text-muted">{label}</div>
      </div>
    </div>
  );

  if (href) {
    return <a href={href}>{content}</a>;
  }
  return content;
}
