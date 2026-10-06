// Proxy runs on the server before a page is served. Ours has one job: when someone visits the bare
// address (buss.servereniskogen.no/), send them on to /no or /en depending on their browser's language.

import { NextResponse, type NextRequest } from "next/server";
import { pickLocale } from "./lib/i18n";

export function proxy(request: NextRequest) {
  const locale = pickLocale(request.headers.get("accept-language"));
  const response = NextResponse.redirect(new URL(`/${locale}`, request.url));
  // Tells caches that the answer depends on the visitor's language, so one visitor's redirect
  // is never reused for someone with different settings.
  response.headers.set("Vary", "Accept-Language");
  return response;
}

// Only run for the front door. /no, /en, /api/vehicles and static files skip the proxy entirely.
export const config = { matcher: "/" };
