"use client";
// Keeps an up-to-date list of the vehicles in an area. A function whose name starts with "use" is
// a "hook": a piece of a component's behaviour that is lifted out into its own file. The map calls
// useVehicles("bergen") and gets the list back, without knowing where it comes from.
//
// The positions arrive in two ways:
//   - A snapshot: we ask our own /api/vehicles for every vehicle at once. Simple and always
//     works, but only as fresh as the last time we asked.
//   - A live stream: the browser opens a WebSocket straight to Entur. A WebSocket is a
//     connection that stays open, so Entur can send each new position the moment it has it,
//     instead of us asking again and again.
// The snapshot fills the map at once and is the fallback; the stream keeps it moving.

import { useEffect, useState } from "react";
import { areas, type AreaId } from "@/lib/areas";
import { MAX_AGE_MS, toVehicles, VEHICLE_FIELDS, type Vehicle } from "@/lib/vehicles";

const STREAM_URL = "wss://api.entur.io/realtime/v2/vehicles/subscriptions";

// In GraphQL a "subscription" is a question that keeps being answered: every time a vehicle in
// the box moves, Entur sends it. `bufferTime: 1000` asks Entur to collect the changes and send
// them in one message a second, rather than one message per vehicle.
const SUBSCRIPTION = `
  subscription Vehicles($box: BoundingBox) {
    vehicles(boundingBox: $box, bufferSize: 500, bufferTime: 1000) { ${VEHICLE_FIELDS} }
  }
`;

const TICK_MS = 10_000; // how often we check on things
const SNAPSHOT_EVERY = 6; // with the stream running, still take a snapshot every 6th tick (a minute)
const RECONNECT_MS = 5_000;

export function useVehicles(areaId: AreaId) {
  const [vehicles, setVehicles] = useState<Vehicle[] | null>(null); // null = nothing fetched yet
  const [failed, setFailed] = useState(false);
  const [live, setLive] = useState(false); // true while the stream is connected

  useEffect(() => {
    // Every vehicle we know of, by id. A Map is a lookup table: give it an id, get the vehicle.
    const known = new Map<string, Vehicle>();
    let socket: WebSocket | null = null;
    let timer: ReturnType<typeof setInterval> | undefined;
    let reconnect: ReturnType<typeof setTimeout> | undefined;
    let ticks = 0;
    let watching = false; // false while the tab is hidden or the component is gone

    // Puts new positions into the table and hands the result to the map.
    function take(list: Vehicle[]) {
      for (const vehicle of list) {
        // Messages can arrive out of order, so an older position never replaces a newer one.
        const previous = known.get(vehicle.id);
        if (!previous || vehicle.updated >= previous.updated) known.set(vehicle.id, vehicle);
      }
      // Drop vehicles that have gone silent. Age is measured against the newest position we
      // have, not the visitor's own clock, which may be wrong.
      let newest = 0;
      for (const vehicle of known.values()) newest = Math.max(newest, Date.parse(vehicle.updated));
      for (const vehicle of known.values()) {
        if (newest - Date.parse(vehicle.updated) > MAX_AGE_MS) known.delete(vehicle.id);
      }
      setVehicles([...known.values()]);
    }

    async function snapshot() {
      try {
        const response = await fetch(`/api/vehicles?area=${areaId}`);
        if (!response.ok) throw new Error(`Status ${response.status}`);
        take(await response.json());
        setFailed(false);
      } catch {
        setFailed(true); // keep the last known positions on the map and try again next round
      }
    }

    // Opens the live stream. The two sides talk in small JSON messages with a `type`, following
    // a standard called "graphql-transport-ws": we say hello (connection_init), Entur answers
    // (connection_ack), we send our subscription (subscribe), and from then on Entur sends
    // positions (next).
    function connect() {
      const stream = new WebSocket(STREAM_URL, "graphql-transport-ws");
      socket = stream;
      const send = (message: object) => stream.send(JSON.stringify(message));

      stream.onopen = () => send({ type: "connection_init" });
      stream.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (message.type === "connection_ack") {
          send({
            id: "vehicles",
            type: "subscribe",
            payload: { query: SUBSCRIPTION, variables: { box: areas[areaId].box } },
          });
          setLive(true);
        } else if (message.type === "next") {
          take(toVehicles(message.payload.data?.vehicles ?? []));
        } else if (message.type === "ping") {
          send({ type: "pong" }); // "are you still there?" "yes"
        }
      };
      // If the connection drops, the snapshots take over (see the timer below) and we try to
      // connect again a little later.
      stream.onclose = () => {
        if (socket !== stream) return; // an old connection we already replaced
        socket = null;
        setLive(false);
        if (watching) reconnect = setTimeout(connect, RECONNECT_MS);
      };
    }

    function stop() {
      watching = false;
      clearInterval(timer);
      clearTimeout(reconnect);
      socket?.close();
    }

    // Only while the tab is visible: a map nobody is looking at shouldn't keep a line open.
    function startOrStop() {
      stop();
      if (document.visibilityState !== "visible") return;
      watching = true;
      snapshot();
      connect();
      timer = setInterval(() => {
        ticks += 1;
        // Without the stream, ask every tick. With it, only now and then, as a safety net.
        if (!socket || ticks % SNAPSHOT_EVERY === 0) snapshot();
      }, TICK_MS);
    }

    startOrStop();
    document.addEventListener("visibilitychange", startOrStop);
    // The function an effect returns is its clean-up: it runs when the component goes away.
    return () => {
      stop();
      document.removeEventListener("visibilitychange", startOrStop);
    };
  }, [areaId]);

  return { vehicles, failed, live };
}
