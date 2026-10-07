// The areas the map can show. Today there is one. Nothing else in the code mentions Bergen or Skyss,
// so covering more of Norway later means adding an entry here, not rewriting the map.

export type Area = {
  name: string;
  // Where the map starts: its centre and how far it is zoomed in (higher = closer).
  center: { lat: number; lon: number };
  zoom: number;
  // The "bounding box": a rectangle on the map, given by its corners. We ask Entur only for
  // vehicles inside it.
  box: { minLat: number; minLon: number; maxLat: number; maxLon: number };
  // What the sign on the front says when a vehicle is not carrying passengers, for example on its
  // way to the garage. Around Bergen, Skyss's buses then show the company's web address.
  notInService: string[];
};

export const areas = {
  bergen: {
    name: "Bergen",
    center: { lat: 60.3913, lon: 5.3221 },
    zoom: 11.5,
    box: { minLat: 60.15, minLon: 4.95, maxLat: 60.6, maxLon: 5.75 },
    notInService: ["skyss.no"],
  },
} satisfies Record<string, Area>;

export type AreaId = keyof typeof areas;

export const isAreaId = (value: string): value is AreaId => value in areas;
