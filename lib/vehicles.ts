// What a vehicle looks like on this site, how Entur's version of it is turned into ours, and how a
// delay becomes a colour. Both the server (app/api/vehicles/route.ts) and the map
// (app/_components/BusMap.tsx) use this file, so they always agree.

export type Vehicle = {
  id: string;
  mode: string; // "BUS", "FERRY", "RAIL", ...
  line: string; // the number on the front, e.g. "14"
  lineName: string; // e.g. "Bergen busstasjon - Fyllingsdalen terminal"
  destination: string;
  lat: number;
  lon: number;
  // The compass direction the vehicle is heading, in degrees: 0 is north, 90 east, 180 south.
  // null when the vehicle doesn't report one.
  bearing: number | null;
  // Where the vehicle is in its trip. A "waiting" vehicle stands at the first stop of a trip that
  // has not started yet; a "finished" one has reached its last stop.
  phase: "waiting" | "running" | "finished";
  // Seconds behind schedule; negative means ahead of it. For a waiting vehicle, a negative number
  // is the time left until it departs.
  delay: number | null;
  updated: string; // when the vehicle last reported its position
};

// The fields we ask Entur for, written in GraphQL. The server's question and the browser's live
// stream both use this list, so they always get the same fields back.
export const VEHICLE_FIELDS = `
  vehicleId
  mode
  lastUpdated
  delay
  vehicleStatus
  bearing
  destinationName
  location { latitude longitude }
  line { publicCode lineName }
  codespace { codespaceId }
`;

// One vehicle as Entur sends it. `codespace` says which company the vehicle belongs to ("SKY" is
// Skyss); two companies can use the same vehicle number, so our id needs both.
export type EnturVehicle = {
  vehicleId: string;
  mode: string;
  lastUpdated: string;
  delay: number | null;
  vehicleStatus: string | null; // "AT_ORIGIN", "ASSIGNED", "IN_PROGRESS", "COMPLETED" or nothing
  bearing: number | null;
  destinationName: string | null;
  location: { latitude: number; longitude: number } | null;
  line: { publicCode: string | null; lineName: string | null } | null;
  codespace: { codespaceId: string } | null;
};

// Entur has four words for where a vehicle is in its trip; the map needs three.
function phaseOf(vehicleStatus: string | null): Vehicle["phase"] {
  if (vehicleStatus === "AT_ORIGIN" || vehicleStatus === "ASSIGNED") return "waiting";
  if (vehicleStatus === "COMPLETED") return "finished";
  return "running";
}

// Turns Entur's vehicles into ours, leaving out any that have no position.
export function toVehicles(list: EnturVehicle[]): Vehicle[] {
  return list
    .filter((vehicle) => vehicle.location)
    .map((vehicle) => ({
      id: `${vehicle.codespace?.codespaceId ?? ""}:${vehicle.vehicleId}`,
      mode: vehicle.mode,
      line: vehicle.line?.publicCode ?? "",
      lineName: vehicle.line?.lineName ?? "",
      destination: vehicle.destinationName ?? "",
      lat: vehicle.location!.latitude,
      lon: vehicle.location!.longitude,
      // About one vehicle in ten reports exactly 0 or nothing. A real heading is almost never
      // exactly 0, and it would wrongly read as "heading north", so 0 is treated as unknown.
      bearing: vehicle.bearing || null,
      phase: phaseOf(vehicle.vehicleStatus),
      delay: vehicle.delay,
      updated: vehicle.lastUpdated,
    }));
}

// A vehicle that has been silent this long is parked, and is left off the map.
export const MAX_AGE_MS = 2 * 60 * 1000;

export type Status = "waiting" | "finished" | "early" | "onTime" | "late" | "veryLate" | "unknown";

// What the map shows for a vehicle. Only a vehicle on a trip can be early or late: one that waits
// for its departure would otherwise look "20 minutes early".
// Two minutes late still counts as on time; that is how most transport companies count it too.
export function statusOf({ phase, delay }: Pick<Vehicle, "phase" | "delay">): Status {
  if (phase !== "running") return phase;
  if (delay === null) return "unknown";
  if (delay < -60) return "early";
  if (delay < 120) return "onTime";
  if (delay < 300) return "late";
  return "veryLate";
}

export const statusColors: Record<Status, string> = {
  waiting: "#93a39b",
  finished: "#93a39b",
  early: "#6cb8f2",
  onTime: "#6ee7a0",
  late: "#f2b544",
  veryLate: "#f2695c",
  unknown: "#93a39b",
};
