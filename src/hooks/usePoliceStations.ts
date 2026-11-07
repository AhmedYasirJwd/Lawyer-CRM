"use client";

import { useEffect, useState } from "react";

export interface PoliceStationOption {
  code: string;
  name: string;
}

/** A district's police stations from the court website, which an FIR search
 *  needs. `stations` is null while loading, and stays null if loading failed. */
export function usePoliceStations(district: string): { stations: PoliceStationOption[] | null; failed: boolean } {
  const [loaded, setLoaded] = useState<{ district: string; stations: PoliceStationOption[] } | null>(null);
  const [failedFor, setFailedFor] = useState<string | null>(null);

  useEffect(() => {
    if (!district) return;
    let cancelled = false;
    fetch(`/api/cfms/police-stations?district=${encodeURIComponent(district)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((body) => {
        if (!cancelled) setLoaded({ district, stations: body.stations });
      })
      .catch(() => {
        if (!cancelled) setFailedFor(district);
      });
    return () => {
      cancelled = true;
    };
  }, [district]);

  return {
    stations: loaded?.district === district ? loaded.stations : null,
    failed: failedFor === district,
  };
}
