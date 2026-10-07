// Our second endpoint: /api/journey?id=SKY:ServiceJourney:… gives the road and the stops of one
// trip. The vehicle positions come from one of Entur's APIs and say which trip each vehicle is on;
// this endpoint takes that trip's id to another of Entur's APIs, the journey planner, which knows
// the timetable. The id is what connects the two.

import { decodePolyline, type Journey } from "@/lib/journey";

const ENTUR_URL = "https://api.entur.io/journey-planner/v3/graphql";

// `pointsOnLink` is the road, `estimatedCalls` is the list of stops ("calls") with their times.
// A "quay" is the exact platform or kerb the vehicle stops at.
const QUERY = `
  query Journey($id: String!) {
    serviceJourney(id: $id) {
      pointsOnLink { points }
      estimatedCalls {
        quay { name latitude longitude }
        aimedDepartureTime
        expectedDepartureTime
      }
    }
  }
`;

type EnturCall = {
  quay: { name: string; latitude: number; longitude: number } | null;
  aimedDepartureTime: string;
  expectedDepartureTime: string;
};

// What a trip id looks like: three capital letters for the company, ":ServiceJourney:", and a
// code. Checking the shape before passing it on means nothing unexpected is sent to Entur.
const ID_SHAPE = /^[A-Z]{3}:ServiceJourney:[A-Za-z0-9_-]{1,80}$/;

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!ID_SHAPE.test(id)) return Response.json({ error: "Unknown journey" }, { status: 400 });

  try {
    const response = await fetch(ENTUR_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "ET-Client-Name": "servereniskogen-busmap" },
      body: JSON.stringify({ query: QUERY, variables: { id } }),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Entur responded with ${response.status}`);

    const answer = await response.json();
    if (answer.errors) throw new Error(JSON.stringify(answer.errors));

    const found = answer.data.serviceJourney;
    // 404 = "no such thing". Entur doesn't know the trip, for example a bus on its way to the garage.
    if (!found) return Response.json({ error: "Unknown journey" }, { status: 404 });

    const journey: Journey = {
      route: found.pointsOnLink ? decodePolyline(found.pointsOnLink.points) : [],
      stops: (found.estimatedCalls as EnturCall[])
        .filter((call) => call.quay)
        .map((call) => ({
          name: call.quay!.name,
          lat: call.quay!.latitude,
          lon: call.quay!.longitude,
          aimed: call.aimedDepartureTime,
          expected: call.expectedDepartureTime,
        })),
    };

    return Response.json(journey, {
      // The expected times change as the vehicle drives, so the answer is kept for 20 seconds only.
      headers: { "Cache-Control": "public, max-age=10, s-maxage=20" },
    });
  } catch (error) {
    console.error("Journey lookup failed:", error);
    return Response.json({ error: "Journey unavailable" }, { status: 502 });
  }
}
