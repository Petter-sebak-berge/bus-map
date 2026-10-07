// /api/departures?id=NSR:StopPlace:… gives the departure board for one stop: the next departures
// from all its platforms, with the times Entur expects right now.

import type { Board } from "@/lib/stops";

const ENTUR_URL = "https://api.entur.io/journey-planner/v3/graphql";

// The next 15 departures within three hours (10,800 seconds). `frontText` is what the sign on the
// front of the bus says, and a "quay" is one platform of the stop.
const QUERY = `
  query Departures($id: String!) {
    stopPlace(id: $id) {
      name
      estimatedCalls(numberOfDepartures: 15, timeRange: 10800) {
        aimedDepartureTime
        expectedDepartureTime
        cancellation
        destinationDisplay { frontText }
        quay { publicCode }
        serviceJourney { id line { publicCode } }
      }
    }
  }
`;

type EnturCall = {
  aimedDepartureTime: string;
  expectedDepartureTime: string;
  cancellation: boolean;
  destinationDisplay: { frontText: string | null } | null;
  quay: { publicCode: string | null } | null;
  serviceJourney: { id: string; line: { publicCode: string | null } | null } | null;
};

// What a stop id looks like. Checking the shape first means nothing unexpected is sent to Entur.
const ID_SHAPE = /^[A-Z]{3}:StopPlace:[0-9]{1,12}$/;

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!ID_SHAPE.test(id)) return Response.json({ error: "Unknown stop" }, { status: 400 });

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

    const found = answer.data.stopPlace;
    if (!found) return Response.json({ error: "Unknown stop" }, { status: 404 });

    const board: Board = {
      name: found.name,
      departures: (found.estimatedCalls as EnturCall[]).map((call) => ({
        line: call.serviceJourney?.line?.publicCode ?? "",
        destination: call.destinationDisplay?.frontText ?? "",
        aimed: call.aimedDepartureTime,
        expected: call.expectedDepartureTime,
        platform: call.quay?.publicCode ?? "",
        cancelled: call.cancellation,
        journeyId: call.serviceJourney?.id ?? "",
      })),
    };

    return Response.json(board, {
      // Expected times change by the minute, so the answer is kept for 15 seconds only.
      headers: { "Cache-Control": "public, max-age=10, s-maxage=15" },
    });
  } catch (error) {
    console.error("Departure lookup failed:", error);
    return Response.json({ error: "Departures unavailable" }, { status: 502 });
  }
}
