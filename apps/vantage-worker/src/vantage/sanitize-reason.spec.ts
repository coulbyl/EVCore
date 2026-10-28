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
      "Nos données internes sont sur-confiant, tandis que nos données internes tiennent.",
    );
  });

  it("drops copied context tags and bare sample sizes", () => {
    expect(
      sanitizeReasonText("marché=BTTS, pick=YES (n=120) reste jouable."),
    ).toBe("Les deux équipes marquent, oui reste jouable.");
  });

  it("leaves clean text untouched", () => {
    const clean =
      "Genk ne concède que 1,08 xG à domicile et Kortrijk marque peu à l'extérieur.";
    expect(sanitizeReasonText(clean)).toBe(clean);
  });

  it("agrees the verb after « nos données internes »", () => {
    expect(
      sanitizeReasonText(
        "nos données internes montre une probabilité de 54 % que les deux équipes marquent.",
      ),
    ).toBe(
      "Nos données internes montrent une probabilité de 54 % que les deux équipes marquent.",
    );
  });

  it("drops copied prompt constraints about odds", () => {
    expect(
      sanitizeReasonText(
        "Le marché propose une cote de 1,67, conforme aux contraintes de cote.",
      ),
    ).toBe("Le marché propose une cote de 1,67.");
    expect(
      sanitizeReasonText(
        "Pari intéressant, surtout avec une cote de 1,67 respectant les contraintes de cote.",
      ),
    ).toBe("Pari intéressant, surtout avec une cote de 1,67.");
    expect(
      sanitizeReasonText(
        "Aucun signal ne justifie de choisir un marché dans les contraintes de cote.",
      ),
    ).toBe("Aucun signal ne justifie de choisir un marché.");
  });

  it("says the odds range in plain words when it is the reason to abstain", () => {
    expect(
      sanitizeReasonText("Aucun pari ne satisfait les contraintes de cote."),
    ).toBe("Aucun pari ne satisfait notre fourchette de cote.");
  });

  it("never writes « les lectures de nos lectures »", () => {
    expect(
      sanitizeReasonText(
        "Aucun conflit notable entre les lectures des canaux.",
      ),
    ).toBe("Aucun conflit notable entre nos lectures.");
    expect(
      sanitizeReasonText("Aucun conflit entre les lectures de nos lectures."),
    ).toBe("Aucun conflit entre nos lectures.");
  });

  it("keeps a singular subject singular when a channel follows « signal »", () => {
    expect(
      sanitizeReasonText("Le signal DOMINANT est juste sous le seuil."),
    ).toBe("Un de nos signaux est juste sous le seuil.");
  });

  it("never touches words that merely contain a code", () => {
    expect(sanitizeReasonText("Le DRAWING board et HOMEWORK.")).toBe(
      "Le DRAWING board et HOMEWORK.",
    );
  });
});
