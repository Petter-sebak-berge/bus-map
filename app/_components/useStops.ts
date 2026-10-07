"use client";
// Two hooks about stops: one fetches every stop in the area, the other the departure board of the
// stop the visitor has clicked.

import { useEffect, useState } from "react";
import type { AreaId } from "@/lib/areas";
import type { Board, StopPlace } from "@/lib/stops";

// Every stop in the area. There are a couple of thousand, so they are fetched only once they are
// wanted: the map says so when the visitor has zoomed in far enough to see them.
export function useStopPlaces(areaId: AreaId, wanted: boolean) {
  const [stops, setStops] = useState<StopPlace[] | null>(null);

  useEffect(() => {
    if (!wanted) return;
    let current = true; // false once this effect has been cleaned up, so a late answer is ignored
    fetch(`/api/stops?area=${areaId}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((list) => {
        if (current && list) setStops(list);
      })
      .catch(() => {}); // without stops the map still shows the vehicles
    return () => {
      current = false;
    };
  }, [areaId, wanted]);

  return stops;
}

const REFRESH_MS = 20_000;

// "loading" until the first answer, "none" if the board could not be fetched.
export type BoardState = Board | "loading" | "none";

// The departure board for one stop, fetched again every 20 seconds while it is shown.
export function useDepartures(stopId: string): BoardState {
  // Kept together with the stop it belongs to, so an old board is never shown for a new stop.
  const [fetched, setFetched] = useState<{ id: string; board: Board | "none" } | null>(null);

  useEffect(() => {
    // Lets us cancel a request that is still on its way when the visitor clicks another stop.
    const controller = new AbortController();

    async function load() {
      try {
        const response = await fetch(`/api/departures?id=${encodeURIComponent(stopId)}`, {
          signal: controller.signal,
        });
        setFetched({ id: stopId, board: response.ok ? await response.json() : "none" });
      } catch {
        // Cancelled, or the network failed: keep what is shown and try again next round.
      }
    }

    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [stopId]);

  return fetched?.id === stopId ? fetched.board : "loading";
}
