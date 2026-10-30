"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as offlineDb from "@/lib/offline-db";
import type { OutboxEntity } from "@/lib/offline-db";
import { reconcileWithPending } from "@/lib/sync";
import type { LegalCase, Hearing, Task, CaseDocument } from "@/lib/types";

const STORE_ENTITY: Record<"cases" | "hearings" | "tasks", OutboxEntity> = {
  cases: "case",
  hearings: "hearing",
  tasks: "task",
};

interface CollectionState<T> {
  data: T[];
  loading: boolean;
  isOffline: boolean;
  syncedAt: number | undefined;
}

/**
 * Loads a full collection (cases / hearings / tasks) IndexedDB-first, then
 * revalidates from the network when online. Matches the flow from the spec:
 * online → API → IndexedDB → UI; offline → IndexedDB → UI.
 */
export function useOfflineCollection<T extends { id: string }>(
  store: "cases" | "hearings" | "tasks",
  apiUrl: string
): CollectionState<T> & { refresh: () => void; setData: (updater: (prev: T[]) => T[]) => void } {
  const [state, setState] = useState<CollectionState<T>>({
    data: [],
    loading: true,
    isOffline: false,
    syncedAt: undefined,
  });
  const mounted = useRef(true);

  // Cheap, local-only re-read — no network involved. Used to pick up a save
  // or an outbox sync the instant it happens on-device, instead of waiting
  // for the next mount or network refresh to notice.
  const loadLocal = useCallback(async () => {
    const [cached, syncedAt] = await Promise.all([
      offlineDb.getAll<T>(store),
      offlineDb.getSyncedAt(store),
    ]);
    if (mounted.current) {
      setState((s) => ({ ...s, data: cached, syncedAt, loading: false }));
    }
  }, [store]);

  const load = useCallback(async () => {
    const [cached, syncedAt] = await Promise.all([
      offlineDb.getAll<T>(store),
      offlineDb.getSyncedAt(store),
    ]);
    if (mounted.current && cached.length > 0) {
      setState((s) => ({ ...s, data: cached, syncedAt, loading: false }));
    }

    if (!navigator.onLine) {
      if (mounted.current) setState((s) => ({ ...s, loading: false, isOffline: true }));
      return;
    }

    try {
      const res = await fetch(apiUrl, { cache: "no-store" });
      if (!res.ok) throw new Error(`${res.status}`);
      let fresh: T[] = await res.json();
      // Any of the three collections can have on-device writes the server
      // hasn't seen yet (still queued in the outbox) — never let a
      // background refresh make those disappear just because they're not
      // in the server's response yet. Mobile storage stays the source of
      // truth for anything still pending; the cloud is the secondary copy.
      fresh = await reconcileWithPending(STORE_ENTITY[store], fresh as unknown as { id: string }[]) as unknown as T[];
      await offlineDb.replaceAll(store, fresh);
      if (mounted.current) {
        setState({ data: fresh, loading: false, isOffline: false, syncedAt: Date.now() });
      }
    } catch {
      // Network blip / offline mid-request — keep whatever we already had
      // from IndexedDB (already set above) and just flag it as stale.
      if (mounted.current) setState((s) => ({ ...s, loading: false, isOffline: true }));
    }
  }, [store, apiUrl]);

  useEffect(() => {
    mounted.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loads from IndexedDB/network on mount
    load();
    const onReconnect = () => load();
    // A save, or the outbox draining, both write straight to IndexedDB —
    // reflect that immediately rather than only on the next mount/fetch.
    const onLocalChange = () => loadLocal();
    window.addEventListener("online", onReconnect);
    window.addEventListener(`lexcase:${store}-changed`, onLocalChange);
    return () => {
      mounted.current = false;
      window.removeEventListener("online", onReconnect);
      window.removeEventListener(`lexcase:${store}-changed`, onLocalChange);
    };
  }, [load, loadLocal, store]);

  return {
    ...state,
    refresh: load,
    setData: (updater) => setState((s) => ({ ...s, data: updater(s.data) })),
  };
}

interface CaseDetailState {
  legalCase: LegalCase | undefined;
  hearings: Hearing[];
  tasks: Task[];
  documents: CaseDocument[];
  loading: boolean;
  isOffline: boolean;
  notCached: boolean;
  syncedAt: number | undefined;
}

/**
 * Loads one case's full detail bundle (case + its hearings/tasks/documents).
 * If this exact case was never opened while online, `notCached` is true so
 * the page can say so plainly instead of pretending the case doesn't exist.
 */
export function useOfflineCaseDetail(caseId: string): CaseDetailState & { refresh: () => void } {
  const [state, setState] = useState<CaseDetailState>({
    legalCase: undefined,
    hearings: [],
    tasks: [],
    documents: [],
    loading: true,
    isOffline: false,
    notCached: false,
    syncedAt: undefined,
  });
  const mounted = useRef(true);

  const load = useCallback(async () => {
    const [cachedCase, cachedHearings, cachedTasks, cachedDocs, syncedAt] = await Promise.all([
      offlineDb.getOne<LegalCase>("cases", caseId),
      offlineDb.getManyByIndex<Hearing & Record<string, unknown>>("hearings", "caseId", caseId),
      offlineDb.getManyByIndex<Task & Record<string, unknown>>("tasks", "caseId", caseId),
      offlineDb.getManyByIndex<CaseDocument & Record<string, unknown>>("documents", "caseId", caseId),
      offlineDb.getSyncedAt("cases"),
    ]);
    if (mounted.current) {
      setState((s) => ({
        ...s,
        legalCase: cachedCase,
        hearings: cachedHearings as Hearing[],
        tasks: cachedTasks as Task[],
        documents: cachedDocs as CaseDocument[],
        syncedAt,
        loading: false,
        notCached: !cachedCase,
      }));
    }

    if (!navigator.onLine) {
      if (mounted.current) setState((s) => ({ ...s, isOffline: true }));
      return;
    }

    try {
      const [caseRes, hearingsRes, tasksRes, docsRes] = await Promise.all([
        fetch(`/api/cases/${caseId}`, { cache: "no-store" }),
        fetch("/api/hearings", { cache: "no-store" }),
        fetch("/api/tasks", { cache: "no-store" }),
        fetch(`/api/cases/${caseId}/documents`, { cache: "no-store" }),
      ]);
      if (!caseRes.ok) throw new Error("not found");
      const freshCase: LegalCase = await caseRes.json();
      let allHearings: Hearing[] = hearingsRes.ok ? await hearingsRes.json() : [];
      let allTasks: Task[] = tasksRes.ok ? await tasksRes.json() : [];
      // Same reasoning as useOfflineCollection: don't let a hearing/task
      // that was just created or edited offline (still queued) vanish
      // because this fetch raced ahead of the outbox drain.
      allHearings = await reconcileWithPending("hearing", allHearings);
      allTasks = await reconcileWithPending("task", allTasks);
      const freshDocs: CaseDocument[] = docsRes.ok ? await docsRes.json() : [];
      const caseHearings = allHearings.filter((h) => h.caseId === caseId);
      const caseTasks = allTasks.filter((t) => t.caseId === caseId);

      await Promise.all([
        offlineDb.put("cases", freshCase),
        offlineDb.replaceAll("hearings", allHearings),
        offlineDb.replaceAll("tasks", allTasks),
        offlineDb.replaceForKey("documents", "caseId", caseId, freshDocs),
      ]);

      if (mounted.current) {
        setState({
          legalCase: freshCase,
          hearings: caseHearings,
          tasks: caseTasks,
          documents: freshDocs,
          loading: false,
          isOffline: false,
          notCached: false,
          syncedAt: Date.now(),
        });
      }
    } catch {
      if (mounted.current) setState((s) => ({ ...s, isOffline: true, loading: false }));
    }
  }, [caseId]);

  useEffect(() => {
    mounted.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loads from IndexedDB/network on mount
    load();
    const onReconnect = () => load();
    // If a background outbox sync updates this exact case while its detail
    // page is open (e.g. it finally reaches the server a minute after the
    // person moved on and back), pick that up from IndexedDB immediately
    // instead of showing stale data until the next navigation.
    const onCaseChange = async () => {
      const local = await offlineDb.getOne<LegalCase>("cases", caseId);
      if (mounted.current && local) setState((s) => ({ ...s, legalCase: local }));
    };
    // A hearing or task saved offline (or synced by the outbox) writes
    // straight to IndexedDB too — reflect that immediately rather than
    // waiting for the next mount/network refresh to notice.
    const onHearingsChange = async () => {
      const local = await offlineDb.getManyByIndex<Hearing & Record<string, unknown>>(
        "hearings",
        "caseId",
        caseId
      );
      if (mounted.current) setState((s) => ({ ...s, hearings: local as Hearing[] }));
    };
    const onTasksChange = async () => {
      const local = await offlineDb.getManyByIndex<Task & Record<string, unknown>>("tasks", "caseId", caseId);
      if (mounted.current) setState((s) => ({ ...s, tasks: local as Task[] }));
    };
    window.addEventListener("online", onReconnect);
    window.addEventListener("lexcase:cases-changed", onCaseChange);
    window.addEventListener("lexcase:hearings-changed", onHearingsChange);
    window.addEventListener("lexcase:tasks-changed", onTasksChange);
    return () => {
      mounted.current = false;
      window.removeEventListener("online", onReconnect);
      window.removeEventListener("lexcase:cases-changed", onCaseChange);
      window.removeEventListener("lexcase:hearings-changed", onHearingsChange);
      window.removeEventListener("lexcase:tasks-changed", onTasksChange);
    };
  }, [load, caseId]);

  return { ...state, refresh: load };
}

interface RecordState<T> {
  data: T | undefined;
  loading: boolean;
}

/**
 * Loads one record (a single hearing or task) IndexedDB-first, for pages
 * that only need one item rather than a whole collection — e.g. the task
 * edit form. Kept in sync with local writes/outbox syncs the same way
 * useOfflineCollection is.
 */
export function useOfflineRecord<T extends { id: string }>(
  store: "hearings" | "tasks",
  id: string
): RecordState<T> & { refresh: () => void } {
  const [state, setState] = useState<RecordState<T>>({ data: undefined, loading: true });
  const mounted = useRef(true);

  const load = useCallback(async () => {
    const local = await offlineDb.getOne<T>(store, id);
    if (mounted.current) setState({ data: local, loading: false });
  }, [store, id]);

  useEffect(() => {
    mounted.current = true;
    load();
    const onChange = () => load();
    window.addEventListener(`lexcase:${store}-changed`, onChange);
    return () => {
      mounted.current = false;
      window.removeEventListener(`lexcase:${store}-changed`, onChange);
    };
  }, [load, store]);

  return { ...state, refresh: load };
}
