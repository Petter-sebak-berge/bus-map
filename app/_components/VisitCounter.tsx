"use client";
// Counts a visit. It runs in the visitor's browser (hence "use client") and draws nothing.
//
// It sends one small request to a database function, with the site and the page's name (the language
// version). The database adds the day and the country, which its network works out from the connection,
// and adds one to a count. No IP address is stored, no cookie is set, and nothing is kept about a single
// visitor. The note in the panel says the same in plain words.

import { useEffect } from "react";

// The database's address and its publishable key. Both are public by design: the key only allows what
// the database's own access rules allow, and for a visitor that is calling this one function.
const DATABASE_URL = "https://tfamujrsxeugapjnzpgm.supabase.co";
const PUBLISHABLE_KEY = "sb_publishable_ko9pwACsIT2lmQQh1UT7zQ_MKvk7yh9";

export default function VisitCounter({ page }: { page: string }) {
  // useEffect runs after the page is shown, and only in the browser.
  useEffect(() => {
    // Only the live site is counted, not a local copy or a preview.
    if (location.hostname !== "buss.servereniskogen.no") return;
    fetch(`${DATABASE_URL}/rest/v1/rpc/count_visit`, {
      method: "POST",
      keepalive: true, // lets the request finish if the visitor leaves straight away
      headers: {
        "Content-Type": "application/json",
        apikey: PUBLISHABLE_KEY,
        Authorization: `Bearer ${PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ p_site: "bus-map", p_page: page }),
    }).catch(() => {}); // a failed count must never disturb the page
  }, [page]);

  return null;
}
