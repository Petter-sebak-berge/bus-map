// /api/stops?area=bergen gives every stop in the area: its id, name and position. Stops hardly
// ever change, so the answer is kept for a whole day and Entur is asked about once a day.

import { areas, isAreaId } from "@/lib/areas";
import type { StopPlace } from "@/lib/stops";

const ENTUR_URL = "https://api.entur.io/journey-planner/v3/graphql";

// "Bbox" is short for bounding box: the same rectangle the vehicles are asked for.
const QUERY = `
  query Stops($minLat: Float!, $minLon: Float!, $maxLat: Float!, $maxLon: Float!) {
    stopPlacesByBbox(
      minimumLatitude: $minLat, minimumLongitude: $minLon,
      maximumLatitude: $maxLat, maximumLongitude: $maxLon
    ) { id name latitude longitude }
  }
`;

type EnturStop = { id: string; name: string; latitude: number; longitude: number };

export async function GET(request: Request) {
  const areaId = new URL(request.url).searchParams.get("area") ?? "bergen";
  if (!isAreaId(areaId)) return Response.json({ error: "Unknown area" }, { status: 400 });

  try {
    const response = await fetch(ENTUR_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "ET-Client-Name": "servereniskogen-busmap" },
      body: JSON.stringify({ query: QUERY, variables: areas[areaId].box }),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Entur responded with ${response.status}`);

    const answer = await response.json();
    if (answer.errors) throw new Error(JSON.stringify(answer.errors));

    const stops: StopPlace[] = (answer.data.stopPlacesByBbox as EnturStop[]).map((stop) => ({
      id: stop.id,
      name: stop.name,
      // Five decimals is about one metre, plenty for a dot on a map, and it makes the answer smaller.
      lat: Math.round(stop.latitude * 1e5) / 1e5,
      lon: Math.round(stop.longitude * 1e5) / 1e5,
    }));

    return Response.json(stops, {
      // One day in the visitor's browser and on Vercel's network (86,400 seconds).
      headers: { "Cache-Control": "public, max-age=86400, s-maxage=86400" },
    });
  } catch (error) {
    console.error("Stop lookup failed:", error);
    return Response.json({ error: "Stops unavailable" }, { status: 502 });
  }
}
