@AGENTS.md

# Bus map project ("Hvor er bussen?" / "Where's the bus?")

A live map of public transport around Bergen, built with Next.js (App Router) + TypeScript + Tailwind CSS
and MapLibre. Planned address: https://buss.servereniskogen.no.

This repository is public. Nothing personal or private belongs in it, including in commit messages.

How to work with me and the rules shared by all my projects are kept in a private overview file outside this
repository, which Claude reads automatically. They are kept only there; don't copy them here.

## Where things are

- `app/[lang]/page.tsx` – the page, at `/no` and `/en`. `lib/dictionaries.ts` holds all text in both languages.
- `proxy.ts` and `lib/i18n.ts` – redirect `/` by the browser's language.
- `app/_components/BusMap.tsx` – the map (MapLibre), the gliding dots and the selected-vehicle card.
- `app/_components/useVehicles.ts` – where positions come from: a snapshot from `/api/vehicles`, then Entur's
  live stream over WebSocket straight from the browser, with the snapshot every ten seconds as fallback.
- `app/api/vehicles/route.ts` – asks Entur's GraphQL API for vehicle positions and caches the answer.
- `lib/areas.ts` – the area the map covers. Nothing else names Bergen or Skyss; keep it that way.
- `lib/mapStyles.ts` – the background maps to choose between.
- `lib/vehicles.ts` – the `Vehicle` type, the list of fields asked of Entur and the conversion from Entur's
  shape, all shared by server and browser; and status → colour.

## Worth knowing

- Privacy: the fold-out note in the panel (`about` in `lib/dictionaries.ts`) lists every outside request the
  page makes. A new outside request, or anything stored about a visitor, must be added there in both languages.
- Visits are counted by `app/_components/VisitCounter.tsx` (site id `bus-map`), only on the live address.

- Entur: no key. Every request sends the header `ET-Client-Name: servereniskogen-busmap`. Data is under
  NLOD and must be credited with the text "Data made available by Entur" and their logo. The logo is
  `public/entur-logo.svg`, the white version for dark backgrounds, unchanged from Entur's logo package at
  linje.entur.no. Their rules: at least 20 pixels high, keep the empty space around it.
- `maxDataAge: "PT2M"` in the query leaves out parked vehicles. Without it, more than half are stale.
- Entur's feed had no Bybanen (light rail) and no Ruter (Oslo) when checked on 6 Oct 2026.
- The live stream is `wss://api.entur.io/realtime/v2/vehicles/subscriptions`, protocol `graphql-transport-ws`
  (the older `graphql-ws` is refused with "Invalid message"). Its first message is every vehicle Entur knows
  in the box, stale ones included; `useVehicles` drops those by age. A browser cannot send the
  `ET-Client-Name` header on a WebSocket, so the stream is unidentified; Entur says unidentified clients may be
  rate-limited. It worked without the header on 6 Oct 2026.
- A vehicle's delay only means early or late while it is on a trip (`IN_PROGRESS`). At `AT_ORIGIN` or
  `ASSIGNED` it waits at its first stop and a negative delay is the time until departure; about a third of
  all vehicles are in that state. They are drawn grey.
- The background maps are listed in `lib/mapStyles.ts` and picked in the top panel: three OpenFreeMap styles
  (Liberty is the default). Changing background redraws the map. The line numbers use the font
  `Noto Sans Regular`, which all three styles have. Kartverket's map and satellite pictures were tried and dropped.
- Norwegian aerial photos (Norge i bilder) are not open: Kartverket closed the open service.
- Fetching and the stream stop while the tab is hidden. The preview pane counts as hidden until its tab is fronted.

## Useful commands

- `npm run dev` – start the local dev server at http://localhost:3200
- `npm run build` – build the production version (the same thing Vercel runs)
- `npm run lint` – check the code for common mistakes
