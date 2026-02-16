import Fuse from "fuse.js";
import { z } from "zod";
import { publicProcedure } from "~/server/api/trpc";
import { loadCities, type CityData } from "~/server/cities";
import { US_STATES } from "~/data/states";
import { calculateFinalScore } from "./searchUtils";

type ParsedQuery = {
  cityQuery: string;
  stateHint: string | null;
};

/**
 * Try to match a string to a state abbreviation.
 * Matches exact abbreviation (case-insensitive), full state name,
 * or prefix of state name (e.g., "mass" -> "MA", "calif" -> "CA")
 */
export function matchStateQuery(stateQuery: string): string | null {
  const normalized = stateQuery.trim().toLowerCase();
  if (normalized.length === 0) return null;

  // Exact abbreviation match (case-insensitive)
  const abbrevMatch = US_STATES.find(
    (s) => s.id.toLowerCase() === normalized,
  );
  if (abbrevMatch) return abbrevMatch.id;

  // Full or prefix state name match
  const nameMatch = US_STATES.find((s) =>
    s.name.toLowerCase().startsWith(normalized),
  );
  if (nameMatch) return nameMatch.id;

  return null;
}

/**
 * Parse a search query to extract city name and optional state hint.
 * Handles formats like:
 * - "troy, ny" -> { cityQuery: "troy", stateHint: "NY" }
 * - "portland me" -> { cityQuery: "portland", stateHint: "ME" }
 * - "springfield mass" -> { cityQuery: "springfield", stateHint: "MA" }
 * - "chicago" -> { cityQuery: "chicago", stateHint: null }
 */
export function parseSearchQuery(query: string): ParsedQuery {
  const trimmed = query.trim();

  // Try comma-separated format first: "city, state"
  if (trimmed.includes(",")) {
    const [cityPart, statePart] = trimmed.split(",", 2);
    if (cityPart && statePart) {
      const stateHint = matchStateQuery(statePart);
      if (stateHint) {
        return { cityQuery: cityPart.trim(), stateHint };
      }
    }
  }

  // Try space-separated format: "city state" where state is at the end
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) {
    // Try last word as state
    const lastWord = parts[parts.length - 1]!;
    const stateHint = matchStateQuery(lastWord);
    if (stateHint) {
      return {
        cityQuery: parts.slice(0, -1).join(" "),
        stateHint,
      };
    }
  }

  // No state component found
  return { cityQuery: trimmed, stateHint: null };
}

export type PlaceResult = {
  osmType: string;
  osmId: number;
  name: string;
  state: string;
  stateId: string;
  county?: string;
  displayName: string;
};

/** Fields needed for search index - loaded from cities.jsonl */
export type CitySearchData = CityData;

/** Fuse.js configuration for city search */
const FUSE_OPTIONS = {
  keys: ["name"],
  threshold: 0.4, // Allow moderate fuzziness
  includeScore: true,
  shouldSort: true,
};

/** Bonus applied to score when city matches state hint (0-1 scale addition) */
const STATE_MATCH_BONUS = 0.3;

// Module-level cache: loaded once, reused for all searches
let citySearchIndex: Fuse<CitySearchData> | null = null;
let citiesData: CitySearchData[] = [];

/**
 * Initialize city search index (runs once on first search).
 * Loads city data from the JSONL file checked into the repo.
 */
function getCitySearchIndex(): Fuse<CitySearchData> {
  if (!citySearchIndex) {
    console.log("Loading cities into memory...");

    citiesData = loadCities().sort(
      (a, b) => (b.population ?? 0) - (a.population ?? 0),
    );

    citySearchIndex = new Fuse(citiesData, FUSE_OPTIONS);

    console.log(`Loaded ${citiesData.length} cities into memory`);
  }

  return citySearchIndex;
}

/**
 * Convert city data to PlaceResult format
 */
function cityToPlaceResult(city: CitySearchData): PlaceResult {
  return {
    osmType: city.osmType,
    osmId: city.osmId,
    name: city.name,
    state: city.state,
    stateId: city.stateId,
    county: city.county ?? undefined,
    displayName: city.displayName,
  };
}

/**
 * Calculate score with optional state hint bonus.
 * State hint boosts matching states rather than filtering out non-matches.
 */
function calculateScoreWithStateHint(
  matchScore: number,
  population: number | null,
  queryLength: number,
  stateHint: string | null,
  cityStateId: string,
): number {
  const baseScore = calculateFinalScore(matchScore, population, queryLength);

  // Apply bonus if state hint matches
  if (stateHint && cityStateId === stateHint) {
    return baseScore + STATE_MATCH_BONUS;
  }

  return baseScore;
}

/**
 * City search using in-memory fuzzy matching.
 * Data loaded from JSONL on first search, no database needed.
 */
export const searchRouter = publicProcedure
  .input(z.object({ query: z.string() }))
  .query(({ input }): PlaceResult[] => {
    const { query } = input;

    if (query === "") {
      return [];
    }

    // Ensure index is loaded (runs once on first search)
    const fuse = getCitySearchIndex();

    // Parse query to extract city name and optional state hint
    const { cityQuery, stateHint } = parseSearchQuery(query);

    // For very short city queries, fall back to prefix matching + population ranking
    if (cityQuery.length <= 2) {
      const normalized = cityQuery.toLowerCase();
      const prefixMatches = citiesData
        .filter(
          (city) =>
            city.population && city.name.toLowerCase().startsWith(normalized),
        )
        .map((city) => ({
          city,
          score: calculateScoreWithStateHint(
            1, // Perfect match for prefix
            city.population,
            cityQuery.length,
            stateHint,
            city.stateId,
          ),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);

      return prefixMatches.map(({ city }) => cityToPlaceResult(city));
    }

    // Fuzzy search using just the city name
    const fuzzyResults = fuse.search(cityQuery);

    // Rank by combination of fuzzy match score, population, and state hint
    const rankedResults = fuzzyResults
      .map((result) => {
        const city = result.item;
        const matchScore = 1 - (result.score ?? 1); // Convert to 0-1 where 1 is perfect match
        const finalScore = calculateScoreWithStateHint(
          matchScore,
          city.population,
          cityQuery.length,
          stateHint,
          city.stateId,
        );

        return {
          city,
          finalScore,
        };
      })
      .sort((a, b) => b.finalScore - a.finalScore)
      .slice(0, 10); // Return top 10 results

    return rankedResults.map(({ city }) => cityToPlaceResult(city));
  });
