import { expect, test } from "vitest";
import { generateAbbreviations } from "./abbreviations";
import { describe } from "node:test";

describe("generateAbbreviations (easy)", () => {
  test("handles suffixes", () => {
    const streetName = "Maple Road";

    const abbreviations = generateAbbreviations(streetName, "easy");

    expect(abbreviations).toHaveLength(3);
    expect(abbreviations).toEqual(
      expect.arrayContaining(["maple", "maple road", "maple rd"]),
    );
  });

  test("handles directions", () => {
    const streetName = "North Pearl Street";

    const abbreviations = generateAbbreviations(streetName, "easy");

    console.log(abbreviations);
    expect(abbreviations).toHaveLength(9);
    expect(abbreviations).toEqual(
      expect.arrayContaining([
        "pearl",
        "north pearl",
        "n pearl",
        "pearl st",
        "pearl street",
        "north pearl street",
        "n pearl street",
        "north pearl st",
        "n pearl st",
      ]),
    );
  });

  test("handles many directions", () => {
    const streetName = "North Northeast Broadway";

    const abbreviations = generateAbbreviations(streetName, "easy");

    expect(abbreviations).toHaveLength(9);
    expect(abbreviations).toEqual(
      expect.arrayContaining([
        "broadway",
        "north broadway",
        "northeast broadway",
        "n northeast broadway",
        "north ne broadway",
        "north northeast broadway",
        "n northeast broadway",
        "north ne broadway",
        "n ne broadway",
      ]),
    );
  });
});

describe("generateAbbreviations (hard)", () => {
  test("handles suffixes", () => {
    const streetName = "Maple Road";

    const abbreviations = generateAbbreviations(streetName, "hard");

    expect(abbreviations).toHaveLength(2);
    expect(abbreviations).toEqual(
      expect.arrayContaining(["maple road", "maple rd"]),
    );
  });

  test("handles directions", () => {
    const streetName = "North Pearl Street";

    const abbreviations = generateAbbreviations(streetName, "hard");

    expect(abbreviations).toHaveLength(4);
    expect(abbreviations).toEqual(
      expect.arrayContaining([
        "north pearl street",
        "n pearl street",
        "north pearl st",
        "n pearl st",
      ]),
    );
  });

  test("handles many directions", () => {
    const streetName = "North Northeast Broadway";

    const abbreviations = generateAbbreviations(streetName, "hard");

    expect(abbreviations).toHaveLength(4);
    expect(abbreviations).toEqual(
      expect.arrayContaining([
        "north northeast broadway",
        "n northeast broadway",
        "north ne broadway",
        "n ne broadway",
      ]),
    );
  });
});
