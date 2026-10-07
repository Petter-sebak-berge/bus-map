// A Route Handler: a small API endpoint of our own, available at /api/vehicles?area=bergen.
// The browser asks *us* where the buses are, and we ask Entur, the company that collects all public
// transport data in Norway. Going through our own server lets us identify the site the way Entur
// asks, send the browser only the fields the map uses, and cache the answer so Entur gets the same
// few requests a minute however many people are watching.

import { areas, isAreaId } from "@/lib/areas";
import { toVehicles, VEHICLE_FIELDS } from "@/lib/vehicles";

const ENTUR_URL = "https://api.entur.io/realtime/v2/vehicles/graphql";

// Entur's API speaks GraphQL: instead of one address per kind of data, there is one address, and
// the request says exactly which fields it wants back (the list is in lib/vehicles.ts). This is
// that request. `$box` is a variable, filled in below, and `maxDataAge: "PT2M"` leaves out
// vehicles that have been silent for more than two minutes ("PT2M" is the standard way to write
// "a period of 2 minutes"); those are parked.
const QUERY = `
  query Vehicles($box: BoundingBox) {
    vehicles(boundingBox: $box, maxDataAge: "PT2M") { ${VEHICLE_FIELDS} }
  }
`;

export async function GET(request: Request) {
  const areaId = new URL(request.url).searchParams.get("area") ?? "bergen";
  // 400 = "the request itself is wrong". Only the areas we have defined can be asked for.
  if (!isAreaId(areaId)) return Response.json({ error: "Unknown area" }, { status: 400 });

  try {
    const response = await fetch(ENTUR_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Entur asks every app to say who it is, as "company-application". Public, not a secret.
        "ET-Client-Name": "servereniskogen-busmap",
      },
      body: JSON.stringify({ query: QUERY, variables: { box: areas[areaId].box } }),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Entur responded with ${response.status}`);

    // A GraphQL answer has `data` when it worked and `errors` when it didn't, also with status 200.
    const answer = await response.json();
    if (answer.errors) throw new Error(JSON.stringify(answer.errors));

    const vehicles = toVehicles(answer.data.vehicles, areas[areaId]);

    return Response.json(vehicles, {
      // s-maxage tells Vercel's network to keep this answer for 10 seconds and reuse it for every
      // visitor, so Entur gets at most six requests a minute from us.
      headers: { "Cache-Control": "public, max-age=5, s-maxage=10" },
    });
  } catch (error) {
    console.error("Vehicle lookup failed:", error);
    // 502 = "the service I depend on failed". The map stays up and tries again.
    return Response.json({ error: "Positions unavailable" }, { status: 502 });
  }
}
