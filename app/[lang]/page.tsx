import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import BusMap from "@/app/_components/BusMap";
import VisitCounter from "@/app/_components/VisitCounter";
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
      <BusMap
        areaId="bergen"
        text={text.map}
        footer={
          // Entur's licence asks every site that shows its data to say so, with their logo.
          // The logo file has its own empty space around it, which their rules ask us to keep.
          <>
            <a href="https://entur.no" className="mt-2 flex items-center border-t border-white/10 pt-1 text-xs text-muted">
              {text.credit.text}
              <Image src="/entur-logo.svg" alt="Entur" width={112} height={56} unoptimized />
            </a>
            {/* <details> is a built-in fold-out: the summary is always shown, the rest on a click. */}
            <details className="text-xs text-muted">
              <summary className="cursor-pointer hover:text-ink">{text.about.summary}</summary>
              {text.about.paragraphs.map((paragraph) => (
                <p key={paragraph} className="mt-2 leading-5">
                  {paragraph}
                </p>
              ))}
              <p className="mt-2 leading-5">
                {text.about.contact}:{" "}
                <a href="mailto:post@servereniskogen.no" className="underline underline-offset-2 hover:text-ink">
                  post@servereniskogen.no
                </a>
                <br />
                {text.about.source}:{" "}
                <a href="https://github.com/Petter-sebak-berge/bus-map" className="underline underline-offset-2 hover:text-ink">
                  GitHub
                </a>
                <br />
                {text.about.madeBy}{" "}
                <a href={`https://www.servereniskogen.no/${lang}`} className="underline underline-offset-2 hover:text-ink">
                  Petter Sebak Berge
                </a>
              </p>
            </details>
          </>
        }
      >
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="text-lg font-semibold">{text.title}</h1>
          <Link href={`/${otherLang}`} className="text-sm text-muted underline-offset-4 hover:underline">
            {text.switchTo}
          </Link>
        </div>
        <p className="text-sm text-muted">{areas.bergen.name}</p>
      </BusMap>
      <VisitCounter page={lang} />
    </main>
  );
}
