"use client";
// The map. It runs in the visitor's browser (hence "use client"), because a map is drawn and moved
// around there. It does two things:
//   1. draws the map
//   2. hands the newest positions to the map, which draws one dot per vehicle and lets it glide
//      from where it was to where it is now
// Where the positions come from is in useVehicles.ts.
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
import { statusColors, statusOf, type Vehicle } from "@/lib/vehicles";
import { useVehicles } from "./useVehicles";

// How long a dot takes to glide to a new position. New positions arrive about once a second.
const GLIDE_MS = 1000;
// A jump longer than this (in degrees, roughly 500 metres) is a correction, not driving: no glide.
const MAX_GLIDE = 0.005;

type Position = [lon: number, lat: number];

// Maps don't take a plain list; they take GeoJSON, the standard format for "things with a place".
// Each vehicle becomes a "feature": a point, plus the properties the map uses to colour and label it.
// Note the order: GeoJSON writes longitude first, then latitude.
// `shown` says where each dot is drawn right now, which during a glide is somewhere between
// its old and its new position.
function toGeoJson(vehicles: Vehicle[], shown?: Map<string, Position>): FeatureCollection<Point> {
  return {
    type: "FeatureCollection",
    features: vehicles.map((vehicle) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: shown?.get(vehicle.id) ?? [vehicle.lon, vehicle.lat] },
      properties: {
        id: vehicle.id,
        line: vehicle.line,
        status: statusOf(vehicle),
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

  // Whether we have already tried to open the map at the visitor's position.
  const openedAtVisitor = useRef(false);
  // Where each dot is drawn right now.
  const shown = useRef(new Map<string, Position>());
  const { vehicles, failed, live } = useVehicles(areaId);

  // "State" is what the component remembers and redraws for when it changes.
  const [styleId, setStyleId] = useState<MapStyleId>("liberty");
  const [mapReady, setMapReady] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // 1. Draw the map. useEffect runs after the page is shown, and only in the browser. It runs
  //    again when the visitor picks another background: the old map is removed and a new one drawn.
  useEffect(() => {
    const map = new maplibregl.Map({
      container: container.current!,
      style: mapStyles[styleId],
      center: view.current.center,
      zoom: view.current.zoom,
      // The words for the map's own buttons, in the page's language.
      locale: {
        "GeolocateControl.FindMyLocation": text.locate.find,
        "GeolocateControl.LocationNotAvailable": text.locate.unavailable,
      },
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");

    // A button that moves the map to where the visitor is and marks the spot with a blue dot.
    // The browser asks the visitor for permission first. The position stays in the browser:
    // it is used to move the map and is never sent to us or anyone else.
    const locate = new maplibregl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      fitBoundsOptions: { maxZoom: 15 },
    });
    map.addControl(locate, "bottom-right");

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
            "waiting", statusColors.waiting,
            "finished", statusColors.finished,
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

      // Open at the visitor's own position, but only the first time the map is drawn, only if
      // they have already said yes to sharing it on an earlier visit (so nobody is met by a
      // permission question before they have seen the page), and only if they are inside the
      // area the map covers.
      if (openedAtVisitor.current) return;
      openedAtVisitor.current = true;
      navigator.permissions
        ?.query({ name: "geolocation" })
        .then((permission) => {
          if (permission.state !== "granted") return;
          navigator.geolocation.getCurrentPosition(({ coords }) => {
            const { minLat, maxLat, minLon, maxLon } = area.box;
            const inside =
              coords.latitude > minLat && coords.latitude < maxLat && coords.longitude > minLon && coords.longitude < maxLon;
            if (inside) locate.trigger();
          });
        })
        .catch(() => {}); // a browser that can't answer simply starts at the usual place
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
    // The list of things this effect depends on: it runs again only when one of them changes.
    // In practice that is the background map; the other two stay the same while the page is open.
  }, [styleId, area, text.locate]);

  // 2. Whenever new positions arrive (or the map becomes ready), move the dots. Each dot glides
  //    from where it is drawn now to its new position, a small step per screen frame.
  useEffect(() => {
    const source = mapRef.current?.getSource<GeoJSONSource>("vehicles");
    if (!mapReady || !vehicles || !source) return;

    const from = shown.current;
    const started = performance.now();
    // People who have asked their device for less motion get the dots moved in one step.
    const glide = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;

    function draw(now: number) {
      // `progress` goes from 0 (just started) to 1 (arrived).
      const progress = glide ? Math.min(1, (now - started) / GLIDE_MS) : 1;
      const next = new Map<string, Position>();
      for (const vehicle of vehicles!) {
        const start = from.get(vehicle.id);
        const far =
          !start || Math.abs(vehicle.lon - start[0]) > MAX_GLIDE || Math.abs(vehicle.lat - start[1]) > MAX_GLIDE;
        next.set(
          vehicle.id,
          far
            ? [vehicle.lon, vehicle.lat]
            : [start[0] + (vehicle.lon - start[0]) * progress, start[1] + (vehicle.lat - start[1]) * progress],
        );
      }
      shown.current = next;
      source!.setData(toGeoJson(vehicles!, next));
      // requestAnimationFrame asks the browser to call `draw` again just before it next
      // repaints the screen, usually 60 times a second.
      if (progress < 1) frame = requestAnimationFrame(draw);
    }

    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
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

      <section className="glass absolute left-2 top-2 max-h-[calc(100%-1rem)] w-[min(20rem,calc(100%-1rem))] overflow-y-auto rounded-lg p-3">
        {children}
        {/* aria-live makes screen readers announce the line when it changes. */}
        <p className="mt-2 flex items-center gap-2 text-sm" aria-live="polite">
          {statusLine}
          {live && (
            <span className="flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-xs">
              <span className="live-dot size-1.5 rounded-full" style={{ background: statusColors.onTime }} />
              {text.live}
            </span>
          )}
        </p>
        <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted">
          {(["onTime", "late", "veryLate", "early", "waiting"] as const).map((status) => (
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
              style={{ background: statusColors[statusOf(selected)] }}
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
              <p className="mt-1 text-sm">{statusText(selected, text.delay)}</p>
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

// Turns a vehicle's status into words: 134 seconds late becomes "2 min late", and a bus waiting
// at its first stop with 300 seconds to go becomes "Leaves in 5 min".
function statusText(vehicle: Vehicle, words: Dictionary["map"]["delay"]) {
  const status = statusOf(vehicle);
  const minutes = String(Math.round(Math.abs(vehicle.delay ?? 0) / 60));
  switch (status) {
    case "waiting":
      // Only a departure that is still ahead gets a countdown.
      return (vehicle.delay ?? 0) < -30 ? words.leavesIn.replace("{n}", minutes) : words.waiting;
    case "finished":
      return words.finished;
    case "unknown":
      return words.unknown;
    case "onTime":
      return words.onTime;
    case "early":
      return words.early.replace("{n}", minutes);
    default:
      return words.late.replace("{n}", minutes);
  }
}
