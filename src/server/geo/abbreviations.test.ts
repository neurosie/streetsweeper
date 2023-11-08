import { expect, test } from "vitest";
import { generateAbbreviations } from "./abbreviations";

test("generateAbbreviations handles suffixes", () => {
  const streetName = "Maple Road";

  const abbreviations = generateAbbreviations(streetName);

  expect(abbreviations).toHaveLength(2);
  expect(abbreviations).toEqual(
    expect.arrayContaining(["maple road", "maple rd"]),
  );
});

test("generateAbbreviations handles directions", () => {
  const streetName = "North Pearl Street";

  const abbreviations = generateAbbreviations(streetName);

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

test("generateAbbreviations handles many directions", () => {
  const streetName = "North Northeast Broadway";

  const abbreviations = generateAbbreviations(streetName);

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
