import { generateAbbreviations } from "./abbreviations";

describe("generateAbbreviations handles suffixes", () => {
  const streetName = "Maple Road";

  expect(generateAbbreviations(streetName)).toBe(["maple rd"]);
});
