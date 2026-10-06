// The shape of one vehicle as our own API sends it to the browser, and how a delay becomes a colour.
// Both the server (app/api/vehicles/route.ts) and the map (app/_components/BusMap.tsx) use this file,
// so they always agree on what a vehicle looks like.

export type Vehicle = {
  id: string;
  mode: string; // "BUS", "FERRY", "RAIL", ...
  line: string; // the number on the front, e.g. "14"
  lineName: string; // e.g. "Bergen busstasjon - Fyllingsdalen terminal"
  destination: string;
  lat: number;
  lon: number;
  delay: number | null; // seconds behind schedule; negative means ahead of it
  updated: string; // when the vehicle last reported its position
};

export type DelayStatus = "early" | "onTime" | "late" | "veryLate" | "unknown";

// Two minutes late still counts as on time; that is how most transport companies count it too.
export function delayStatus(delay: number | null): DelayStatus {
  if (delay === null) return "unknown";
  if (delay < -60) return "early";
  if (delay < 120) return "onTime";
  if (delay < 300) return "late";
  return "veryLate";
}

export const statusColors: Record<DelayStatus, string> = {
  early: "#6cb8f2",
  onTime: "#6ee7a0",
  late: "#f2b544",
  veryLate: "#f2695c",
  unknown: "#93a39b",
};
