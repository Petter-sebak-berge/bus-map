# Where's the bus?

A live map of the buses, boats and trains around Bergen, Norway: one dot per vehicle, coloured by
how late it is. Click a dot to see its line, its delay, how full it is, its route drawn on the map
and its next stops. Click a stop to see its next departures. Type a line number to see only that
line.

Built with Next.js (App Router), TypeScript, Tailwind CSS and MapLibre.

## How it works

1. When the page opens, the browser asks this site's own endpoint, `/api/vehicles`, for every
   vehicle at once.
2. The endpoint asks [Entur](https://developer.entur.org), which collects all public transport data
   in Norway, for the vehicles inside the map's area. Entur's API speaks GraphQL, so the request
   names exactly the fields it wants. The answer is cached for ten seconds, so Entur gets the same
   few requests a minute however many people are watching.
3. The browser then opens a WebSocket straight to Entur and subscribes to the same area. From then
   on Entur sends each new position as it happens, about once a second in total. If the stream
   drops, the page falls back to asking the endpoint every ten seconds.
4. The map turns the list into GeoJSON and MapLibre draws it. Each dot glides from its old position
   to its new one, and its pointed tip shows the direction it is heading.

| File | What it does |
|---|---|
| `app/api/vehicles/route.ts` | The endpoint: asks Entur, trims the answer, caches it |
| `app/_components/BusMap.tsx` | The map: draws it, lets the dots glide, shows the selected vehicle |
| `app/_components/useVehicles.ts` | Where positions come from: the endpoint first, then the live stream |
| `app/_components/VisitCounter.tsx` | Counts a visit: a number per day, language and country, nothing per visitor |
| `app/api/journey/route.ts` | A second endpoint: the road and stops of one trip, from Entur's journey planner |
| `app/_components/useJourney.ts` | Fetches that for the vehicle you click |
| `lib/journey.ts` | What a trip looks like, and the unpacking of Entur's compact road format |
| `app/api/stops/route.ts`, `app/api/departures/route.ts` | Two more endpoints: every stop in the area, and one stop's next departures |
| `app/_components/StopCard.tsx`, `app/_components/useStops.ts` | The departure board shown when you click a stop |
| `lib/areas.ts` | The area the map covers. More areas can be added here |
| `lib/mapStyles.ts` | The background maps the visitor can choose between |
| `lib/vehicles.ts` | What a vehicle looks like, how Entur's data becomes that, and how a status becomes a colour |
| `lib/dictionaries.ts` | All text, in Norwegian and English |

## How this was built

I work in sales and am learning web development by building real tools. This one was built together
with Claude (Anthropic's AI model) in Claude Code: Claude wrote most of the code, and explained
each step so that I can read it, change it and explain it myself. The commits say so too.

What this project was for me to learn: GraphQL, drawing maps, and live data.

## Run it locally

```bash
npm install
npm run dev
```

Then open http://localhost:3200. No account or key is needed.

## Data and credits

- Vehicle positions: data made available by [Entur](https://entur.no), under the Norwegian Licence
  for Open Government Data (NLOD).
- Background maps: [OpenFreeMap](https://openfreemap.org), © OpenMapTiles, data from OpenStreetMap.
