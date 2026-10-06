import Link from "next/link";
import { notFound } from "next/navigation";
import BusMap from "@/app/_components/BusMap";
import { areas } from "@/lib/areas";
import { getDictionary } from "@/lib/dictionaries";
import { hasLocale } from "@/lib/i18n";

export default async function Page({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const text = getDictionary(lang);
  const otherLang = lang === "no" ? "en" : "no";

  return (
    // The map fills the whole screen ("dvh" is the visible height, also on phones where the
    // address bar comes and goes). Everything else floats on top of it.
    <main className="relative h-dvh overflow-hidden">
      <BusMap areaId="bergen" text={text.map}>
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="text-lg font-semibold">{text.title}</h1>
          <Link href={`/${otherLang}`} className="text-sm text-muted underline-offset-4 hover:underline">
            {text.switchTo}
          </Link>
        </div>
        {/* Entur's licence asks every site that shows its data to say where it comes from. */}
        <p className="text-sm text-muted">
          {areas.bergen.name} · {text.credit.text}{" "}
          <a href="https://entur.no" className="underline underline-offset-2 hover:text-ink">
            Entur
          </a>
        </p>
      </BusMap>
    </main>
  );
}
