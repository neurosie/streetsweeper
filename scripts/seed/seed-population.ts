import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { z } from "zod";
import type { OsmElement } from "./types";
import type { CityData } from "../../src/server/cities";

const CITIES_JSONL_PATH = join(process.cwd(), "data", "cities.jsonl");
const OSM_DUMP_PATH = join(process.cwd(), "scripts", "data", "cities-osm.jsonl");

// Parse command line arguments
const args = process.argv.slice(2);
const stateFilter = args.find((arg) => arg.startsWith("--state="))?.split("=")[1];
const limitArg = args.find((arg) => arg.startsWith("--limit="))?.split("=")[1];
const limit = limitArg ? parseInt(limitArg, 10) : undefined;
const isMissingOnly = args.includes("--missing-only");

type OsmDumpRecord = { osmId: number; data: OsmElement };

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
 * Read cities from JSONL file
 */
function readCities(): CityData[] {
  if (!existsSync(CITIES_JSONL_PATH)) return [];
  const content = readFileSync(CITIES_JSONL_PATH, "utf-8");
  return content
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as CityData);
}

/**
 * Write cities to JSONL file
 */
function writeCities(cities: CityData[]): void {
  const content = cities.map((c) => JSON.stringify(c)).join("\n") + "\n";
  writeFileSync(CITIES_JSONL_PATH, content, "utf-8");
}

/**
 * Read OSM dump records and build lookup by osmId
 */
function readOsmDump(): Map<number, OsmElement> {
  if (!existsSync(OSM_DUMP_PATH)) return new Map();
  const content = readFileSync(OSM_DUMP_PATH, "utf-8");
  const records = content
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as OsmDumpRecord);
  return new Map(records.map((r) => [r.osmId, r.data]));
}

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
  const totalBatches = Math.ceil(wikidataIds.length / batchSize);
  for (let i = 0; i < wikidataIds.length; i += batchSize) {
    const batchNum = Math.floor(i / batchSize) + 1;
    if (batchNum % 10 === 1 || batchNum === totalBatches) {
      console.log(`   📦 Batch ${batchNum}/${totalBatches} (${results.size} populations so far)`);
    }
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
  index: number;
  name: string;
  stateId: string;
  wikidataId: string;
};

async function seedPopulation() {
  console.log("🌍 Fetching population data from Wikidata...\n");

  // Load city data and OSM dump
  const cities = readCities();
  const osmDump = readOsmDump();

  if (cities.length === 0) {
    console.log("❌ No cities found in data/cities.jsonl. Run seed:cities first.");
    return;
  }

  if (osmDump.size === 0) {
    console.log("❌ No OSM data found in scripts/data/cities-osm.jsonl. Run seed:cities first.");
    return;
  }

  if (stateFilter) {
    console.log(`📍 Filtering to state: ${stateFilter}`);
  }
  if (isMissingOnly) {
    console.log(`🔍 Only processing cities without population data`);
  }
  console.log();

  // Find cities to process
  const citiesToProcess: CityToProcess[] = [];
  for (let i = 0; i < cities.length; i++) {
    const city = cities[i]!;

    // Apply filters
    if (stateFilter && city.stateId !== stateFilter) continue;
    if (isMissingOnly && city.population != null) continue;

    // Look up OSM data for this city
    const osmData = osmDump.get(city.osmId);
    if (!osmData) continue;

    const wikidataId = extractWikidataId(osmData);
    if (!wikidataId) continue;

    citiesToProcess.push({
      index: i,
      name: city.name,
      stateId: city.stateId,
      wikidataId,
    });

    if (limit && citiesToProcess.length >= limit) break;
  }

  console.log(`📊 Found ${cities.length} total cities`);
  console.log(
    `🔍 Found ${citiesToProcess.length} cities with Wikidata IDs to process\n`,
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

  // Update cities in-place
  let updated = 0;
  let notFound = 0;

  for (const cityToProcess of citiesToProcess) {
    const population = populations.get(cityToProcess.wikidataId);

    if (population !== undefined) {
      cities[cityToProcess.index]!.population = population;
      console.log(
        `   ✅ ${cityToProcess.name}, ${cityToProcess.stateId}: ${population.toLocaleString()}`,
      );
      updated++;
    } else {
      console.log(`   ⚠️  ${cityToProcess.name}, ${cityToProcess.stateId}: No population found`);
      notFound++;
    }
  }

  // Write updated cities
  console.log(`\n💾 Writing updated cities to ${CITIES_JSONL_PATH}`);
  writeCities(cities);

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
