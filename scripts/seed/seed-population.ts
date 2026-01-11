import { PrismaClient, Prisma } from "@prisma/client";
import { z } from "zod";
import { PopulationSource, type OsmElement } from "./types";

const prisma = new PrismaClient();

// Parse command line arguments
const args = process.argv.slice(2);
const stateFilter = args.find((arg) => arg.startsWith("--state="))?.split("=")[1];
const limitArg = args.find((arg) => arg.startsWith("--limit="))?.split("=")[1];
const limit = limitArg ? parseInt(limitArg, 10) : undefined;
const isMissingOnly = args.includes("--missing-only");

// Wikidata API response schemas
const WikidataClaimSchema = z.object({
  mainsnak: z.object({
    datavalue: z.object({
      value: z.object({
        amount: z.string(),
      }).optional(),
    }).optional(),
  }),
  qualifiers: z.object({
    P585: z.array(z.object({
      datavalue: z.object({
        value: z.object({
          time: z.string(),
        }).optional(),
      }).optional(),
    })).optional(),
  }).optional(),
});

const WikidataEntitySchema = z.object({
  id: z.string(),
  claims: z.object({
    P1082: z.array(WikidataClaimSchema).optional(),
  }).optional(),
});

const WikidataResponseSchema = z.object({
  entities: z.record(z.string(), WikidataEntitySchema),
  error: z.object({
    code: z.string(),
    info: z.string(),
  }).optional(),
});

/**
 * Extract Wikidata ID from OSM data
 */
function extractWikidataId(osmData: OsmElement): string | null {
  return osmData.tags.wikidata ?? null;
}

/**
 * Fetch population data from Wikidata for multiple entities
 * Uses the Wikibase API to batch fetch up to 50 entities at once
 *
 * Conforms to Wikimedia API Etiquette:
 * - Requests made serially (not parallel) to avoid overwhelming servers
 * - Batches multiple entities per request using pipe separator (|)
 * - Uses descriptive User-Agent with contact info
 * - Enables GZip compression to reduce bandwidth
 * - Uses maxlag parameter for non-interactive batch processing
 * - Handles maxlag errors with retry logic
 */
async function fetchWikidataPopulations(
  wikidataIds: string[],
): Promise<Map<string, number>> {
  const results = new Map<string, number>();

  // Process in batches of 50 (Wikidata API limit)
  // Serial processing (one batch at a time) per API etiquette
  const batchSize = 50;
  for (let i = 0; i < wikidataIds.length; i += batchSize) {
    const batch = wikidataIds.slice(i, i + batchSize);
    const ids = batch.join("|");

    // Add maxlag parameter for non-interactive batch processing (per Wikimedia API etiquette)
    const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${ids}&props=claims&format=json&maxlag=5`;

    try {
      const response = await fetch(url, {
        headers: {
          // Follow Wikimedia API etiquette: descriptive User-Agent with contact info
          "User-Agent": "StreetSweeper/1.0 (https://github.com/neurosie/streetsweeper) Node.js/fetch",
          // Use GZip compression to reduce bandwidth (per API etiquette)
          "Accept-Encoding": "gzip",
        },
      });

      if (!response.ok) {
        console.error(`   ❌ Wikidata API HTTP error: ${response.status}`);
        continue;
      }

      const json: unknown = await response.json();
      const data = WikidataResponseSchema.parse(json);

      // Handle API errors (e.g., maxlag - server too busy)
      if (data.error) {
        if (data.error.code === "maxlag") {
          console.log(`   ⏳ Server busy (maxlag), waiting 5 seconds...`);
          await new Promise((resolve) => setTimeout(resolve, 5000));
          // Retry this batch by decrementing the loop counter
          i -= batchSize;
          continue;
        } else {
          console.error(`   ❌ Wikidata API error: ${data.error.code} - ${data.error.info}`);
          continue;
        }
      }

      // Extract population from each entity
      for (const [wikidataId, entity] of Object.entries(data.entities)) {
        if (!entity.claims?.P1082) continue;

        // P1082 is the population property
        // Get the most recent population value
        let latestPopulation: number | null = null;
        let latestDate: string | null = null;

        for (const claim of entity.claims.P1082) {
          const amount = claim.mainsnak.datavalue?.value?.amount;
          if (!amount) continue;

          // Parse the amount (format: "+12345" or "12345")
          const population = parseInt(amount.replace(/^\+/, ""), 10);
          if (isNaN(population)) continue;

          // Get the date qualifier (P585 = point in time)
          const date =
            claim.qualifiers?.P585?.[0]?.datavalue?.value?.time ?? null;

          // Keep the most recent one, or if no date, just use it
          if (!latestDate || (date && date > latestDate)) {
            latestPopulation = population;
            latestDate = date;
          } else if (!date && !latestPopulation) {
            latestPopulation = population;
          }
        }

        if (latestPopulation !== null) {
          results.set(wikidataId, latestPopulation);
        }
      }

      // Rate limiting - be polite to Wikidata
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`   ❌ Error fetching batch:`, error);
    }
  }

  return results;
}

type CityToProcess = {
  id: number;
  name: string;
  stateId: string;
  wikidataId: string;
};

async function seedPopulation() {
  console.log("🌍 Fetching population data from Wikidata...\n");

  // Build query conditions
  const whereConditions = {
    osmData: { not: Prisma.JsonNull },
    ...(stateFilter ? { stateId: stateFilter } : {}),
    ...(isMissingOnly ? { population: null } : {}),
  };

  if (stateFilter) {
    console.log(`📍 Filtering to state: ${stateFilter}`);
  }
  if (isMissingOnly) {
    console.log(`🔍 Only processing cities without population data`);
  }
  console.log();

  // Get all cities that have OSM data with Wikidata IDs
  const cities = await prisma.city.findMany({
    where: whereConditions,
    select: {
      id: true,
      name: true,
      stateId: true,
      osmData: true,
      populationSource: true,
    },
    take: limit,
  });

  console.log(`📊 Found ${cities.length} cities to process\n`);

  // Extract Wikidata IDs
  const citiesToProcess: CityToProcess[] = [];
  for (const city of cities) {
    const osmData = city.osmData as OsmElement | null;
    if (!osmData) continue;

    const wikidataId = extractWikidataId(osmData);
    if (!wikidataId) continue;

    citiesToProcess.push({
      id: city.id,
      name: city.name,
      stateId: city.stateId,
      wikidataId,
    });
  }

  console.log(
    `🔍 Found ${citiesToProcess.length} cities with Wikidata IDs\n`,
  );

  if (citiesToProcess.length === 0) {
    console.log("✅ No cities to process\n");
    return;
  }

  // Fetch populations in batches
  const wikidataIds = citiesToProcess.map((c) => c.wikidataId);
  console.log(`📡 Fetching population data from Wikidata...`);
  const populations = await fetchWikidataPopulations(wikidataIds);
  console.log(`✅ Retrieved ${populations.size} population values\n`);

  // Update cities
  let updated = 0;
  let notFound = 0;

  for (const city of citiesToProcess) {
    const population = populations.get(city.wikidataId);

    if (population !== undefined) {
      await prisma.city.update({
        where: { id: city.id },
        data: {
          population,
          populationSource: PopulationSource.WIKIDATA,
        },
      });
      console.log(
        `   ✅ ${city.name}, ${city.stateId}: ${population.toLocaleString()}`,
      );
      updated++;
    } else {
      console.log(`   ⚠️  ${city.name}, ${city.stateId}: No population found`);
      notFound++;
    }
  }

  console.log("\n✨ Complete!\n");
  console.log("📊 Statistics:");
  console.log(`   Cities processed: ${citiesToProcess.length}`);
  console.log(`   Updated with population: ${updated}`);
  console.log(`   No population found: ${notFound}`);
  console.log(
    `   Success rate: ${((updated / citiesToProcess.length) * 100).toFixed(1)}%`,
  );
}

seedPopulation().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
