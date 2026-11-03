import { describe, expect, it } from "vitest";
import {
  matchPlayerName,
  normalizePlayerName,
  playerIdOfPick,
  playerPick,
  repairProviderText,
  type SquadCandidate,
} from "./name-matching";

// Real spellings: Bet365 odds of 03/11 (Manchester United – Roma, RB Leipzig
// – Manchester City) against the API-Football squads of the four teams.
const SQUAD: SquadCandidate[] = [
  { playerExternalId: 1, names: ["J. Kamason"] },
  { playerExternalId: 2, names: ["E. Ndicka"] },
  { playerExternalId: 3, names: ["Lisandro Martínez"] },
  { playerExternalId: 4, names: ["T. Fletcher"] },
  { playerExternalId: 5, names: ["J. Fletcher"] },
  { playerExternalId: 6, names: ["M. de Ligt"] },
  { playerExternalId: 7, names: ["Hermoso"] },
  { playerExternalId: 8, names: ["Wesley"] },
  { playerExternalId: 9, names: ["Rômulo"] },
  { playerExternalId: 10, names: ["R. Aït-Nouri"] },
  { playerExternalId: 11, names: ["I. Ndiaye"] },
  { playerExternalId: 12, names: ["A. MaksimoviÄ\u0087"] },
  { playerExternalId: 13, names: ["N. O&apos;Reilly"] },
  { playerExternalId: 14, names: ["Vitor Nunes"] },
  { playerExternalId: 15, names: ["Dermot William Mee"] },
  { playerExternalId: 16, names: ["B. Šeško"] },
  { playerExternalId: 17, names: ["M. Ødegaard", "Martin Ødegaard"] },
  { playerExternalId: 18, names: ["Nicolás González"] },
];

const matched = (name: string, squad = SQUAD) => {
  const result = matchPlayerName(name, squad);
  return result.status === "matched" ? result.playerExternalId : result.status;
};

describe("matchPlayerName", () => {
  it.each([
    ["Jaydan Kamason", 1],
    ["Evan N'Dicka", 2],
    ["Lisandro Martinez", 3],
    ["Tyler Fletcher", 4],
    ["Jack Fletcher", 5],
    ["Matthijs de Ligt", 6],
    ["Mario Hermoso", 7],
    ["Wesley Lima", 8],
    ["Romulo da Cruz", 9],
    ["Rayan Ait Nouri", 10],
    ["Iliman-Cheikh Ndiaye", 11],
    ["Andrija Maksimovic", 12],
    ["Nico O'Reilly", 13],
    ["Dermot Mee", 15],
    ["Benjamin Sesko", 16],
    ["Martin Odegaard", 17],
    ["Nico Gonzalez", 18],
  ])("%s → %i", (name, id) => {
    expect(matched(name)).toBe(id);
  });

  it("leaves a player the squad does not list unmatched", () => {
    expect(matched("Vitor Reis")).toBe("unmatched");
    expect(matched("Lorenzo Paratici")).toBe("unmatched");
  });

  it("an initial shared by two players is ambiguous, never a guess", () => {
    const squad = [
      { playerExternalId: 4, names: ["T. Fletcher"] },
      { playerExternalId: 40, names: ["T. Fletcher"] },
    ];
    expect(matchPlayerName("Tyler Fletcher", squad)).toEqual({
      status: "ambiguous",
      playerExternalIds: [4, 40],
    });
  });

  it("the strict rule decides before a looser one finds more", () => {
    const squad = [
      { playerExternalId: 1, names: ["Bruno Fernandes"] },
      { playerExternalId: 2, names: ["B. Fernandes"] },
    ];
    expect(matched("Bruno Fernandes", squad)).toBe(1);
  });

  it("a surname alone never matches a different first name", () => {
    expect(matched("Kylian Fletcher")).toBe("unmatched");
  });

  it("an empty name matches nobody", () => {
    expect(matched("  ")).toBe("unmatched");
  });
});

describe("normalizePlayerName", () => {
  it("folds accents, special letters, apostrophes and hyphens", () => {
    expect(normalizePlayerName("Martin Ødegaard")).toEqual([
      "martin",
      "odegaard",
    ]);
    expect(normalizePlayerName("Brandon Thomas-Asante")).toEqual([
      "brandon",
      "thomas",
      "asante",
    ]);
    expect(normalizePlayerName("Evan N'Dicka")).toEqual(["evan", "ndicka"]);
  });
});

describe("repairProviderText", () => {
  it("decodes HTML entities and UTF-8 read as Latin-1", () => {
    expect(repairProviderText("N. O&apos;Reilly")).toBe("N. O'Reilly");
    expect(repairProviderText("A. MaksimoviÄ\u0087")).toBe("A. Maksimović");
    expect(repairProviderText("JoÃ£o FÃ©lix")).toBe("João Félix");
  });

  it("leaves clean text alone", () => {
    expect(repairProviderText("Gyökeres")).toBe("Gyökeres");
    expect(repairProviderText("Ødegaard")).toBe("Ødegaard");
  });
});

describe("player picks", () => {
  it("round-trips P<externalId>", () => {
    expect(playerPick(18979)).toBe("P18979");
    expect(playerIdOfPick("P18979")).toBe(18979);
    expect(playerIdOfPick("NONE")).toBeNull();
    expect(playerIdOfPick("P0")).toBeNull();
  });
});
