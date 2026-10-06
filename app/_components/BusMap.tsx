"use client";
// The map. It runs in the visitor's browser (hence "use client"), because a map is drawn and moved
// around there. It does three things:
//   1. draws the map, once
//   2. asks our own /api/vehicles for positions every ten seconds
//   3. hands the newest positions to the map, which draws one dot per vehicle
//
// The drawing is done by MapLibre, an open-source map library. The background map comes from
// OpenFreeMap, a free service built on OpenStreetMap data that needs no account or key.

import { useEffect, useRef, useState, type ReactNode } from "react";
import maplibregl, { type GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { FeatureCollection, Point } from "geojson";
import { areas, type AreaId } from "@/lib/areas";
import type { Dictionary } from "@/lib/dictionaries";
import { delayStatus, statusColors, type DelayStatus, type Vehicle } from "@/lib/vehicles";

const MAP_STYLE = "https://tiles.openfreemap.org/styles/dark";
const REFRESH_MS = 10_000;

// Maps don't take a plain list; they take GeoJSON, the standard format for "things with a place".
// Each vehicle becomes a "feature": a point, plus the properties the map uses to colour and label it.
// Note the order: GeoJSON writes longitude first, then latitude.
function toGeoJson(vehicles: Vehicle[]): FeatureCollection<Point> {
  return {
    type: "FeatureCollection",
    features: vehicles.map((vehicle) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [vehicle.lon, vehicle.lat] },
      properties: { id: vehicle.id, line: vehicle.line, status: delayStatus(vehicle.delay) },
    })),
  };
}

type Props = {
  areaId: AreaId;
  text: Dictionary["map"];
  children: ReactNode; // the title and language link, written by the page
};

export default function BusMap({ areaId, text, children }: Props) {
  const area = areas[areaId];
  // A "ref" holds on to something between redraws without causing one: the <div> the map is drawn
  // in, and the map itself.
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  // "State" is what the component remembers and redraws for when it changes.
  const [mapReady, setMapReady] = useState(false);
  const [vehicles, setVehicles] = useState<Vehicle[] | null>(null); // null = nothing fetched yet
  const [failed, setFailed] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // 1. Draw the map. useEffect runs after the page is shown, and only in the browser.
  useEffect(() => {
    const map = new maplibregl.Map({
      container: container.current!,
      style: MAP_STYLE,
      center: [area.center.lon, area.center.lat],
      zoom: area.zoom,
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");

    map.on("load", () => {
      // A "source" is the data, a "layer" is one way of drawing it. One source, two layers:
      // the coloured dots, and the line number on top of each.
      map.addSource("vehicles", { type: "geojson", data: toGeoJson([]) });
      map.addLayer({
        id: "vehicle-dots",
        type: "circle",
        source: "vehicles",
        paint: {
          // Dots grow as you zoom in: 3 pixels at zoom 9, 10 at zoom 13, 14 at zoom 16.
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 9, 3, 13, 10, 16, 14],
          // Picks the colour from each vehicle's `status` property; the last one is the default.
          "circle-color": [
            "match",
            ["get", "status"],
            "early", statusColors.early,
            "late", statusColors.late,
            "veryLate", statusColors.veryLate,
            "unknown", statusColors.unknown,
            statusColors.onTime,
          ],
          "circle-stroke-width": 1.5,
          "circle-stroke-color": "#0a100e",
        },
      });
      map.addLayer({
        id: "vehicle-labels",
        type: "symbol",
        source: "vehicles",
        minzoom: 12.5, // zoomed further out, the dots are too small to hold a number
        layout: {
          "text-field": ["get", "line"],
          "text-font": ["Noto Sans Regular"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 12.5, 9, 16, 13],
          "text-allow-overlap": true,
        },
        paint: { "text-color": "#0a100e" },
      });
      setMapReady(true);
    });

    // A click on a dot selects that vehicle; a click anywhere else clears the selection.
    map.on("click", (event) => {
      const [hit] = map.queryRenderedFeatures(event.point, { layers: ["vehicle-dots"] });
      setSelectedId(hit ? (hit.properties.id as string) : null);
    });
    map.on("mouseenter", "vehicle-dots", () => (map.getCanvas().style.cursor = "pointer"));
    map.on("mouseleave", "vehicle-dots", () => (map.getCanvas().style.cursor = ""));

    // The function an effect returns is its clean-up: it runs when the component goes away.
    return () => map.remove();
  }, [area]);

  // 2. Fetch positions now and then every ten seconds, but only while the tab is visible:
  //    a map nobody is looking at shouldn't keep asking.
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;

    async function refresh() {
      try {
        const response = await fetch(`/api/vehicles?area=${areaId}`);
        if (!response.ok) throw new Error(`Status ${response.status}`);
        setVehicles(await response.json());
        setFailed(false);
      } catch {
        setFailed(true); // keep the last known positions on the map and try again next round
      }
    }

    function startOrStop() {
      clearInterval(timer);
      if (document.visibilityState !== "visible") return;
      refresh();
      timer = setInterval(refresh, REFRESH_MS);
    }

    startOrStop();
    document.addEventListener("visibilitychange", startOrStop);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", startOrStop);
    };
  }, [areaId]);

  // 3. Whenever new positions arrive (or the map becomes ready), give them to the map.
  useEffect(() => {
    if (!mapReady || !vehicles) return;
    mapRef.current?.getSource<GeoJSONSource>("vehicles")?.setData(toGeoJson(vehicles));
  }, [mapReady, vehicles]);

  // Looked up from the newest list each time, so the card follows the bus as its delay changes.
  const selected = vehicles?.find((vehicle) => vehicle.id === selectedId);

  let statusLine = text.loading;
  if (failed) statusLine = text.failed;
  else if (vehicles) statusLine = text.count.replace("{n}", String(vehicles.length));

  return (
    <>
      {/* MapLibre's own stylesheet sets the positioning of the element it draws in, so the outer
          <div> is the one that stretches over the screen, and the map fills that. */}
      <div className="absolute inset-0">
        <div ref={container} className="h-full" role="application" aria-label={text.label} />
      </div>

      <section className="glass absolute left-2 top-2 w-[min(20rem,calc(100%-1rem))] rounded-lg p-3">
        {children}
        {/* aria-live makes screen readers announce the line when it changes. */}
        <p className="mt-2 text-sm" aria-live="polite">
          {statusLine}
        </p>
        <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted">
          {(["onTime", "late", "veryLate", "early"] as const).map((status) => (
            <li key={status} className="flex items-center gap-1.5">
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: statusColors[status] }} />
              {text.legend[status]}
            </li>
          ))}
        </ul>
      </section>

      {selected && (
        <section className="glass absolute inset-x-2 bottom-12 mx-auto max-w-sm rounded-lg p-3">
          <div className="flex items-start gap-3">
            <span
              className="min-w-10 rounded-md px-2 py-1 text-center font-semibold text-bg"
              style={{ background: statusColors[delayStatus(selected.delay)] }}
            >
              {selected.line}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                {text.towards} {selected.destination}
              </p>
              <p className="truncate text-xs text-muted">
                {text.modes[selected.mode as keyof typeof text.modes] ?? selected.mode} · {selected.lineName}
              </p>
              <p className="mt-1 text-sm">{delayText(selected.delay, text.delay)}</p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              aria-label={text.close}
              className="-m-1 rounded p-1 text-muted hover:text-ink"
            >
              ✕
            </button>
          </div>
        </section>
      )}
    </>
  );
}

// Turns seconds into words: 134 becomes "2 min late".
function delayText(delay: number | null, words: Dictionary["map"]["delay"]) {
  const status: DelayStatus = delayStatus(delay);
  if (delay === null || status === "unknown") return words.unknown;
  if (status === "onTime") return words.onTime;
  const minutes = String(Math.round(Math.abs(delay) / 60));
  return (status === "early" ? words.early : words.late).replace("{n}", minutes);
}
