// The preview picture shown when the link is pasted on LinkedIn, in a chat or in a text message.
// Next.js builds it from this file, once per language, and adds the tags that tell other sites
// where to find it ("Open Graph" is the name of that standard, hence the file name).
//
// It is drawn with code instead of being a photo of the real map, so it stays sharp, needs no
// map data, and can carry the title in the right language. Only simple layout works here: every
// box with more than one thing in it must say `display: "flex"`.

import { ImageResponse } from "next/og";
import { getDictionary } from "@/lib/dictionaries";
import { hasLocale } from "@/lib/i18n";
import { statusColors, type Status } from "@/lib/vehicles";

export const alt = "Hvor er bussen? / Where's the bus?";
export const size = { width: 1200, height: 630 }; // the size the sharing sites ask for
export const contentType = "image/png";

const BG = "#0a100e";

// The made-up buses in the picture: where they are, the way they point (degrees, 0 is up),
// their line number and their colour.
const BUSES: { x: number; y: number; turn: number; line: string; status: Status }[] = [
  { x: 790, y: 121, turn: 95, line: "3", status: "onTime" },
  { x: 800, y: 250, turn: 200, line: "10", status: "late" },
  { x: 990, y: 104, turn: 265, line: "4", status: "onTime" },
  { x: 1090, y: 312, turn: 100, line: "5", status: "veryLate" },
  { x: 720, y: 420, turn: 25, line: "12", status: "onTime" },
  { x: 900, y: 538, turn: 85, line: "6", status: "early" },
  { x: 1080, y: 535, turn: 268, line: "2", status: "waiting" },
];

export default async function Image({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const text = getDictionary(hasLocale(lang) ? lang : "no");

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: BG, color: "#e8ede8" }}>
        {/* The drawn map: sea, a few roads, one route in purple, and the pointer of each bus. */}
        <svg width="1200" height="630" viewBox="0 0 1200 630" style={{ position: "absolute", left: 0, top: 0 }}>
          <rect width="1200" height="630" fill="#131c18" />
          <path d="M520 0 C600 120 560 220 660 300 C740 360 700 480 620 630 L1200 630 L1200 0 Z" fill="#17231e" />
          <path d="M860 330 C920 300 1000 320 1010 380 C1020 440 940 470 880 440 C830 415 820 350 860 330 Z" fill="#10283a" />
          <g fill="none" stroke="#34463d" strokeWidth="14" strokeLinecap="round">
            <path d="M560 60 C700 140 820 120 1200 90" />
            <path d="M600 630 C680 480 760 380 800 250 C830 160 900 120 1000 0" />
            <path d="M660 300 C800 300 900 250 1200 330" />
            <path d="M700 520 C840 560 980 520 1200 560" />
          </g>
          <path
            d="M600 630 C680 480 760 380 800 250 C830 160 900 120 1000 0"
            fill="none"
            stroke="#7c3aed"
            strokeWidth="8"
            strokeLinecap="round"
          />
          {BUSES.map((bus) => (
            <path
              key={bus.line}
              d="M0 -46 L20 0 L-20 0 Z"
              fill="#e8ede8"
              transform={`translate(${bus.x} ${bus.y}) rotate(${bus.turn})`}
            />
          ))}
        </svg>

        {/* Each bus is a round box with its line number, placed on top of its pointer. */}
        {BUSES.map((bus) => (
          <div
            key={bus.line}
            style={{
              position: "absolute",
              left: bus.x - 29,
              top: bus.y - 29,
              width: 58,
              height: 58,
              borderRadius: 29,
              border: "4px solid #e8ede8",
              background: statusColors[bus.status],
              color: BG,
              fontSize: 26,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {bus.line}
          </div>
        ))}

        {/* A dark fade from the left, so the words are easy to read on top of the map. */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: 760,
            height: 630,
            display: "flex",
            background: `linear-gradient(to right, ${BG} 0%, ${BG} 62%, rgba(10,16,14,0) 100%)`,
          }}
        />

        <div style={{ position: "absolute", left: 70, top: 0, width: 560, height: 630, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ display: "flex", alignItems: "center", fontSize: 26, color: "#93a39b" }}>
            <div style={{ width: 14, height: 14, borderRadius: 7, background: statusColors.onTime, marginRight: 12 }} />
            {text.map.live} · Bergen
          </div>
          <div style={{ display: "flex", fontSize: 84, fontWeight: 700, lineHeight: 1.05, marginTop: 18 }}>{text.title}</div>
          <div style={{ display: "flex", fontSize: 32, lineHeight: 1.35, color: "#c5cfc9", marginTop: 26 }}>
            {text.meta.description}
          </div>
          <div style={{ display: "flex", fontSize: 26, color: "#93a39b", marginTop: 44 }}>buss.servereniskogen.no</div>
        </div>
      </div>
    ),
    size,
  );
}
