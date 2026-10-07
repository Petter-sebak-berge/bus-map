"use client";
// Fetches the road and the stops for the trip of the vehicle the visitor has clicked, and fetches
// them again every 30 seconds so the expected times stay fresh. Like useVehicles, it is a hook:
// the map says which trip it wants and gets the answer back.

import { useEffect, useState } from "react";
import type { Journey } from "@/lib/journey";

const REFRESH_MS = 30_000;

// "loading" until the first answer, "none" when there is no route to show.
export type JourneyState = Journey | "loading" | "none";

// A real trip id. Buses driving to or from the garage carry another kind of id that the journey
// planner doesn't know, so we don't ask about those.
const isTripId = (id: string | null): id is string => !!id && id.includes(":ServiceJourney:");

export function useJourney(journeyId: string | null): JourneyState {
  // What we last fetched, kept together with the id it belongs to. When the visitor clicks another
  // vehicle, the old answer no longer matches and is not shown.
  const [fetched, setFetched] = useState<{ id: string; journey: Journey | "none" } | null>(null);

  useEffect(() => {
    if (!isTripId(journeyId)) return;

    // An AbortController lets us cancel a request that is still on its way when the visitor
    // clicks another vehicle, so a late answer can't overwrite the newer one.
    const controller = new AbortController();

    async function load() {
      try {
        const response = await fetch(`/api/journey?id=${encodeURIComponent(journeyId!)}`, {
          signal: controller.signal,
        });
        setFetched({ id: journeyId!, journey: response.ok ? await response.json() : "none" });
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
  }, [journeyId]);

  if (!isTripId(journeyId)) return "none";
  return fetched?.id === journeyId ? fetched.journey : "loading";
}
