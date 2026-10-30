"use client";

import { createContext, useContext, useEffect, useSyncExternalStore, type ReactNode } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "lexcase-theme";

const THEME_EVENT = "lexcase:theme-changed";

function readTheme(): Theme {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

function subscribe(onChange: () => void) {
  // "storage" keeps other open tabs in step; the custom event covers this tab.
  window.addEventListener("storage", onChange);
  window.addEventListener(THEME_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(THEME_EVENT, onChange);
  };
}

const ThemeContext = createContext<{ theme: Theme; setTheme: (theme: Theme) => void } | null>(null);

// App-wide light/dark preference (see globals.css for the ":root.dark"
// palette every component's colors resolve through). Persisted to
// localStorage (not Supabase) since it's a per-device display preference,
// not case data.
export function ThemeProvider({ children }: { children: ReactNode }) {
  // Server render and hydration always see "light"; the stored preference
  // takes over right after without a hydration mismatch.
  const theme = useSyncExternalStore(subscribe, readTheme, () => "light" as Theme);

  // Toggling a class on <html> (rather than passing isDark down as a prop)
  // is what lets every page's CSS — not just the dashboard's — resolve
  // through the dark palette. The theme-color meta tag is updated here too
  // since it drives the browser/PWA chrome color and can't itself respond
  // to a class or media query.
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    const meta = document.querySelector('meta[name="theme-color"]');
    meta?.setAttribute("content", theme === "dark" ? "#131214" : "#1e40af");
  }, [theme]);

  function setTheme(next: Theme) {
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage blocked (private mode) — the toggle just won't persist.
    }
    window.dispatchEvent(new Event(THEME_EVENT));
  }

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
