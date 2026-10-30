"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { searchKey } from "./search-key";

/**
 * The team search of Matchs (06 § 1, § 5): the magnifier in the band opens a
 * field that filters the day's list while typing. The list is already
 * rendered by the server: the box only hides the rows whose teams do not
 * match (`data-search`), the hour groups left empty, and says so when
 * nothing is left (« Aucun match pour « Asec » aujourd'hui »). Enter sends
 * the same search to the server (`?q=`), which filters the day's reads.
 */
export function SearchBox({
  listId,
  day,
  initialQuery,
  labels,
}: {
  listId: string;
  day: string;
  initialQuery: string;
  labels: {
    open: string;
    close: string;
    placeholder: string;
    /** With `{query}` where the search goes. */
    noResult: string;
  };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(initialQuery !== "");
  const [query, setQuery] = useState(initialQuery);
  const input = useRef<HTMLInputElement>(null);
  const openedFold = useRef(false);

  useEffect(() => {
    const list = document.getElementById(listId);
    if (!list) return;
    const key = searchKey(query);
    let shown = 0;
    for (const row of list.querySelectorAll<HTMLElement>("[data-search]")) {
      const match = key === "" || (row.dataset.search ?? "").includes(key);
      row.hidden = !match;
      if (match) shown += 1;
    }
    for (const group of list.querySelectorAll<HTMLElement>("[data-group]")) {
      group.hidden = !group.querySelector("[data-search]:not([hidden])");
    }
    const fold = list.querySelector<HTMLDetailsElement>("details");
    if (fold) {
      fold.hidden = !fold.querySelector("[data-search]:not([hidden])");
      // Its count no longer holds while searching: the rows found show alone.
      const summary = fold.querySelector("summary");
      if (summary) summary.hidden = key !== "";
      // A team found among the matches without a reading is shown at once;
      // the fold closes again with the search if the search opened it.
      if (key !== "" && !fold.open) {
        fold.open = true;
        openedFold.current = true;
      } else if (key === "" && openedFold.current) {
        fold.open = false;
        openedFold.current = false;
      }
    }
    const empty = list.querySelector<HTMLElement>("[data-search-empty]");
    if (empty) {
      empty.hidden = key === "" || shown > 0;
      empty.textContent = labels.noResult.replace("{query}", query.trim());
    }
  }, [listId, query, labels.noResult]);

  function close() {
    setQuery("");
    setOpen(false);
    if (initialQuery !== "") {
      router.replace(day === "today" ? "/matches" : `/matches?day=${day}`);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        aria-label={labels.open}
        onClick={() => {
          setOpen(true);
          requestAnimationFrame(() => input.current?.focus());
        }}
        className="flex size-11 shrink-0 items-center justify-center rounded-full text-band-muted hover:text-band-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-led-on"
      >
        <Search aria-hidden strokeWidth={2} className="size-5" />
      </button>
    );
  }

  return (
    <form
      role="search"
      action="/matches"
      method="get"
      className="flex basis-full items-center gap-2 rounded-full bg-band-foreground/10 ps-4"
    >
      {day !== "today" ? <input type="hidden" name="day" value={day} /> : null}
      <Search
        aria-hidden
        strokeWidth={2}
        className="size-5 shrink-0 text-band-muted"
      />
      <input
        ref={input}
        type="search"
        name="q"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") close();
        }}
        placeholder={labels.placeholder}
        aria-label={labels.placeholder}
        maxLength={40}
        autoComplete="off"
        className="min-h-11 min-w-0 flex-1 bg-transparent text-body text-band-foreground placeholder:text-band-muted focus:outline-none [&::-webkit-search-cancel-button]:hidden"
      />
      <button
        type="button"
        aria-label={labels.close}
        onClick={close}
        className="flex size-11 shrink-0 items-center justify-center rounded-full text-band-muted hover:text-band-foreground focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-led-on"
      >
        <X aria-hidden strokeWidth={2} className="size-5" />
      </button>
    </form>
  );
}
