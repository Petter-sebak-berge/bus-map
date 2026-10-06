// Every piece of text on the site, once per language. The page picks the Norwegian or the English
// dictionary and reads from it, so the components contain no language-specific text.
//
// To add text, add it to BOTH languages: TypeScript will complain if the English one is missing
// something the Norwegian one has (see `Dictionary` at the bottom). "{n}" is a placeholder that the
// map replaces with a number.

import type { Lang } from "./i18n";

const no = {
  meta: {
    title: "Hvor er bussen? Bergen i sanntid",
    description: "Et kart som viser hvor bussene i Bergen er akkurat nå, og om de er i rute.",
  },
  title: "Hvor er bussen?",
  // The link to the other language is written in that language, so its readers recognise it.
  switchTo: "English",
  map: {
    label: "Kart over kjøretøy i sanntid",
    loading: "Henter posisjoner …",
    failed: "Får ikke hentet posisjoner akkurat nå. Prøver igjen.",
    count: "{n} kjøretøy i trafikk nå",
    live: "Direkte",
    legend: {
      early: "For tidlig",
      onTime: "I rute",
      late: "2–5 min forsinket",
      veryLate: "Over 5 min forsinket",
      waiting: "Venter på avgang",
    },
    modes: { BUS: "Buss", FERRY: "Båt", RAIL: "Tog", TRAM: "Trikk", COACH: "Ekspressbuss" },
    towards: "mot",
    delay: {
      early: "{n} min for tidlig",
      onTime: "I rute",
      late: "{n} min forsinket",
      unknown: "Ukjent forsinkelse",
      leavesIn: "Går om {n} min",
      waiting: "Venter på avgang",
      finished: "Ferdig med turen",
    },
    close: "Lukk",
    locate: { find: "Vis min posisjon", unavailable: "Posisjonen er ikke tilgjengelig" },
    style: {
      label: "Kart",
      names: { liberty: "Liberty", bright: "Bright", dark: "Mørkt" },
    },
  },
  credit: { text: "Data gjort tilgjengelig av" },
  about: {
    summary: "Om kartet og personvern",
    paragraphs: [
      "Kartet viser hvor bussene, båtene og togene rundt Bergen er akkurat nå, og om de er i rute. Posisjonene kommer fra Entur.",
      "Siden lagrer ingenting om deg og bruker ingen informasjonskapsler.",
      "Nettleseren din henter bakgrunnskartet fra OpenFreeMap og posisjonene direkte fra Entur. Som hos alle nettsteder ser de da IP-adressen din.",
      "Trykker du på posisjonsknappen, brukes posisjonen din bare i nettleseren din for å flytte kartet. Den sendes ikke til noen.",
      "Siden teller besøk per dag, språk og land, for å se om den blir brukt. Tallene lagres hos Supabase i EU. Ingen IP-adresse lagres, og ingen enkeltbesøkende kan kjennes igjen.",
    ],
    contact: "Kontakt",
    source: "Kildekode",
    madeBy: "Laget av",
  },
};

const en: Dictionary = {
  meta: {
    title: "Where's the bus? Bergen, live",
    description: "A map that shows where the buses in Bergen are right now, and whether they are on time.",
  },
  title: "Where's the bus?",
  switchTo: "Norsk",
  map: {
    label: "Live map of vehicles",
    loading: "Fetching positions …",
    failed: "Can't fetch positions right now. Trying again.",
    count: "{n} vehicles on the road now",
    live: "Live",
    legend: {
      early: "Early",
      onTime: "On time",
      late: "2–5 min late",
      veryLate: "Over 5 min late",
      waiting: "Waiting to depart",
    },
    modes: { BUS: "Bus", FERRY: "Boat", RAIL: "Train", TRAM: "Tram", COACH: "Coach" },
    towards: "towards",
    delay: {
      early: "{n} min early",
      onTime: "On time",
      late: "{n} min late",
      unknown: "Delay unknown",
      leavesIn: "Leaves in {n} min",
      waiting: "Waiting to depart",
      finished: "Trip finished",
    },
    close: "Close",
    locate: { find: "Show my location", unavailable: "Location not available" },
    style: {
      label: "Map",
      names: { liberty: "Liberty", bright: "Bright", dark: "Dark" },
    },
  },
  credit: { text: "Data made available by" },
  about: {
    summary: "About the map and privacy",
    paragraphs: [
      "The map shows where the buses, boats and trains around Bergen are right now, and whether they are on time. The positions come from Entur.",
      "The site stores nothing about you and uses no cookies.",
      "Your browser fetches the background map from OpenFreeMap and the positions straight from Entur. As with any website, they then see your IP address.",
      "If you press the location button, your position is used only in your browser to move the map. It is not sent to anyone.",
      "The site counts visits per day, language and country, to see whether it is used. The counts are stored with Supabase in the EU. No IP address is stored, and no single visitor can be recognised.",
    ],
    contact: "Contact",
    source: "Source code",
    madeBy: "Made by",
  },
};

export type Dictionary = typeof no;

const dictionaries: Record<Lang, Dictionary> = { no, en };

export const getDictionary = (lang: Lang) => dictionaries[lang];
