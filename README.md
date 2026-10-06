# Where's the bus?

A live map of the buses, boats and trains around Bergen, Norway: one dot per vehicle, coloured by
how late it is. Click a dot to see its line, where it is going and its delay.

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
