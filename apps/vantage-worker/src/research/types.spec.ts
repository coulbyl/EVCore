import { describe, expect, it } from "vitest";
import { sanitizeCitations } from "./types";

describe("sanitizeCitations", () => {
  it("returns an empty array when results is undefined", () => {
    expect(sanitizeCitations(undefined)).toEqual([]);
  });

  it("keeps a well-formed entry as-is", () => {
    expect(
      sanitizeCitations([{ title: "Team news", url: "https://example.com/a" }]),
    ).toEqual([{ title: "Team news", url: "https://example.com/a" }]);
  });

  it("falls back to 'source' when title is missing or blank", () => {
    expect(sanitizeCitations([{ url: "https://example.com/a" }])).toEqual([
      { title: "source", url: "https://example.com/a" },
    ]);
    expect(
      sanitizeCitations([{ title: "   ", url: "https://example.com/b" }]),
    ).toEqual([{ title: "source", url: "https://example.com/b" }]);
  });

  it("drops entries with no non-empty url", () => {
    expect(sanitizeCitations([{ title: "No url" }, "not an object"])).toEqual(
      [],
    );
  });
});
