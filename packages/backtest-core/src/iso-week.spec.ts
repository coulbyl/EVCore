import { describe, expect, it } from "vitest";
import { isoWeek } from "./iso-week";

describe("isoWeek", () => {
  // Cas de bascule d'année, où l'année ISO diffère de l'année civile. C'est
  // exactement ce que l'implémentation précédente se trompait — d'une semaine
  // sur toutes les dates.
  it.each([
    ["2026-01-01", "2026-01"],
    ["2025-12-29", "2026-01"],
    ["2024-12-30", "2025-01"],
    ["2021-01-01", "2020-53"],
    ["2020-12-31", "2020-53"],
    ["2023-01-02", "2023-01"],
  ])("place %s en semaine %s", (day, expected) => {
    expect(isoWeek(day)).toBe(expected);
  });

  it("numérote les semaines en milieu d'année", () => {
    expect(isoWeek("2026-09-14")).toBe("2026-38");
    expect(isoWeek("2026-09-21")).toBe("2026-39");
  });

  // La propriété dont dépend l'analyse hebdomadaire : une semaine de paris
  // doit former un seul groupe, du lundi au dimanche.
  it("groupe le lundi et le dimanche d'une même semaine", () => {
    const lundi = isoWeek("2026-09-14");
    for (const day of [
      "2026-09-15",
      "2026-09-16",
      "2026-09-17",
      "2026-09-18",
      "2026-09-19",
      "2026-09-20",
    ]) {
      expect(isoWeek(day)).toBe(lundi);
    }
    expect(isoWeek("2026-09-21")).not.toBe(lundi);
  });

  it("produit une clé triable", () => {
    const weeks = ["2026-09-21", "2026-01-05", "2025-12-29"].map(isoWeek);
    expect([...weeks].sort()).toEqual(["2026-01", "2026-02", "2026-39"]);
  });
});
