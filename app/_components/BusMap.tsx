"use client";
// The map. It runs in the visitor's browser (hence "use client"), because a map is drawn and moved
// around there. It does three things:
//   1. draws the map, once
//   2. asks our own /api/vehicles for positions every ten seconds
//   3. hands the newest positions to the map, which draws one dot per vehicle
//
// The drawing is done by MapLibre, an open-source map library. The background maps it can show
// are listed in lib/mapStyles.ts.

import { useEffect, useRef, useState, type ReactNode } from "react";
import maplibregl, { type GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { FeatureCollection, Point } from "geojson";
import { areas, type AreaId } from "@/lib/areas";
import type { Dictionary } from "@/lib/dictionaries";
import { mapStyleIds, mapStyles, type MapStyleId } from "@/lib/mapStyles";
import { delayStatus, statusColors, type DelayStatus, type Vehicle } from "@/lib/vehicles";

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
      properties: {
        id: vehicle.id,
        line: vehicle.line,
        status: delayStatus(vehicle.delay),
        // Left out when unknown, so the map draws no arrow for that vehicle.
        ...(vehicle.bearing !== null && { bearing: vehicle.bearing }),
      },
    })),
  };
}

// Draws the little pointer that shows which way a vehicle is heading: a triangle pointing
// up (north). The map turns it to each vehicle's direction, and the dot is drawn on top of its
// wide end, so only the tip sticks out. It is drawn twice as large as it is shown, so it stays
// sharp on high-resolution screens.
function pointerImage(color: string): ImageData {
  const size = 96;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const pen = canvas.getContext("2d")!;
  pen.fillStyle = color;
  pen.beginPath();
  pen.moveTo(size / 2, 2); // the tip, at the top
  pen.lineTo(size / 2 + 20, size / 2); // down to the right of the centre
  pen.lineTo(size / 2 - 20, size / 2); // across to the left of the centre
  pen.fill();
  return pen.getImageData(0, 0, size, size);
}

type Props = {
  areaId: AreaId;
  text: Dictionary["map"];
  children: ReactNode; // the title and language link, written by the page
  footer: ReactNode; // the credit to Entur, shown at the bottom of the panel
};

export default function BusMap({ areaId, text, children, footer }: Props) {
  const area = areas[areaId];
  // A "ref" holds on to something between redraws without causing one: the <div> the map is drawn
  // in, and the map itself.
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  // Where the visitor was looking, so that changing the background map does not jump back to the start.
  const view = useRef({ center: [area.center.lon, area.center.lat] as [number, number], zoom: area.zoom });

  // "State" is what the component remembers and redraws for when it changes.
  const [styleId, setStyleId] = useState<MapStyleId>("liberty");
  const [mapReady, setMapReady] = useState(false);
  const [vehicles, setVehicles] = useState<Vehicle[] | null>(null); // null = nothing fetched yet
  const [failed, setFailed] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // 1. Draw the map. useEffect runs after the page is shown, and only in the browser. It runs
  //    again when the visitor picks another background: the old map is removed and a new one drawn.
  useEffect(() => {
    const map = new maplibregl.Map({
      container: container.current!,
      style: mapStyles[styleId],
      center: view.current.center,
      zoom: view.current.zoom,
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");

    // The edge around each dot and its pointer: dark on the light maps, light on the dark one,
    // so they stand out from the background either way.
    const outline = styleId === "dark" ? "#e8ede8" : "#0a100e";

    map.on("load", () => {
      // A "source" is the data, a "layer" is one way of drawing it. One source, three layers,
      // drawn in this order: the direction pointers, the coloured dots, and the line numbers.
      map.addSource("vehicles", { type: "geojson", data: toGeoJson([]) });
      map.addImage("pointer", pointerImage(outline), { pixelRatio: 2 });
      map.addLayer({
        id: "vehicle-pointers",
        type: "symbol",
        source: "vehicles",
        filter: ["has", "bearing"],
        layout: {
          "icon-image": "pointer",
          // Grows with the dots (see circle-radius below), so the tip always sticks out the same.
          "icon-size": ["interpolate", ["linear"], ["zoom"], 9, 0.27, 13, 0.9, 16, 1.26],
          "icon-rotate": ["get", "bearing"],
          // "map" means the angle is measured against north on the map, not the top of the screen.
          "icon-rotation-alignment": "map",
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
        },
      });
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
          "circle-stroke-color": outline,
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
    return () => {
      const center = map.getCenter();
      view.current = { center: [center.lng, center.lat], zoom: map.getZoom() };
      map.remove();
      setMapReady(false);
    };
  }, [styleId]);

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
        <label className="mt-3 flex items-center gap-2 text-xs text-muted">
          {text.style.label}
          <select
            value={styleId}
            onChange={(event) => setStyleId(event.target.value as MapStyleId)}
            className="rounded border border-white/15 bg-bg px-1.5 py-1 text-ink"
          >
            {mapStyleIds.map((id) => (
              <option key={id} value={id}>
                {text.style.names[id]}
              </option>
            ))}
          </select>
        </label>
        {footer}
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
