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
- `app/_components/BusMap.tsx` – the map (MapLibre), the ten-second refresh and the selected-vehicle card.
- `app/api/vehicles/route.ts` – asks Entur's GraphQL API for vehicle positions and caches the answer.
- `lib/areas.ts` – the area the map covers. Nothing else names Bergen or Skyss; keep it that way.
- `lib/vehicles.ts` – the `Vehicle` type shared by server and browser, and delay → colour.

## Worth knowing

- Entur: no key. Every request sends the header `ET-Client-Name: servereniskogen-busmap`. Data is under
  NLOD and must be credited ("Data made available by Entur"); the licence also asks for their logo, which
  is not on the page yet.
- `maxDataAge: "PT2M"` in the query leaves out parked vehicles. Without it, more than half are stale.
- Entur's feed had no Bybanen (light rail) and no Ruter (Oslo) when checked on 6 Oct 2026.
- Entur also offers the positions as a live stream over WebSocket
  (`wss://api.entur.io/realtime/v2/vehicles/subscriptions`). Not used yet.
- The background map is OpenFreeMap's `dark` style; the line numbers use its font `Noto Sans Regular`.
- Fetching stops while the tab is hidden. The preview pane counts as hidden until its tab is fronted.

## Useful commands

- `npm run dev` – start the local dev server at http://localhost:3200
- `npm run build` – build the production version (the same thing Vercel runs)
- `npm run lint` – check the code for common mistakes
