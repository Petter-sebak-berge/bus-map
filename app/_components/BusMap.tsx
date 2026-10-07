"use client";
// The map. It runs in the visitor's browser (hence "use client"), because a map is drawn and moved
// around there. It does two things:
//   1. draws the map
//   2. hands the newest positions to the map, which draws one dot per vehicle and lets it glide
//      from where it was to where it is now
//   3. draws the route and lists the coming stops of the vehicle the visitor has clicked
// Where the positions come from is in useVehicles.ts, and the route in useJourney.ts.
//
// The drawing is done by MapLibre, an open-source map library. The background maps it can show
// are listed in lib/mapStyles.ts.

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import maplibregl, { type GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { FeatureCollection, Point } from "geojson";
import { areas, type AreaId } from "@/lib/areas";
import type { Dictionary } from "@/lib/dictionaries";
import { mapStyleIds, mapStyles, type MapStyleId } from "@/lib/mapStyles";
import { statusColors, statusOf, type Vehicle } from "@/lib/vehicles";
import { useJourney } from "./useJourney";
import { useVehicles } from "./useVehicles";

// The colour of a clicked vehicle's route. Purple is not used for anything else on the map.
const ROUTE_COLOR = "#7c3aed";

// Writes a time as "14:05", Norwegian time whatever the visitor's own clock is set to.
const clock = new Intl.DateTimeFormat("nb-NO", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Oslo" });

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
  // What the visitor has typed in the "find line" field, exactly as typed.
  const [lineSearch, setLineSearch] = useState("");

  // The vehicles to draw: all of them, or only the lines asked for. "3, 4E 10" means lines 3, 4E
  // and 10: the text is split at commas and spaces, and capital letters don't matter.
  // useMemo remembers the result and works it out again only when the list or the text changes,
  // so the map isn't handed a "new" list every time something unrelated is redrawn.
  const shownVehicles = useMemo(() => {
    const wanted = lineSearch.toUpperCase().split(/[s,]+/).filter(Boolean);
    if (!vehicles || wanted.length === 0) return vehicles;
    return vehicles.filter((vehicle) => wanted.includes(vehicle.line.toUpperCase()));
  }, [vehicles, lineSearch]);

  // "State" is what the component remembers and redraws for when it changes.
  const [styleId, setStyleId] = useState<MapStyleId>("bright");
  const [mapReady, setMapReady] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Whether the panel at the top shows everything or only its first lines.
  const [panelOpen, setPanelOpen] = useState(true);
  // Whether the list of coming stops is shown. null means the visitor hasn't chosen yet: then the
  // list is open on wide screens and closed on phones, where the card would cover much of the map.
  const [stopsOpen, setStopsOpen] = useState<boolean | null>(null);

  // The clicked vehicle, looked up from the newest list each time, so the card follows the bus as
  // its delay changes. Its trip id is handed to useJourney, which fetches the route and stops.
  const selected = vehicles?.find((vehicle) => vehicle.id === selectedId);
  const journey = useJourney(selected?.journeyId ?? null);

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
      // The route of the clicked vehicle and its stops come first, so they lie under the dots.
      // They start out empty and are filled in further down, in step 3.
      map.addSource("route", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addSource("stops", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({
        id: "route-line",
        type: "line",
        source: "route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": ROUTE_COLOR, "line-width": 4, "line-opacity": 0.85 },
      });
      map.addLayer({
        id: "route-stops",
        type: "circle",
        source: "stops",
        minzoom: 11, // zoomed further out, the stops would only be a smear along the line
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 11, 2, 15, 5],
          "circle-color": "#ffffff",
          "circle-stroke-width": 2,
          "circle-stroke-color": ROUTE_COLOR,
        },
      });

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
    if (!mapReady || !shownVehicles || !source) return;

    const from = shown.current;
    const started = performance.now();
    // People who have asked their device for less motion get the dots moved in one step.
    const glide = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;

    function draw(now: number) {
      // `progress` goes from 0 (just started) to 1 (arrived).
      const progress = glide ? Math.min(1, (now - started) / GLIDE_MS) : 1;
      const next = new Map<string, Position>();
      for (const vehicle of shownVehicles!) {
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
      source!.setData(toGeoJson(shownVehicles!, next));
      // requestAnimationFrame asks the browser to call `draw` again just before it next
      // repaints the screen, usually 60 times a second.
      if (progress < 1) frame = requestAnimationFrame(draw);
    }

    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [mapReady, shownVehicles]);

  // 3. Draw the route of the clicked vehicle, and take it away again when nothing is selected.
  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;
    const shownJourney = typeof journey === "object" ? journey : null;
    // A "LineString" is GeoJSON's word for a line through a list of points.
    map.getSource<GeoJSONSource>("route")?.setData({
      type: "Feature",
      geometry: { type: "LineString", coordinates: shownJourney?.route ?? [] },
      properties: {},
    });
    map.getSource<GeoJSONSource>("stops")?.setData({
      type: "FeatureCollection",
      features: (shownJourney?.stops ?? []).map((stop) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [stop.lon, stop.lat] },
        properties: {},
      })),
    });
  }, [mapReady, journey]);

  // The stops the vehicle has not left yet. "Now" is the time of the vehicle's last report rather
  // than the visitor's own clock, which may be wrong.
  const comingStops =
    selected && typeof journey === "object"
      ? journey.stops.filter((stop) => Date.parse(stop.expected) > Date.parse(selected.updated) - 30_000)
      : [];

  let statusLine = text.loading;
  if (failed) statusLine = text.failed;
  else if (shownVehicles) {
    // With a line typed in and nothing found, say so instead of "0 vehicles".
    statusLine =
      lineSearch.trim() && shownVehicles.length === 0
        ? text.line.none
        : text.count.replace("{n}", String(shownVehicles.length));
  }

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
        {/* Everything from here to the fold button can be folded away. "hidden" is a Tailwind class
            that takes an element off the page without removing it, so what was typed stays. */}
        <div className={panelOpen ? "" : "hidden"}>
          <label className="mt-2 flex items-center gap-2 text-xs text-muted">
            {text.line.label}
            {/* type="search" gives the field a small × for emptying it in most browsers. */}
            <input
              type="search"
              value={lineSearch}
              onChange={(event) => setLineSearch(event.target.value)}
              placeholder={text.line.placeholder}
              autoComplete="off"
              className="min-w-0 flex-1 rounded border border-white/15 bg-bg px-2 py-1 text-ink placeholder:text-muted/60"
            />
          </label>
          <ul className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted">
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
        </div>
        {/* Folded, the panel still says where the data comes from, as Entur's licence asks. */}
        {!panelOpen && (
          <p className="mt-1 text-xs text-muted">
            <a href="https://entur.no" className="underline underline-offset-2 hover:text-ink">
              {text.credit}
            </a>
          </p>
        )}
        {/* aria-expanded tells screen readers whether the panel is open. */}
        <button
          type="button"
          onClick={() => setPanelOpen(!panelOpen)}
          aria-expanded={panelOpen}
          className="mt-2 flex w-full items-center justify-center gap-1 border-t border-white/10 pt-2 text-xs text-muted hover:text-ink"
        >
          {panelOpen ? text.panel.hide : text.panel.show}
          <span aria-hidden="true">{panelOpen ? "▴" : "▾"}</span>
        </button>
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
          {/* The coming stops. Only a handful fit; the rest are reached by scrolling the list. */}
          {journey === "loading" && <p className="mt-2 text-xs text-muted">{text.stops.loading}</p>}
          {comingStops.length > 0 && (
            <>
              {/* The heading is a button that opens and closes the list. The two arrows are both in
                  the page, and the same classes that show or hide the list pick which one is seen. */}
              <h2 className="mt-3 text-xs font-medium uppercase tracking-wide text-muted">
                <button
                  type="button"
                  onClick={() => setStopsOpen(!(stopsOpen ?? window.matchMedia("(min-width: 640px)").matches))}
                  className="flex w-full items-center justify-between uppercase tracking-wide hover:text-ink"
                >
                  {text.stops.heading}
                  <span aria-hidden="true">
                    <span className={shownWhen(stopsOpen)}>▴</span>
                    <span className={shownWhen(stopsOpen === null ? null : !stopsOpen, true)}>▾</span>
                  </span>
                </button>
              </h2>
              <ol className={`mt-1 max-h-36 overflow-y-auto text-sm ${shownWhen(stopsOpen)}`}>
                {comingStops.map((stop, index) => {
                  const expected = clock.format(new Date(stop.expected));
                  const aimed = clock.format(new Date(stop.aimed));
                  return (
                    <li key={index} className="flex gap-3 py-0.5">
                      <span className="shrink-0 tabular-nums">
                        {expected}
                        {/* When the expected time differs from the timetable, the timetable's time is
                            shown crossed out beside it. */}
                        {expected !== aimed && <s className="ml-1 text-xs text-muted">{aimed}</s>}
                      </span>
                      <span className="truncate text-muted">{stop.name}</span>
                    </li>
                  );
                })}
              </ol>
            </>
          )}
        </section>
      )}
    </>
  );
}

// The classes that show or hide something that is open on wide screens and closed on phones
// until the visitor chooses. "sm:" in Tailwind means "from 640 pixels wide and up".
// `opposite` is for the thing shown in the other case (the arrow that says "open me").
function shownWhen(open: boolean | null, opposite = false) {
  if (open === null) return opposite ? "sm:hidden" : "hidden sm:block";
  return open ? "" : "hidden";
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
