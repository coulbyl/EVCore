import { describe, expect, it } from "vitest";
import { sanitizeReasonText } from "./sanitize-reason";

describe("sanitizeReasonText", () => {
  it("translates market and pick codes to French labels", () => {
    expect(
      sanitizeReasonText("Le pick OVER_UNDER UNDER_2_5 paraît solide."),
    ).toBe("Le pick plus/moins de buts moins de 2,5 buts paraît solide.");
  });

  it("replaces channel names and calibration jargon with plain language", () => {
    expect(
      sanitizeReasonText(
        "Le canal DRAW (calibration 0,65×, n=42) est sur-confiant, tandis que le canal BTTS tient.",
      ),
    ).toBe(
      "nos données internes est sur-confiant, tandis que nos données internes tient.",
    );
  });

  it("drops copied context tags and bare sample sizes", () => {
    expect(
      sanitizeReasonText("marché=BTTS, pick=YES (n=120) reste jouable."),
    ).toBe("les deux équipes marquent, oui reste jouable.");
  });

  it("leaves clean text untouched", () => {
    const clean =
      "Genk ne concède que 1,08 xG à domicile et Kortrijk marque peu à l'extérieur.";
    expect(sanitizeReasonText(clean)).toBe(clean);
  });

  it("never touches words that merely contain a code", () => {
    expect(sanitizeReasonText("Le DRAWING board et HOMEWORK.")).toBe(
      "Le DRAWING board et HOMEWORK.",
    );
  });
});
