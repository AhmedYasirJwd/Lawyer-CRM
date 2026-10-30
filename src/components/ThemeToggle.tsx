"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/theme-context";

// Lets the user pick a light or dark look for the whole app — including
// which of the two dashboard skyline backgrounds they see, the pale daytime
// illustration or the navy night skyline. Preference is saved on this
// device (see theme-context.tsx).
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="card mt-4 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
            {theme === "dark" ? <Moon size={18} /> : <Sun size={18} />}
          </div>
          <div>
            <h2 className="text-sm font-semibold text-ink">Appearance</h2>
            <p className="mt-0.5 text-sm text-muted">Choose a light or dark look for the app.</p>
          </div>
        </div>

        <div
          role="radiogroup"
          aria-label="Dashboard appearance"
          className="flex shrink-0 items-center gap-1 rounded-xl border border-line bg-background p-1"
        >
          <button
            type="button"
            role="radio"
            aria-checked={theme === "light"}
            onClick={() => setTheme("light")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              theme === "light" ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"
            }`}
          >
            <Sun size={14} />
            Light
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={theme === "dark"}
            onClick={() => setTheme("dark")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              theme === "dark" ? "bg-ink text-white shadow-sm" : "text-muted hover:text-ink"
            }`}
          >
            <Moon size={14} />
            Dark
          </button>
        </div>
      </div>
    </div>
  );
}
