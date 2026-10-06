// The background maps the visitor can choose between. The buses are drawn on top of whichever
// one is chosen.
//
// All three come from OpenFreeMap, a free service built on OpenStreetMap data that needs no account
// or key. Each address is a "style": a recipe that tells the map which shapes to download (roads,
// water, names) and how to colour them. The map draws them itself, so it stays sharp at every zoom.

export const mapStyles = {
  liberty: "https://tiles.openfreemap.org/styles/liberty",
  bright: "https://tiles.openfreemap.org/styles/bright",
  dark: "https://tiles.openfreemap.org/styles/dark",
} satisfies Record<string, string>;

export type MapStyleId = keyof typeof mapStyles;

export const mapStyleIds = Object.keys(mapStyles) as MapStyleId[];
