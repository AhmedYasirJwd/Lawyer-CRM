// Service worker for LexCase.
//
// LexCase is a live-data, authenticated app (Supabase-backed). Most pages
// (Settings, Drafts, Major Acts, Search, Documents upload, ...) stay
// server-rendered and online-only — deliberately not cached here.
//
// These routes have real offline support, backed by IndexedDB in the app
// itself (see src/hooks/useOfflineData.ts) rather than by caching API
// responses in here:
//   Dashboard (/), Cases (/cases), Case Detail (/cases/:id),
//   New Case (/cases/new), Edit Case (/cases/:id/edit),
//   Calendar (/calendar), Tasks (/tasks),
//   Add Hearing — from a case (/cases/:id/hearings/new) and from the
//     calendar (/calendar/new),
//   Edit Hearing (/cases/:id/hearings/:hearingId/edit),
//   Add Task (/tasks/new), Edit Task (/tasks/:id/edit).
// Every one of these is a client component with no server-fetched data of
// its own — the case/hearing/task data comes from IndexedDB at runtime —
// so their HTML/JS shell is safe to replay when the network is
// unreachable. Routes with a dynamic id in the URL (Case Detail, Edit
// Case, Add/Edit Hearing, Edit Task) are cached per-URL the first time
// they're opened online, PLUS a placeholder-id "template" version of each
// is precached at install time and used to build a working shell for any
// id that was never opened online — e.g. a hearing created entirely while
// offline (see buildFromTemplate below).
//
// What this file does NOT do, on purpose:
//   - Cache /api/* responses. Those can contain another user's-eyes-only
//     case data; caching them in the shared Cache Storage is a bigger
//     attack surface than the app's own IndexedDB store, which the app
//     code already guards behind the normal auth check on every request.
//   - Cache documents/PDFs automatically — see the explicit "Download for
//     offline" affordance in the Documents section instead.

const VERSION = "v7";
const STATIC_CACHE = `lexcase-static-${VERSION}`;
const SHELL_CACHE = `lexcase-shell-${VERSION}`;

const PRECACHE_URLS = ["/offline.html", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];

// Routes with no dynamic segment at all — identical shell for every
// request, no template needed, just fetch-and-cache once at install.
const STATIC_SHELL_ROUTES = ["/", "/cases", "/calendar", "/tasks", "/cases/new", "/calendar/new", "/tasks/new"];

// A case created (or a hearing/task created) entirely offline gets a real
// UUID (assigned client-side) that the server has never seen, so there's
// no way to have warmed a cache entry for that exact URL in advance.
// Rather than send a brand-new record straight to offline.html, we keep
// one "template" shell per dynamic route — fetched once for these
// placeholder ids — and stamp the real id(s) into it on the fly (see
// buildFromTemplate). The HTML/JS besides those id strings is identical
// for every case/hearing/task — every one of these routes is a client
// component that reads the actual data out of IndexedDB — so the swap is
// safe and doesn't require a network round-trip.
const ID_PLACEHOLDER_A = "00000000-0000-4000-8000-000000000000";
const ID_PLACEHOLDER_B = "00000000-0000-4000-8000-000000000001";

// Routes with one or two dynamic segments. `match` extracts the real id(s)
// from a live request's pathname (capture groups, in order); `template` is
// the placeholder-id version of that same path, precached at install time;
// `placeholders` lists which placeholder constant corresponds to each
// capture group, in order; `exclude` filters out sibling static routes
// that would otherwise false-match the regex (e.g. "/cases/new" matching
// "/cases/:id").
const DYNAMIC_SHELL_ROUTES = [
  {
    match: /^\/cases\/([^/]+)$/,
    exclude: (m) => m[1] === "new",
    template: `/cases/${ID_PLACEHOLDER_A}`,
    placeholders: [ID_PLACEHOLDER_A],
  },
  {
    match: /^\/cases\/([^/]+)\/edit$/,
    template: `/cases/${ID_PLACEHOLDER_A}/edit`,
    placeholders: [ID_PLACEHOLDER_A],
  },
  {
    match: /^\/cases\/([^/]+)\/hearings\/new$/,
    template: `/cases/${ID_PLACEHOLDER_A}/hearings/new`,
    placeholders: [ID_PLACEHOLDER_A],
  },
  {
    match: /^\/cases\/([^/]+)\/hearings\/([^/]+)\/edit$/,
    template: `/cases/${ID_PLACEHOLDER_A}/hearings/${ID_PLACEHOLDER_B}/edit`,
    placeholders: [ID_PLACEHOLDER_A, ID_PLACEHOLDER_B],
  },
  {
    match: /^\/tasks\/([^/]+)\/edit$/,
    exclude: (m) => m[1] === "new",
    template: `/tasks/${ID_PLACEHOLDER_B}/edit`,
    placeholders: [ID_PLACEHOLDER_B],
  },
];

function matchDynamicRoute(pathname) {
  for (const route of DYNAMIC_SHELL_ROUTES) {
    const m = route.match.exec(pathname);
    if (m && !(route.exclude && route.exclude(m))) return { route, m };
  }
  return null;
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const staticCache = await caches.open(STATIC_CACHE);
      await staticCache.addAll(PRECACHE_URLS);

      // These routes' HTML/JS shell doesn't depend on any specific
      // case/hearing/task's data, so — unlike the per-id cache entries
      // below — there's no reason to wait for a first online visit before
      // they work offline. Warm them, and the id-template shells, now.
      const shellCache = await caches.open(SHELL_CACHE);
      const templatePaths = DYNAMIC_SHELL_ROUTES.map((r) => r.template);
      await Promise.all(
        [...STATIC_SHELL_ROUTES, ...templatePaths].map(async (path) => {
          try {
            const response = await fetch(path);
            if (response.ok) await shellCache.put(path, response);
          } catch {
            // No network at install time — these'll get cached on the
            // first real online visit instead, same as before.
          }
        })
      );

      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  // "lexcase-documents-v1" is deliberately NOT in this set — it holds
  // documents the user explicitly chose to save offline, and should persist
  // across deploys/versions until they remove it themselves.
  const keep = new Set([STATIC_CACHE, SHELL_CACHE, "lexcase-documents-v1"]);
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !keep.has(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isImmutableBuildAsset(url) {
  return url.origin === self.location.origin && url.pathname.startsWith("/_next/static/");
}

function isBrandAsset(url) {
  return (
    url.origin === self.location.origin &&
    (url.pathname.startsWith("/icons/") || url.pathname === "/manifest.webmanifest")
  );
}

// The offline-enabled routes. Matched on pathname only (query strings,
// e.g. /cases?status=Active or /tasks/new?caseId=..., still match).
function isOfflineShellRoute(pathname) {
  if (STATIC_SHELL_ROUTES.includes(pathname)) return true;
  return Boolean(matchDynamicRoute(pathname));
}

// Clones a cached template response and replaces every occurrence of the
// placeholder id(s) with the real one(s) being requested, so a case,
// hearing, or task that was only ever created offline still gets a working
// shell instead of offline.html. Returns null if no template has been
// cached yet (e.g. the service worker was installed while offline).
async function buildFromTemplate(shellCache, templatePath, replacements) {
  const template = await shellCache.match(templatePath);
  if (!template) return null;
  let text = await template.text();
  for (const [placeholder, real] of replacements) {
    text = text.split(placeholder).join(real);
  }
  return new Response(text, {
    status: template.status,
    statusText: template.statusText,
    headers: template.headers,
  });
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Next's hashed build assets and the app's own icons/manifest: cache-first,
  // they're either content-hashed or effectively static between deploys.
  if (isImmutableBuildAsset(url) || isBrandAsset(url)) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      })
    );
    return;
  }

  // Explicitly-saved documents (see src/lib/document-offline-cache.ts): try
  // the network for the freshest copy, fall back to the saved offline copy
  // only if the network is unreachable. Nothing here is auto-cached — only
  // documents the user tapped "Save for offline" on ever end up in this
  // cache in the first place.
  if (url.origin === self.location.origin && /^\/api\/documents\/[^/]+$/.test(url.pathname)) {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open("lexcase-documents-v1");
        const cached = await cache.match(request);
        return cached || Response.error();
      })
    );
    return;
  }

  if (request.mode === "navigate" && url.origin === self.location.origin) {
    // Offline-enabled routes: network-first, cache the shell on success.
    // Dynamic routes are cached per-URL (not collapsed to one shared key)
    // — even though these are client components, Next still bakes the
    // request's resolved route params into the initial HTML/flight
    // payload it serves, so reusing one entry for every id would replay a
    // stale record's data under a different id's URL.
    if (isOfflineShellRoute(url.pathname)) {
      const cacheKey = url.pathname;
      event.respondWith(
        (async () => {
          const cache = await caches.open(SHELL_CACHE);
          try {
            const response = await fetch(request);
            if (response.ok) cache.put(cacheKey, response.clone());
            return response;
          } catch {
            const cached = await cache.match(cacheKey);
            if (cached) return cached;

            // No exact-URL cache entry — this id (case, hearing, or task)
            // was never opened while online. Stamp it into the matching
            // template shell instead of giving up, so a record created
            // offline opens directly rather than bouncing through
            // offline.html.
            const dynamic = matchDynamicRoute(url.pathname);
            if (dynamic) {
              const { route, m } = dynamic;
              const replacements = route.placeholders.map((placeholder, i) => [placeholder, m[i + 1]]);
              const built = await buildFromTemplate(cache, route.template, replacements);
              if (built) {
                cache.put(cacheKey, built.clone());
                return built;
              }
            }

            return caches.match("/offline.html");
          }
        })()
      );
      return;
    }

    // Every other page (Settings, Drafts, Major Acts, Documents upload,
    // auth, ...): online-only. Try the network; if it's unreachable, show
    // the offline page rather than the browser's generic "No Internet"
    // screen.
    event.respondWith(fetch(request).catch(() => caches.match("/offline.html")));
    return;
  }

  // Everything else — API calls, documents, PDFs, fonts, RSC data requests
  // for non-shell routes, etc. — untouched, straight to the network.
});

// ------------------------------------------------------------ push notifications --
// Deadline/hearing reminders sent by the notifications cron (see
// src/app/api/cron/notifications). The payload is small JSON set by the
// server when it calls webpush.sendNotification(...).
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "LexCase", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "LexCase";
  const options = {
    body: data.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: data.tag,
    // Renotify so a later reminder with the same tag (e.g. the 1-hour
    // follow-up to a 24-hour hearing reminder) still alerts the user
    // instead of silently replacing the old one unseen.
    renotify: Boolean(data.tag),
    data: { url: data.url || "/" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data && event.notification.data.url ? event.notification.data.url : "/";

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of clientList) {
        if (client.url.includes(url) && "focus" in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })()
  );
});
