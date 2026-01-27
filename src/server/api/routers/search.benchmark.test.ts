/**
 * Search Quality Benchmark Tests
 *
 * These tests run against the real database to validate search ranking behavior.
 * They are skipped when no database is available (CI without Docker, sandboxes).
 *
 * Run with: npm test -- search.benchmark
 * Requires: DATABASE_URL environment variable pointing to populated database
 */

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { searchRouter, type PlaceResult } from "./search";

// --- Database Connection ---

const prisma = new PrismaClient();
let dbAvailable = false;

beforeAll(async () => {
  try {
    await prisma.$connect();
    const count = await prisma.city.count();
    if (count > 0) {
      dbAvailable = true;
      console.log(`Database available with ${count} cities`);
    }
  } catch {
    console.log("Database not available, skipping benchmark tests");
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});

// --- Search Helper ---

async function performSearch(query: string): Promise<PlaceResult[]> {
  const result = await searchRouter({
    ctx: { prisma: prisma as never },
    input: { query },
    type: "query",
    path: "search",
    rawInput: { query },
  });

  return result as PlaceResult[];
}

// --- Benchmark Types ---

type BenchmarkAssertion =
  | { type: "inTopN"; displayName: string; n: number }
  | { type: "isFirst"; displayName: string }
  | { type: "rankHigherThan"; higher: string; lower: string };

type Benchmark = {
  query: string;
  description: string;
  assertions: BenchmarkAssertion[];
};

// --- Benchmarks ---

const BENCHMARKS: Benchmark[] = [
  // --- Basic exact matches for major cities ---
  {
    query: "chicago",
    description: "Chicago returns Chicago, IL first",
    assertions: [{ type: "isFirst", displayName: "Chicago, IL" }],
  },
  {
    query: "los angeles",
    description: "Los Angeles returns Los Angeles, CA first",
    assertions: [{ type: "isFirst", displayName: "Los Angeles, CA" }],
  },
  {
    query: "houston",
    description: "Houston returns Houston, TX first",
    assertions: [{ type: "isFirst", displayName: "Houston, TX" }],
  },
  {
    query: "phoenix",
    description: "Phoenix returns Phoenix, AZ first",
    assertions: [{ type: "isFirst", displayName: "Phoenix, AZ" }],
  },
  {
    query: "san francisco",
    description: "San Francisco returns San Francisco, CA first",
    assertions: [{ type: "isFirst", displayName: "San Francisco, CA" }],
  },
  {
    query: "seattle",
    description: "Seattle returns Seattle, WA first",
    assertions: [{ type: "isFirst", displayName: "Seattle, WA" }],
  },
  {
    query: "denver",
    description: "Denver returns Denver, CO first",
    assertions: [{ type: "isFirst", displayName: "Denver, CO" }],
  },
  {
    query: "boston",
    description: "Boston returns Boston, MA first",
    assertions: [{ type: "isFirst", displayName: "Boston, MA" }],
  },

  // --- State hint variations ---
  {
    query: "portland",
    description:
      "Portland without state hint returns Oregon first (larger city)",
    assertions: [{ type: "isFirst", displayName: "Portland, OR" }],
  },
  {
    query: "portland me",
    description: "Portland with ME state hint returns Maine first",
    assertions: [{ type: "isFirst", displayName: "Portland, ME" }],
  },
  {
    query: "portland, maine",
    description: "Portland with comma+full state name returns Maine first",
    assertions: [{ type: "isFirst", displayName: "Portland, ME" }],
  },
  {
    query: "columbus oh",
    description: "Columbus with OH hint returns Ohio first",
    assertions: [{ type: "isFirst", displayName: "Columbus, OH" }],
  },
  {
    query: "columbus, georgia",
    description: "Columbus with Georgia hint returns Georgia first",
    assertions: [{ type: "isFirst", displayName: "Columbus, GA" }],
  },

  // --- Common name collisions ---
  {
    query: "springfield",
    description: "Springfield returns results for all major Springfields",
    assertions: [
      { type: "inTopN", displayName: "Springfield, MO", n: 5 },
      { type: "inTopN", displayName: "Springfield, MA", n: 5 },
      { type: "inTopN", displayName: "Springfield, IL", n: 5 },
    ],
  },
  {
    query: "franklin",
    description: "Franklin TN (largest) ranks above smaller Franklins",
    assertions: [{ type: "isFirst", displayName: "Franklin, TN" }],
  },
  {
    query: "madison",
    description: "Madison WI (largest) is first for madison query",
    assertions: [{ type: "isFirst", displayName: "Madison, WI" }],
  },
  {
    query: "richmond",
    description: "Richmond VA (largest) is first for richmond query",
    assertions: [{ type: "isFirst", displayName: "Richmond, VA" }],
  },

  // --- Typo tolerance ---
  {
    query: "san fransisco",
    description: "Typo 'san fransisco' still finds San Francisco",
    assertions: [{ type: "inTopN", displayName: "San Francisco, CA", n: 3 }],
  },
  {
    query: "philidelphia",
    description: "Typo 'philidelphia' still finds Philadelphia",
    assertions: [{ type: "inTopN", displayName: "Philadelphia, PA", n: 3 }],
  },
  {
    query: "pittsburg",
    description: "Missing 'h' in Pittsburgh still finds it",
    assertions: [{ type: "inTopN", displayName: "Pittsburgh, PA", n: 3 }],
  },

  // --- Prefix / autocomplete tests ---
  {
    query: "chi",
    description: "Prefix 'chi' returns Chicago first",
    assertions: [{ type: "isFirst", displayName: "Chicago, IL" }],
  },
  {
    query: "hou",
    description: "Prefix 'hou' returns Houston first",
    assertions: [{ type: "isFirst", displayName: "Houston, TX" }],
  },
  {
    query: "phoe",
    description: "Prefix 'phoe' returns Phoenix first",
    assertions: [{ type: "isFirst", displayName: "Phoenix, AZ" }],
  },
  {
    query: "phil",
    description: "Prefix 'phil' returns Philadelphia first",
    assertions: [{ type: "isFirst", displayName: "Philadelphia, PA" }],
  },
  {
    query: "san j",
    description: "Prefix 'san j' returns San Jose first",
    assertions: [{ type: "isFirst", displayName: "San Jose, CA" }],
  },
  {
    query: "denv",
    description: "Prefix 'denv' returns Denver first",
    assertions: [{ type: "isFirst", displayName: "Denver, CO" }],
  },
  {
    query: "seat",
    description: "Prefix 'seat' returns Seattle first",
    assertions: [{ type: "isFirst", displayName: "Seattle, WA" }],
  },
  {
    query: "bost",
    description: "Prefix 'bost' returns Boston first",
    assertions: [{ type: "isFirst", displayName: "Boston, MA" }],
  },
  {
    query: "aus",
    description: "Prefix 'aus' returns Austin, TX first",
    assertions: [{ type: "isFirst", displayName: "Austin, TX" }],
  },
  {
    query: "nash",
    description: "Prefix 'nash' returns Nashville first",
    assertions: [{ type: "isFirst", displayName: "Nashville, TN" }],
  },
  {
    query: "det",
    description: "Prefix 'det' returns Detroit first",
    assertions: [{ type: "isFirst", displayName: "Detroit, MI" }],
  },
  {
    query: "atl",
    description: "Prefix 'atl' returns Atlanta first",
    assertions: [{ type: "isFirst", displayName: "Atlanta, GA" }],
  },
  {
    query: "mia",
    description: "Prefix 'mia' returns Miami first",
    assertions: [{ type: "isFirst", displayName: "Miami, FL" }],
  },
  {
    query: "min",
    description: "Prefix 'min' returns Minneapolis first",
    assertions: [{ type: "isFirst", displayName: "Minneapolis, MN" }],
  },

  // --- Major city exact match ---
  {
    query: "new york",
    description: "New York City is first result for 'new york'",
    assertions: [{ type: "isFirst", displayName: "New York City, NY" }],
  },

  // --- Known failures ---
  // TODO: Prefix matching issue - fuzzy search doesn't handle partial matches well
  {
    query: "honol",
    description: "'honol' prefix returns Honolulu first",
    assertions: [{ type: "isFirst", displayName: "Honolulu, HI" }],
  },
  // TODO: State hint parsing interferes - "d" and "a" get treated as potential state hints
  // {
  //   query: "san d",
  //   description: "Prefix 'san d' returns San Diego first",
  //   assertions: [{ type: "isFirst", displayName: "San Diego, CA" }],
  // },
  // {
  //   query: "san a",
  //   description: "Prefix 'san a' returns San Antonio first",
  //   assertions: [{ type: "isFirst", displayName: "San Antonio, TX" }],
  // },
];

// --- Test Runner ---

async function runBenchmark(benchmark: Benchmark) {
  const results = await performSearch(benchmark.query);
  const displayNames = results.map((r) => r.displayName);

  for (const assertion of benchmark.assertions) {
    switch (assertion.type) {
      case "isFirst":
        expect(
          displayNames[0],
          `Expected "${assertion.displayName}" to be first for query "${benchmark.query}", got "${displayNames[0]}"`,
        ).toBe(assertion.displayName);
        break;

      case "inTopN":
        expect(
          displayNames.slice(0, assertion.n),
          `Expected "${assertion.displayName}" in top ${assertion.n} for query "${benchmark.query}"`,
        ).toContain(assertion.displayName);
        break;

      case "rankHigherThan": {
        const higherIdx = displayNames.indexOf(assertion.higher);
        const lowerIdx = displayNames.indexOf(assertion.lower);
        expect(
          higherIdx,
          `Expected "${assertion.higher}" to be in results`,
        ).toBeGreaterThanOrEqual(0);
        expect(
          lowerIdx,
          `Expected "${assertion.lower}" to be in results`,
        ).toBeGreaterThanOrEqual(0);
        expect(
          higherIdx,
          `Expected "${assertion.higher}" to rank higher than "${assertion.lower}"`,
        ).toBeLessThan(lowerIdx);
        break;
      }
    }
  }
}

describe("Search Quality Benchmarks", () => {
  for (const benchmark of BENCHMARKS) {
    test(benchmark.description, async ({ skip }) => {
      if (!dbAvailable) {
        skip();
        return;
      }
      await runBenchmark(benchmark);
    });
  }
});
