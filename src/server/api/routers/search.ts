import Fuse from "fuse.js";
import { z } from "zod";
import { publicProcedure } from "~/server/api/trpc";
import type { PrismaClient, City } from "@prisma/client";
import { calculateFinalScore } from "./searchUtils";

export type PlaceResult = {
  osmType: string;
  osmId: number;
  name: string;
  state: string;
  stateId: string;
  county?: string;
  displayName: string;
};

// Module-level cache: loaded once, reused for all searches
let citySearchIndex: Fuse<City> | null = null;
let citiesData: City[] = [];

/**
 * Initialize city search index (runs once on first search)
 */
async function getCitySearchIndex(prisma: PrismaClient): Promise<Fuse<City>> {
  if (!citySearchIndex) {
    console.log("Loading cities into memory...");

    citiesData = await prisma.city.findMany({
      orderBy: { population: "desc" },
    });

    citySearchIndex = new Fuse(citiesData, {
      keys: ["name"],
      threshold: 0.4, // Allow moderate fuzziness
      includeScore: true,
      shouldSort: true,
    });

    console.log(`Loaded ${citiesData.length} cities into memory`);
  }

  return citySearchIndex;
}

/**
 * City search using in-memory fuzzy matching.
 * No database queries after initial load.
 */
export const searchRouter = publicProcedure
  .input(z.object({ query: z.string() }))
  .query(async ({ input, ctx }): Promise<PlaceResult[]> => {
    const { query } = input;

    if (query === "") {
      return [];
    }

    // Get cached index (loads once on first search)
    const fuse = await getCitySearchIndex(ctx.prisma);

    // For very short queries, fall back to prefix matching + population ranking
    if (query.length <= 2) {
      const normalized = query.toLowerCase();
      const prefixMatches = citiesData
        .filter(
          (city) =>
            city.population && city.name.toLowerCase().startsWith(normalized),
        )
        .slice(0, 10);

      return prefixMatches.map((city) => ({
        osmType: city.osmType,
        osmId: Number(city.osmId),
        name: city.name,
        state: city.state,
        stateId: city.stateId,
        county: city.county ?? undefined,
        displayName: city.displayName,
      }));
    }

    // Fuzzy search all cities (pure in-memory, no DB query)
    const fuzzyResults = fuse.search(query);

    // Rank by combination of fuzzy match score and population
    const rankedResults = fuzzyResults
      .map((result) => {
        const city = result.item;
        const matchScore = 1 - (result.score ?? 1); // Convert to 0-1 where 1 is perfect match
        const finalScore = calculateFinalScore(
          matchScore,
          city.population,
          query.length,
        );

        return {
          city,
          finalScore,
        };
      })
      .sort((a, b) => b.finalScore - a.finalScore)
      .slice(0, 10); // Return top 10 results

    // Convert to PlaceResult format for frontend compatibility
    return rankedResults.map(({ city }) => ({
      osmType: city.osmType,
      osmId: Number(city.osmId),
      name: city.name,
      state: city.state,
      stateId: city.stateId,
      county: city.county ?? undefined,
      displayName: city.displayName,
    }));
  });
