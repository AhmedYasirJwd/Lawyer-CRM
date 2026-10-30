"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export interface CurrentUser {
  name: string;
  email: string;
}

const FALLBACK: CurrentUser = { name: "there", email: "" };
const CACHE_KEY = "lexcase-current-user";

function readCache(): CurrentUser {
  if (typeof window === "undefined") return FALLBACK;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : FALLBACK;
  } catch {
    return FALLBACK;
  }
}

function writeCache(user: CurrentUser) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(user));
  } catch {
    // Non-fatal — the name just won't be cached for the next offline launch.
  }
}

/** The signed-in user's display name (from the "Full Name" they gave at
 *  sign-up) and email. Reads a cached copy synchronously first — so there's
 *  no flash of a placeholder, and it still works offline — then refreshes
 *  from the local Supabase session (getSession() reads local storage, not
 *  the network, so this works offline too). */
export function useCurrentUser(): CurrentUser {
  const [user, setUser] = useState<CurrentUser>(FALLBACK);

  useEffect(() => {
    let cancelled = false;
    const cached = readCache();
    if (cached.name !== FALLBACK.name || cached.email !== FALLBACK.email) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- cache lives in localStorage, which only exists after hydration
      setUser(cached);
    }
    (async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data } = await supabase.auth.getSession();
        const authUser = data.session?.user;
        if (!authUser || cancelled) return;
        const rawName = (authUser.user_metadata?.full_name as string | undefined)?.trim();
        const name = rawName || authUser.email?.split("@")[0] || "there";
        const next: CurrentUser = { name, email: authUser.email ?? "" };
        setUser(next);
        writeCache(next);
      } catch {
        // Stay on whatever the cache (or fallback) already provided.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return user;
}
