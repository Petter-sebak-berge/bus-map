"use client";
// The departure board: the card shown when the visitor clicks a stop. It lists the next departures
// from that stop. A departure whose vehicle is on the map right now can be clicked to jump to it.

import type { Dictionary } from "@/lib/dictionaries";
import type { Vehicle } from "@/lib/vehicles";
import { useDepartures } from "./useStops";

// Writes a time as "14:05", Norwegian time whatever the visitor's own clock is set to.
const clock = new Intl.DateTimeFormat("nb-NO", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Oslo" });

type Props = {
  stop: { id: string; name: string };
  vehicles: Vehicle[];
  text: Dictionary["map"];
  onPickVehicle: (vehicleId: string) => void;
  onClose: () => void;
};

export default function StopCard({ stop, vehicles, text, onPickVehicle, onClose }: Props) {
  const board = useDepartures(stop.id);
  const departures = typeof board === "object" ? board.departures : [];

  return (
    <section className="glass absolute inset-x-2 bottom-12 mx-auto max-w-sm rounded-lg p-3">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="font-medium">{stop.name}</h2>
          <p className="text-xs text-muted">{text.board.heading}</p>
        </div>
        <button type="button" onClick={onClose} aria-label={text.close} className="-m-1 rounded p-1 text-muted hover:text-ink">
          ✕
        </button>
      </div>

      {board === "loading" && <p className="mt-2 text-xs text-muted">{text.board.loading}</p>}
      {board !== "loading" && departures.length === 0 && <p className="mt-2 text-xs text-muted">{text.board.none}</p>}

      <ol className="mt-2 max-h-44 overflow-x-hidden overflow-y-auto text-sm">
        {departures.map((departure, index) => {
          const expected = clock.format(new Date(departure.expected));
          const aimed = clock.format(new Date(departure.aimed));
          // The vehicle driving this departure, if it is on the map: both carry the same trip id.
          const vehicle = vehicles.find((candidate) => candidate.journeyId === departure.journeyId);

          const row = (
            <>
              <span className={`w-20 shrink-0 tabular-nums ${departure.cancelled ? "line-through" : ""}`}>
                {expected}
                {expected !== aimed && <s className="ml-1 text-xs text-muted">{aimed}</s>}
              </span>
              <span className="min-w-8 shrink-0 rounded bg-white/10 px-1.5 text-center font-medium">{departure.line}</span>
              <span className="min-w-0 flex-1 truncate text-muted">
                {departure.cancelled ? text.board.cancelled : departure.destination}
              </span>
              {departure.platform && <span className="shrink-0 text-xs text-muted">{departure.platform}</span>}
              {/* A small arrow marks the rows that can be clicked. */}
              <span className="w-3 shrink-0 text-xs" aria-hidden="true">
                {vehicle ? "→" : ""}
              </span>
            </>
          );

          return (
            <li key={index}>
              {vehicle ? (
                <button
                  type="button"
                  onClick={() => onPickVehicle(vehicle.id)}
                  title={text.board.showOnMap}
                  className="flex w-full items-center gap-2 rounded py-0.5 text-left hover:bg-white/10"
                >
                  {row}
                </button>
              ) : (
                <div className="flex items-center gap-2 py-0.5">{row}</div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
