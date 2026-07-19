import { expect, test, describe, vi } from "vitest";
import { matchStateQuery, parseSearchQuery } from "./search";
import type { PlaceResult } from "./search";
import type { CityData } from "~/server/cities";

const MOCK_CITIES: CityData[] = [
  {
    name: "New York",
    state: "New York",
    stateId: "NY",
    county: "New York County",
    population: 8336817,
    osmId: 175905,
    osmType: "relation",
    displayName: "New York, NY",
  },
  {
    name: "Los Angeles",
    state: "California",
    stateId: "CA",
    county: "Los Angeles County",
    population: 3979576,
    osmId: 207359,
    osmType: "relation",
    displayName: "Los Angeles, CA",
  },
  {
    name: "Chicago",
    state: "Illinois",
    stateId: "IL",
    county: "Cook County",
    population: 2693976,
    osmId: 122604,
    osmType: "relation",
    displayName: "Chicago, IL",
  },
  {
    name: "Troy",
    state: "New York",
    stateId: "NY",
    county: "Rensselaer County",
    population: 50129,
    osmId: 175906,
    osmType: "relation",
    displayName: "Troy, NY",
  },
  {
    name: "Troy",
    state: "Michigan",
    stateId: "MI",
    county: "Oakland County",
    population: 87294,
    osmId: 175907,
    osmType: "relation",
    displayName: "Troy, MI",
  },
  {
    name: "Troy",
    state: "Alabama",
    stateId: "AL",
    county: "Pike County",
    population: 18033,
    osmId: 175908,
    osmType: "relation",
    displayName: "Troy, AL",
  },
  {
    name: "Portland",
    state: "Oregon",
    stateId: "OR",
    county: "Multnomah County",
    population: 652503,
    osmId: 186579,
    osmType: "relation",
    displayName: "Portland, OR",
  },
  {
    name: "Portland",
    state: "Maine",
    stateId: "ME",
    county: "Cumberland County",
    population: 68408,
    osmId: 186580,
    osmType: "relation",
    displayName: "Portland, ME",
  },
  {
    name: "Springfield",
    state: "Illinois",
    stateId: "IL",
    county: "Sangamon County",
    population: 114394,
    osmId: 128271,
    osmType: "relation",
    displayName: "Springfield, IL",
  },
  {
    name: "Springfield",
    state: "Massachusetts",
    stateId: "MA",
    county: "Hampden County",
    population: 155929,
    osmId: 128272,
    osmType: "relation",
    displayName: "Springfield, MA",
  },
  {
    name: "Springfield",
    state: "Missouri",
    stateId: "MO",
    county: "Greene County",
    population: 169176,
    osmId: 128273,
    osmType: "relation",
    displayName: "Springfield, MO",
  },
  {
    name: "Albany",
    state: "New York",
    stateId: "NY",
    county: "Albany County",
    population: 99224,
    osmId: 175909,
    osmType: "relation",
    displayName: "Albany, NY",
  },
  {
    name: "Spring Mesa",
    state: "Arizona",
    stateId: "AZ",
    county: "Maricopa County",
    population: 25000,
    osmId: 999999,
    osmType: "relation",
    displayName: "Spring Mesa, AZ",
  },
];

// Helper to call the search router with fresh module state
async function searchWithFreshModule(
  query: string,
  cities: CityData[],
): Promise<PlaceResult[]> {
  // Reset modules to clear the cache, then dynamically import
  vi.resetModules();
  vi.doMock("~/server/cities", () => ({
    loadCities: () => cities,
  }));
  const { searchRouter } = await import("./search");

  const result = await searchRouter({
    ctx: {} as never,
    input: { query },
    type: "query",
    path: "search",
    rawInput: { query },
  });
  return result as PlaceResult[];
}

describe("searchRouter", () => {
  test("returns empty array for empty query", async () => {
    const results = await searchWithFreshModule("", MOCK_CITIES);
    expect(results).toEqual([]);
  });

  test("finds exact city name match", async () => {
    const results = await searchWithFreshModule("Chicago", MOCK_CITIES);

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.name).toBe("Chicago");
    expect(results[0]?.state).toBe("Illinois");
  });

  test("finds fuzzy matches for city names", async () => {
    const results = await searchWithFreshModule("Chcago", MOCK_CITIES); // typo

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.name).toBe("Chicago");
  });

  test("returns multiple cities with same name", async () => {
    const results = await searchWithFreshModule("Troy", MOCK_CITIES);

    expect(results.length).toBe(3);
    const names = results.map((r) => r.name);
    expect(names.every((n) => n === "Troy")).toBe(true);
  });

  test("ranks by population when multiple matches exist", async () => {
    const results = await searchWithFreshModule("Troy", MOCK_CITIES);

    // Troy, MI (87294) should come before Troy, NY (50129) and Troy, AL (18033)
    expect(results[0]?.stateId).toBe("MI");
    expect(results[1]?.stateId).toBe("NY");
    expect(results[2]?.stateId).toBe("AL");
  });

  test("short queries use prefix matching", async () => {
    const results = await searchWithFreshModule("Ne", MOCK_CITIES);

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.name).toBe("New York");
  });

  test("limits results to 10", async () => {
    const manyCities: CityData[] = [];
    for (let i = 0; i < 20; i++) {
      manyCities.push({
        name: `Testville${i}`,
        state: "Test State",
        stateId: "TS",
        county: null,
        population: 1000 + i,
        osmId: 1000 + i,
        osmType: "relation",
        displayName: `Testville${i}, TS`,
      });
    }

    const results = await searchWithFreshModule("Testville", manyCities);
    expect(results.length).toBe(10);
  });

  test("returns PlaceResult format with correct fields", async () => {
    const results = await searchWithFreshModule("Albany", MOCK_CITIES);

    expect(results.length).toBeGreaterThan(0);
    const result = results[0]!;

    expect(result).toHaveProperty("osmType");
    expect(result).toHaveProperty("osmId");
    expect(result).toHaveProperty("name");
    expect(result).toHaveProperty("state");
    expect(result).toHaveProperty("stateId");
    expect(result).toHaveProperty("displayName");

    expect(typeof result.osmId).toBe("number");
    expect(result.name).toBe("Albany");
  });

  test("osmId is a number", async () => {
    const results = await searchWithFreshModule("Albany", MOCK_CITIES);

    expect(results[0]?.osmId).toBe(175909);
  });

  test("handles county being null", async () => {
    const citiesWithNullCounty: CityData[] = [
      {
        name: "Test City",
        state: "Test State",
        stateId: "TS",
        county: null,
        population: 10000,
        osmId: 999,
        osmType: "relation",
        displayName: "Test City, TS",
      },
    ];

    const results = await searchWithFreshModule("Test City", citiesWithNullCounty);

    expect(results.length).toBe(1);
    expect(results[0]?.county).toBeUndefined();
  });
});

describe("matchStateQuery", () => {
  test("matches exact state abbreviation (uppercase)", () => {
    expect(matchStateQuery("NY")).toBe("NY");
    expect(matchStateQuery("CA")).toBe("CA");
    expect(matchStateQuery("ME")).toBe("ME");
  });

  test("matches state abbreviation case-insensitively", () => {
    expect(matchStateQuery("ny")).toBe("NY");
    expect(matchStateQuery("Ny")).toBe("NY");
    expect(matchStateQuery("ca")).toBe("CA");
  });

  test("matches full state name", () => {
    expect(matchStateQuery("New York")).toBe("NY");
    expect(matchStateQuery("California")).toBe("CA");
    expect(matchStateQuery("Massachusetts")).toBe("MA");
  });

  test("matches state name prefix (substring)", () => {
    expect(matchStateQuery("mass")).toBe("MA");
    expect(matchStateQuery("Mass")).toBe("MA");
    expect(matchStateQuery("calif")).toBe("CA");
    expect(matchStateQuery("Mich")).toBe("MI");
    expect(matchStateQuery("ore")).toBe("OR");
  });

  test("returns null for non-matching strings", () => {
    expect(matchStateQuery("xyz")).toBeNull();
    expect(matchStateQuery("")).toBeNull();
    expect(matchStateQuery("   ")).toBeNull();
  });

  test("handles whitespace", () => {
    expect(matchStateQuery("  ny  ")).toBe("NY");
    expect(matchStateQuery(" Massachusetts ")).toBe("MA");
  });
});

describe("parseSearchQuery", () => {
  test("parses comma-separated city and state abbreviation", () => {
    const result = parseSearchQuery("troy, ny");
    expect(result.cityQuery).toBe("troy");
    expect(result.stateHint).toBe("NY");
  });

  test("parses comma-separated city and full state name", () => {
    const result = parseSearchQuery("portland, maine");
    expect(result.cityQuery).toBe("portland");
    expect(result.stateHint).toBe("ME");
  });

  test("parses space-separated city and state abbreviation", () => {
    const result = parseSearchQuery("portland me");
    expect(result.cityQuery).toBe("portland");
    expect(result.stateHint).toBe("ME");
  });

  test("parses space-separated city and state prefix", () => {
    const result = parseSearchQuery("springfield mass");
    expect(result.cityQuery).toBe("springfield");
    expect(result.stateHint).toBe("MA");
  });

  test("returns null stateHint for city-only queries", () => {
    const result = parseSearchQuery("chicago");
    expect(result.cityQuery).toBe("chicago");
    expect(result.stateHint).toBeNull();
  });

  test("handles multi-word city names with state", () => {
    const result = parseSearchQuery("new york ny");
    expect(result.cityQuery).toBe("new york");
    expect(result.stateHint).toBe("NY");
  });

  test("handles multi-word city names without state", () => {
    const result = parseSearchQuery("los angeles");
    expect(result.cityQuery).toBe("los angeles");
    expect(result.stateHint).toBeNull();
  });

  test("does not match non-state words as states", () => {
    const result = parseSearchQuery("troy city");
    expect(result.cityQuery).toBe("troy city");
    expect(result.stateHint).toBeNull();
  });
});

describe("searchRouter with state hints (ranking boost)", () => {
  test("state hint boosts matching state to top", async () => {
    // Troy, NY has lower population than Troy, MI
    // But with NY hint, Troy, NY should rank first
    const results = await searchWithFreshModule("troy, ny", MOCK_CITIES);

    expect(results.length).toBe(3); // All Troys still returned
    expect(results[0]?.stateId).toBe("NY"); // NY boosted to top
  });

  test("state hint with space format boosts matching state", async () => {
    // Portland, OR has higher population than Portland, ME
    // With ME hint, Portland, ME should rank first
    const results = await searchWithFreshModule("portland me", MOCK_CITIES);

    expect(results.length).toBe(2); // Both Portlands returned
    expect(results[0]?.stateId).toBe("ME"); // ME boosted to top
  });

  test("state hint with name prefix boosts matching state", async () => {
    // Springfield, MO (169176) > MA (155929) > IL (114394) by population
    // With "mass" hint, Springfield, MA should rank first
    // Spring Mesa, AZ is too weak a match for "springfield" to clear the
    // fuzziness threshold, so only the 3 Springfields come back
    const results = await searchWithFreshModule("springfield mass", MOCK_CITIES);

    expect(results.length).toBe(3);
    expect(results[0]?.stateId).toBe("MA"); // MA boosted to top
  });

  test("non-matching state hint still returns results", async () => {
    // No Troy in TX, but search should still return all Troys
    const results = await searchWithFreshModule("troy, tx", MOCK_CITIES);

    expect(results.length).toBe(3); // All Troys returned (no hard filter)
    // Results ordered by population since no state matches the hint
    expect(results[0]?.stateId).toBe("MI");
  });

  test("state hint is case-insensitive", async () => {
    const results = await searchWithFreshModule("Troy, NY", MOCK_CITIES);

    expect(results[0]?.stateId).toBe("NY");
  });

  test("searches without state hint when no state detected", async () => {
    const results = await searchWithFreshModule("troy", MOCK_CITIES);

    // Returns all 3 Troys, ordered by population
    expect(results.length).toBe(3);
    expect(results[0]?.stateId).toBe("MI"); // Highest population
  });

  test("state hint for Oregon works correctly", async () => {
    const results = await searchWithFreshModule("portland or", MOCK_CITIES);

    expect(results.length).toBe(2);
    expect(results[0]?.stateId).toBe("OR"); // OR boosted to top
  });

  test("full state name hint works", async () => {
    // Spring Mesa, AZ is too weak a match for "springfield" to clear the
    // fuzziness threshold, so only the 3 Springfields come back
    const results = await searchWithFreshModule("springfield, illinois", MOCK_CITIES);

    expect(results.length).toBe(3);
    expect(results[0]?.stateId).toBe("IL"); // IL boosted to top
  });

  test("ambiguous query does not filter out valid cities", async () => {
    // "spring me" could be looking for "Spring Mesa, AZ" but "me" matches Maine
    // The state hint should boost Maine cities but not filter out Arizona
    const results = await searchWithFreshModule("spring me", MOCK_CITIES);

    // Should find Spring Mesa, AZ and potentially Springfield cities
    const springMesa = results.find((r) => r.name === "Spring Mesa");
    expect(springMesa).toBeDefined();
  });
});
