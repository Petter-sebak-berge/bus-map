import Image from "next/image";
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
      <BusMap
        areaId="bergen"
        text={text.map}
        footer={
          // Entur's licence asks every site that shows its data to say so, with their logo.
          // The logo file has its own empty space around it, which their rules ask us to keep.
          <a href="https://entur.no" className="mt-2 flex items-center border-t border-white/10 pt-1 text-xs text-muted">
            {text.credit.text}
            <Image src="/entur-logo.svg" alt="Entur" width={112} height={56} unoptimized />
          </a>
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
    </main>
  );
}
