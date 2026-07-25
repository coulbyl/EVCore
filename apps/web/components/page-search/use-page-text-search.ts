"use client";

import { useEffect, useRef, useState } from "react";

// Mirrors browser Ctrl+F highlighting via the CSS Custom Highlight API
// (CSS.highlights + Range) instead of mutating the DOM with <mark> tags —
// that would fight React's reconciliation on any re-render while search is
// open. Any element the search must skip (the search bar itself) carries
// data-page-search-ignore.
const MATCH_HIGHLIGHT = "page-search-match";
const ACTIVE_HIGHLIGHT = "page-search-match-active";
const IGNORE_SELECTOR = "[data-page-search-ignore]";
const SKIPPED_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA"]);

function isHighlightApiSupported(): boolean {
  return typeof CSS !== "undefined" && "highlights" in CSS;
}

function collectTextNodes(root: Node): Text[] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = (node as Text).parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      if (SKIPPED_TAGS.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
      if (parent.closest(IGNORE_SELECTOR)) return NodeFilter.FILTER_REJECT;
      if (parent.isContentEditable) return NodeFilter.FILTER_REJECT;
      if (!node.textContent?.trim()) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const nodes: Text[] = [];
  let current = walker.nextNode();
  while (current) {
    nodes.push(current as Text);
    current = walker.nextNode();
  }
  return nodes;
}

function findRanges(query: string): Range[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];

  const ranges: Range[] = [];
  for (const node of collectTextNodes(document.body)) {
    const haystack = (node.textContent ?? "").toLowerCase();
    let from = 0;
    let index = haystack.indexOf(needle, from);
    while (index !== -1) {
      const range = new Range();
      range.setStart(node, index);
      range.setEnd(node, index + needle.length);
      ranges.push(range);
      from = index + needle.length;
      index = haystack.indexOf(needle, from);
    }
  }
  return ranges;
}

function scrollRangeIntoView(range: Range): void {
  const element = range.startContainer.parentElement;
  element?.scrollIntoView({ behavior: "smooth", block: "center" });
}

export function usePageTextSearch(active: boolean) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const rangesRef = useRef<Range[]>([]);
  const [matchCount, setMatchCount] = useState(0);
  const supported = useRef(isHighlightApiSupported());

  // Called directly (never through a state-keyed effect) so every call
  // repaints, even when the active index happens to repeat the same number
  // across two different searches (React would otherwise bail out on an
  // unchanged setState value and leave the highlight stale).
  function applyHighlights(ranges: Range[], index: number) {
    if (!supported.current) return;
    const activeRange = ranges[index];
    const otherRanges = ranges.filter((_, i) => i !== index);

    CSS.highlights.set(MATCH_HIGHLIGHT, new Highlight(...otherRanges));
    CSS.highlights.set(
      ACTIVE_HIGHLIGHT,
      new Highlight(...(activeRange ? [activeRange] : [])),
    );

    if (activeRange) scrollRangeIntoView(activeRange);
  }

  useEffect(() => {
    if (!active || !supported.current) {
      CSS.highlights?.delete(MATCH_HIGHLIGHT);
      CSS.highlights?.delete(ACTIVE_HIGHLIGHT);
      rangesRef.current = [];
      setMatchCount(0);
      setActiveIndex(0);
      return;
    }

    const ranges = findRanges(query);
    rangesRef.current = ranges;
    setMatchCount(ranges.length);
    const nextIndex = ranges.length > 0 ? 0 : -1;
    setActiveIndex(nextIndex);
    applyHighlights(ranges, nextIndex);
  }, [query, active]);

  useEffect(() => {
    return () => {
      CSS.highlights?.delete(MATCH_HIGHLIGHT);
      CSS.highlights?.delete(ACTIVE_HIGHLIGHT);
    };
  }, []);

  function goNext() {
    setActiveIndex((current) => {
      const ranges = rangesRef.current;
      if (ranges.length === 0) return -1;
      const next = (current + 1) % ranges.length;
      applyHighlights(ranges, next);
      return next;
    });
  }

  function goPrev() {
    setActiveIndex((current) => {
      const ranges = rangesRef.current;
      if (ranges.length === 0) return -1;
      const next = (current - 1 + ranges.length) % ranges.length;
      applyHighlights(ranges, next);
      return next;
    });
  }

  return {
    query,
    setQuery,
    matchCount,
    activeIndex,
    goNext,
    goPrev,
    isSupported: supported.current,
  };
}
