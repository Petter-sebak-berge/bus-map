# Where's the bus?

A live map of the buses, boats and trains around Bergen, Norway: one dot per vehicle, coloured by
how late it is. Click a dot to see its line, where it is going and its delay.

Built with Next.js (App Router), TypeScript, Tailwind CSS and MapLibre.

## How it works

1. The browser asks this site's own endpoint, `/api/vehicles`, every ten seconds.
2. The endpoint asks [Entur](https://developer.entur.org), which collects all public transport data
   in Norway, for the vehicles inside the map's area. Entur's API speaks GraphQL, so the request
   names exactly the fields it wants. The answer is cached for ten seconds, so Entur gets the same
   few requests a minute however many people are watching.
3. The map turns the list into GeoJSON and MapLibre draws it.

| File | What it does |
|---|---|
| `app/api/vehicles/route.ts` | The endpoint: asks Entur, trims the answer, caches it |
| `app/_components/BusMap.tsx` | The map: draws it, fetches positions, shows the selected vehicle |
| `lib/areas.ts` | The area the map covers. More areas can be added here |
| `lib/vehicles.ts` | What a vehicle looks like, and how a delay becomes a colour |
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
- Background map: [OpenFreeMap](https://openfreemap.org), © OpenMapTiles, data from OpenStreetMap.
