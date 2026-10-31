"use client";

import { useEffect, useRef, useState } from "react";

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
  icons,
  labels,
}: {
  listId: string;
  day: string;
  initialQuery: string;
  /** Rendered on the server: lucide stays out of the client bundle (C7). */
  icons: { search: React.ReactNode; close: React.ReactNode };
  labels: {
    open: string;
    close: string;
    placeholder: string;
    /** With `{query}` where the search goes. */
    noResult: string;
  };
}) {
  const [open, setOpen] = useState(initialQuery !== "");
  const [query, setQuery] = useState(initialQuery);
  const openedFold = useRef(false);

  useEffect(() => {
    const list = document.getElementById(listId);
    if (!list) return;
    // searchKey (search-key.ts) inline: the rows' keys are made on the
    // server with it; its module alone weighed on the budget (C7).
    const key = query
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
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
    // A search sent with Enter filtered the server's reads: read the day
    // again, whole. Rare enough for a plain navigation.
    if (initialQuery !== "") {
      window.location.replace(
        day === "today" ? "/matches" : `/matches?day=${day}`,
      );
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        aria-label={labels.open}
        onClick={() => setOpen(true)}
        className="flex size-11 shrink-0 items-center justify-center rounded-full text-band-muted hover:text-band-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-led-on"
      >
        {icons.search}
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
      <span className="shrink-0 text-band-muted">{icons.search}</span>
      <input
        // Opened by a tap on the magnifier: the field takes the keyboard.
        autoFocus={initialQuery === ""}
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
        {icons.close}
      </button>
    </form>
  );
}
