"use client";

import { useEffect } from "react";

// Registers the service worker so the app is installable (Add to Home
// Screen / desktop install prompt). Runs once on mount, silently no-ops in
// browsers without support, and never blocks rendering.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      // The service worker cache-firsts _next/static/ assets, which is only
      // safe in production where those filenames are truly immutable. In
      // dev, Turbopack recompiles the same page's assets on every save, so
      // a SW registered from an earlier session keeps serving old JS/CSS
      // forever, silently undoing every code change while the fresh HTML
      // from the dev server looks like it should've picked them up. Tear
      // down any leftover registration/caches so dev always runs current
      // code.
      navigator.serviceWorker.getRegistrations().then((regs) => {
        for (const reg of regs) reg.unregister();
      });
      if ("caches" in window) {
        caches.keys().then((keys) => keys.forEach((key) => caches.delete(key)));
      }
      return;
    }

    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.error("Service worker registration failed:", err);
    });
  }, []);

  return null;
}
