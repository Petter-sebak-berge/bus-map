// Which languages the site exists in, and how to pick one for a visitor.
// "i18n" is the usual shorthand for "internationalization" (18 letters between the i and the n).

export const locales = ["no", "en"] as const;
export type Lang = (typeof locales)[number];

export const hasLocale = (value: string): value is Lang => (locales as readonly string[]).includes(value);

// The code that goes in <html lang="...">. "nb" is Norwegian Bokmål, which is more precise than "no".
export const htmlLang: Record<Lang, string> = { no: "nb", en: "en" };

// Norwegian, Swedish and Danish readers all understand written Norwegian.
const SCANDINAVIAN = ["nb", "nn", "no", "sv", "da"];

// Browsers send an "Accept-Language" header with the visitor's preferred languages, in order,
// e.g. "en-US,en;q=0.9,nb;q=0.8". We show Norwegian if any of them is Scandinavian, or if the
// browser doesn't say. Everyone else gets English.
export function pickLocale(acceptLanguage: string | null): Lang {
  const languages = (acceptLanguage ?? "")
    .split(",")
    .map((entry) => entry.trim().split(";")[0].split("-")[0].toLowerCase()) // "en-US;q=0.9" -> "en"
    .filter((language) => language && language !== "*");

  if (languages.length === 0) return "no";
  return languages.some((language) => SCANDINAVIAN.includes(language)) ? "no" : "en";
}
