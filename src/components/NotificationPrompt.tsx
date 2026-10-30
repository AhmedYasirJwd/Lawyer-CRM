"use client";

import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { getNotificationPermission, isSubscribed, subscribeToPush } from "@/lib/push-client";

const DISMISS_KEY = "lexcase-notification-prompt-dismissed";

export function NotificationPrompt() {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const permission = getNotificationPermission();
      if (permission !== "default") return; // unsupported, already granted, or already denied
      if (localStorage.getItem(DISMISS_KEY)) return;
      if (await isSubscribed()) return;
      setVisible(true);
    })();
  }, []);

  async function handleEnable() {
    setBusy(true);
    const result = await subscribeToPush();
    setBusy(false);
    if (result.ok) setVisible(false);
  }

  function handleDismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-x-4 bottom-20 z-40 mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-line bg-surface p-3.5 shadow-xl lg:bottom-6 lg:left-6 lg:right-auto lg:mx-0">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
        <Bell size={18} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink">Turn on reminders</p>
        <p className="text-xs text-muted">Get notified before hearings and task deadlines.</p>
      </div>
      <button
        type="button"
        onClick={handleEnable}
        disabled={busy}
        className="shrink-0 rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-white hover:bg-ink/90 disabled:opacity-60"
      >
        {busy ? "Enabling…" : "Enable"}
      </button>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-faint hover:bg-background"
      >
        <X size={15} />
      </button>
    </div>
  );
}
