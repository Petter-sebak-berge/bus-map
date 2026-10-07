// What a vehicle looks like on this site, how Entur's version of it is turned into ours, and how a
// delay becomes a colour. Both the server (app/api/vehicles/route.ts) and the map
// (app/_components/BusMap.tsx) use this file, so they always agree.

import type { Area } from "./areas";

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
  // has not started yet; a "finished" one has reached its last stop; one that is "notInService"
  // carries no passengers, for example on its way to or from the garage.
  phase: "waiting" | "running" | "finished" | "notInService";
  // How full the vehicle is, in Entur's words (e.g. "seatsAvailable"). null when it doesn't say.
  occupancy: string | null;
  // Seconds behind schedule; negative means ahead of it. For a waiting vehicle, a negative number
  // is the time left until it departs.
  delay: number | null;
  updated: string; // when the vehicle last reported its position
  // The id of the trip the vehicle is on, used to look up its route and stops. null if unknown.
  journeyId: string | null;
};

// The fields we ask Entur for, written in GraphQL. The server's question and the browser's live
// stream both use this list, so they always get the same fields back.
export const VEHICLE_FIELDS = `
  vehicleId
  mode
  lastUpdated
  delay
  vehicleStatus
  occupancyStatus
  bearing
  destinationName
  location { latitude longitude }
  line { publicCode lineName }
  codespace { codespaceId }
  serviceJourney { id }
`;

// One vehicle as Entur sends it. `codespace` says which company the vehicle belongs to ("SKY" is
// Skyss); two companies can use the same vehicle number, so our id needs both.
export type EnturVehicle = {
  vehicleId: string;
  mode: string;
  lastUpdated: string;
  delay: number | null;
  vehicleStatus: string | null; // "AT_ORIGIN", "ASSIGNED", "IN_PROGRESS", "COMPLETED" or nothing
  occupancyStatus: string | null; // "seatsAvailable", "standingAvailable", "noData", ...
  bearing: number | null;
  destinationName: string | null;
  location: { latitude: number; longitude: number } | null;
  line: { publicCode: string | null; lineName: string | null } | null;
  codespace: { codespaceId: string } | null;
  serviceJourney: { id: string } | null;
};

// Works out where a vehicle is in its trip. Entur has four words for it, and none for "not in
// service". We recognise that in two ways: the sign on the front (see lib/areas.ts), or a trip id
// that is not a real timetable trip. Real ones contain ":ServiceJourney:".
function phaseOf(vehicle: EnturVehicle, area: Area): Vehicle["phase"] {
  const tripId = vehicle.serviceJourney?.id;
  if (area.notInService.includes(vehicle.destinationName ?? "")) return "notInService";
  if (tripId && !tripId.includes(":ServiceJourney:")) return "notInService";
  if (vehicle.vehicleStatus === "AT_ORIGIN" || vehicle.vehicleStatus === "ASSIGNED") return "waiting";
  if (vehicle.vehicleStatus === "COMPLETED") return "finished";
  return "running";
}

// Turns Entur's vehicles into ours, leaving out any that have no position.
export function toVehicles(list: EnturVehicle[], area: Area): Vehicle[] {
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
      phase: phaseOf(vehicle, area),
      occupancy: vehicle.occupancyStatus && vehicle.occupancyStatus !== "noData" ? vehicle.occupancyStatus : null,
      delay: vehicle.delay,
      updated: vehicle.lastUpdated,
      journeyId: vehicle.serviceJourney?.id ?? null,
    }));
}

// A vehicle that has been silent this long is parked, and is left off the map.
export const MAX_AGE_MS = 2 * 60 * 1000;

export type Status =
  | "waiting"
  | "finished"
  | "notInService"
  | "early"
  | "onTime"
  | "late"
  | "veryLate"
  | "unknown";

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
  notInService: "#93a39b",
  early: "#6cb8f2",
  onTime: "#6ee7a0",
  late: "#f2b544",
  veryLate: "#f2695c",
  unknown: "#93a39b",
};
