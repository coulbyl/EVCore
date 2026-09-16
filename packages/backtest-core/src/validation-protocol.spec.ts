import { describe, expect, it, vi } from "vitest";
import {
  isWithinWindow,
  runValidationProtocol,
  type ProtocolWindow,
} from "./validation-protocol";

type Config = { name: string };
type Summary = { samples: number; score: number };

describe("isWithinWindow", () => {
  it("inclut la borne basse et exclut la borne haute", () => {
    const window: ProtocolWindow = { from: "2025-01-01", to: "2026-01-01" };
    expect(isWithinWindow("2025-01-01", window)).toBe(true);
    expect(isWithinWindow("2025-12-31", window)).toBe(true);
    expect(isWithinWindow("2026-01-01", window)).toBe(false);
    expect(isWithinWindow("2024-12-31", window)).toBe(false);
  });

  // La propriété qui compte : aucune journée ne peut servir au choix ET à la
  // validation, sans quoi le protocole ne vaut rien.
  it("ne laisse aucune journée dans les deux fenêtres", () => {
    const split = "2025-01-01";
    for (const day of ["2024-06-30", "2025-01-01", "2025-07-15"]) {
      const inSelection = isWithinWindow(day, { to: split });
      const inValidation = isWithinWindow(day, { from: split });
      expect(inSelection && inValidation).toBe(false);
      expect(inSelection || inValidation).toBe(true);
    }
  });
});

describe("runValidationProtocol", () => {
  const grid: Config[] = [{ name: "a" }, { name: "b" }, { name: "c" }];

  it("choisit sur la sélection et mesure sur la validation", () => {
    const evaluate = vi.fn(
      (config: Config, window: ProtocolWindow): Summary => ({
        samples: 100,
        // « b » est le meilleur en sélection, mais s'effondre en validation.
        score:
          window.to !== undefined
            ? config.name === "b"
              ? 10
              : 1
            : config.name === "b"
              ? -5
              : 0,
      }),
    );
    const outcome = runValidationProtocol<Config, Summary>({
      grid,
      splitDate: "2025-01-01",
      evaluate,
      criterion: (summary) => summary.score,
      isEligible: (summary) => summary.samples >= 50,
    });

    expect(outcome.chosen?.name).toBe("b");
    expect(outcome.selectionSummary?.score).toBe(10);
    expect(outcome.validationSummary?.score).toBe(-5);
    // C'est l'écart entre les deux qui informe : la validation seule aurait
    // laissé croire à un simple mauvais résultat, pas à un effondrement.
    expect(outcome.validationSummary?.score).toBeLessThan(
      outcome.selectionSummary?.score ?? 0,
    );
  });

  it("n'évalue la configuration retenue qu'une fois en validation", () => {
    const calls: ProtocolWindow[] = [];
    runValidationProtocol<Config, Summary>({
      grid,
      splitDate: "2025-01-01",
      evaluate: (_config, window) => {
        calls.push(window);
        return { samples: 100, score: 1 };
      },
      criterion: (summary) => summary.score,
      isEligible: () => true,
    });
    const validationCalls = calls.filter((window) => window.from !== undefined);
    expect(validationCalls).toHaveLength(1);
    expect(calls.filter((window) => window.to !== undefined)).toHaveLength(
      grid.length,
    );
  });

  it("écarte les configurations sous le volume minimal", () => {
    const outcome = runValidationProtocol<Config, Summary>({
      grid,
      splitDate: "2025-01-01",
      evaluate: (config) => ({
        samples: config.name === "a" ? 10 : 200,
        score: config.name === "a" ? 99 : 1,
      }),
      criterion: (summary) => summary.score,
      isEligible: (summary) => summary.samples >= 50,
    });
    // « a » a le meilleur score mais pas le volume : le retenir reviendrait à
    // choisir le bruit le plus fort.
    expect(outcome.chosen?.name).not.toBe("a");
    expect(outcome.configurationsCompared).toBe(2);
  });

  it("chiffre les faux positifs attendus du balayage", () => {
    const outcome = runValidationProtocol<Config, Summary>({
      grid: Array.from({ length: 120 }, (_, index) => ({
        name: String(index),
      })),
      splitDate: "2025-01-01",
      evaluate: () => ({ samples: 100, score: 1 }),
      criterion: (summary) => summary.score,
      isEligible: () => true,
    });
    expect(outcome.configurationsCompared).toBe(120);
    expect(outcome.falsePositivesExpected).toBeCloseTo(3, 5);
  });

  it("ne retient rien quand aucune configuration n'est éligible", () => {
    const outcome = runValidationProtocol<Config, Summary>({
      grid,
      splitDate: "2025-01-01",
      evaluate: () => ({ samples: 1, score: 1 }),
      criterion: (summary) => summary.score,
      isEligible: (summary) => summary.samples >= 50,
    });
    expect(outcome.chosen).toBeNull();
    expect(outcome.validationSummary).toBeNull();
  });
});
