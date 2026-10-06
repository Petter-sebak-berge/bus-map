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
    legend: { early: "For tidlig", onTime: "I rute", late: "2–5 min forsinket", veryLate: "Over 5 min forsinket" },
    modes: { BUS: "Buss", FERRY: "Båt", RAIL: "Tog", TRAM: "Trikk", COACH: "Ekspressbuss" },
    towards: "mot",
    delay: {
      early: "{n} min for tidlig",
      onTime: "I rute",
      late: "{n} min forsinket",
      unknown: "Ukjent forsinkelse",
    },
    close: "Lukk",
    style: {
      label: "Kart",
      names: { liberty: "Liberty", bright: "Bright", dark: "Mørkt" },
    },
  },
  credit: { text: "Data gjort tilgjengelig av" },
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
    legend: { early: "Early", onTime: "On time", late: "2–5 min late", veryLate: "Over 5 min late" },
    modes: { BUS: "Bus", FERRY: "Boat", RAIL: "Train", TRAM: "Tram", COACH: "Coach" },
    towards: "towards",
    delay: {
      early: "{n} min early",
      onTime: "On time",
      late: "{n} min late",
      unknown: "Delay unknown",
    },
    close: "Close",
    style: {
      label: "Map",
      names: { liberty: "Liberty", bright: "Bright", dark: "Dark" },
    },
  },
  credit: { text: "Data made available by" },
};

export type Dictionary = typeof no;

const dictionaries: Record<Lang, Dictionary> = { no, en };

export const getDictionary = (lang: Lang) => dictionaries[lang];
