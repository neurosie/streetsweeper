import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { US_STATES, SPECIAL_OSM_CITY_IDS } from "./states";
import { shouldExclude } from "./matcher";
import {
  PopulationSource,
  OverpassResponseSchema,
  type OsmElement,
} from "./types";
import {
  queryOverpass,
  buildMunicipalitiesQuery,
  buildRelationQuery,
} from "../../src/server/osm/overpass";
import type { CityData } from "../../src/server/cities";

const CITIES_JSONL_PATH = join(process.cwd(), "data", "cities.jsonl");
const OSM_DATA_PATH = join(process.cwd(), "scripts", "data");
const OSM_DUMP_PATH = join(OSM_DATA_PATH, "cities-osm.jsonl");

// Parse command line arguments
const args = process.argv.slice(2);
const shouldClear = args.includes("--clear");
const noSkip = args.includes("--no-skip");

type Stats = {
  totalProcessed: number;
  exactMatches: number;
  noMatches: number;
  errors: number;
  statesSkipped: number;
  excluded: number;
};

type PlaceToProcess = {
  osmElement: OsmElement;
};

type CityRecord = CityData;
type OsmDumpRecord = { osmId: number; data: OsmElement };

/**
 * Read existing cities from JSONL file
 */
function readExistingCities(): CityRecord[] {
  if (!existsSync(CITIES_JSONL_PATH)) return [];
  const content = readFileSync(CITIES_JSONL_PATH, "utf-8");
  return content
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as CityRecord);
}

/**
 * Read existing OSM dump records
 */
function readExistingOsmDump(): OsmDumpRecord[] {
  if (!existsSync(OSM_DUMP_PATH)) return [];
  const content = readFileSync(OSM_DUMP_PATH, "utf-8");
  return content
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as OsmDumpRecord);
}

/**
 * Write cities to JSONL file
 */
function writeCities(cities: CityRecord[]): void {
  const content = cities.map((c) => JSON.stringify(c)).join("\n") + "\n";
  writeFileSync(CITIES_JSONL_PATH, content, "utf-8");
}

/**
 * Write OSM dump to JSONL file (gitignored, for local osmData cache)
 */
function writeOsmDump(records: OsmDumpRecord[]): void {
  mkdirSync(OSM_DATA_PATH, { recursive: true });
  const content = records.map((r) => JSON.stringify(r)).join("\n") + "\n";
  writeFileSync(OSM_DUMP_PATH, content, "utf-8");
}

/**
 * Extract population from OSM tags
 */
function extractPopulation(osmElement: OsmElement): {
  population: number | null;
  source: PopulationSource;
} {
  const populationTag = osmElement.tags.population;
  if (populationTag) {
    const parsed = parseInt(populationTag, 10);
    if (!isNaN(parsed)) {
      return { population: parsed, source: PopulationSource.OSM };
    }
  }
  return { population: null, source: PopulationSource.NO_MATCH };
}

/**
 * Process a single place into a city record
 */
function processPlace(
  place: PlaceToProcess,
  state: { id: string; name: string },
  stats: Stats,
): { city: CityRecord; osmDump: OsmDumpRecord } | null {
  const osmElement = place.osmElement;
  const name = osmElement.tags.name!;

  // Skip places that should be excluded
  if (shouldExclude(name)) {
    console.log(`   🗑️  Excluding: ${name}`);
    stats.excluded++;
    return null;
  }

  // Extract population from OSM if available
  const { population, source } = extractPopulation(osmElement);

  const county = osmElement.tags["addr:county"] ?? null;

  // Track stats
  stats.totalProcessed++;
  if (source === PopulationSource.OSM) stats.exactMatches++;
  else stats.noMatches++;

  const city: CityRecord = {
    name,
    state: state.name,
    stateId: state.id,
    county,
    population,
    osmId: osmElement.id,
    osmType: osmElement.type,
    displayName: `${name}, ${state.id}`,
  };

  const osmDump: OsmDumpRecord = {
    osmId: osmElement.id,
    data: osmElement,
  };

  return { city, osmDump };
}

/**
 * Get places from OpenStreetMap for a state
 */
async function getPlacesForState(stateId: string): Promise<PlaceToProcess[]> {
  const data: unknown = await queryOverpass(buildMunicipalitiesQuery(stateId));
  const parsed = OverpassResponseSchema.parse(data);
  const osmPlaces = parsed.elements.filter((el) => el.type === "relation");

  return osmPlaces
    .filter((place) => place.tags.name) // Skip unnamed places
    .map((place) => ({
      osmElement: place,
    }));
}

async function seedCities() {
  // Load existing data
  const existingCities = shouldClear ? [] : readExistingCities();
  const existingOsmDump = shouldClear ? [] : readExistingOsmDump();

  if (shouldClear) {
    console.log("🗑️  Clearing city data...");
    console.log(`✅ Cleared ${existingCities.length} cities\n`);
    writeCities([]);
    writeOsmDump([]);
  }

  if (noSkip) {
    console.log(
      "🔁 No-skip mode - querying every state, including ones that already have cities\n",
    );
  }

  const existingOsmIds = new Set(existingCities.map((c) => c.osmId));
  // Build index of which states already have cities.
  // Skip special-list cities, since their individual queries might have succeeded
  // when the whole-state query failed.
  const specialOsmIds = new Set(SPECIAL_OSM_CITY_IDS.map((c) => c.osmId));
  const statesWithCities = new Set(
    existingCities
      .filter((c) => !specialOsmIds.has(c.osmId))
      .map((c) => c.stateId),
  );

  const newCities: CityRecord[] = [];
  const newOsmDumps: OsmDumpRecord[] = [];

  const stats: Stats = {
    totalProcessed: 0,
    exactMatches: 0,
    noMatches: 0,
    errors: 0,
    statesSkipped: 0,
    excluded: 0,
  };

  for (const state of US_STATES) {
    console.log(`\n📍 Processing ${state.name} (${state.id})...`);

    try {
      // Skip states that already have cities (unless --no-skip mode)
      if (!noSkip && statesWithCities.has(state.id)) {
        const count = existingCities.filter(
          (c) => c.stateId === state.id,
        ).length;
        console.log(`   ⏭️  Skipping - ${count} cities already exist`);
        stats.statesSkipped++;
        continue;
      }

      const places = await getPlacesForState(state.id);
      console.log(`   Found ${places.length} places`);

      if (places.length === 0) {
        console.log(`   ⚠️  No results, skipping`);
        continue;
      }

      // Filter out duplicates (both within results and existing)
      const seenOsmIds = new Set<number>();
      let placesToProcess = places.filter((p) => {
        if (seenOsmIds.has(p.osmElement.id)) return false;
        seenOsmIds.add(p.osmElement.id);
        return true;
      });

      // Filter out any that already exist
      placesToProcess = placesToProcess.filter(
        (p) => !existingOsmIds.has(p.osmElement.id),
      );

      for (const place of placesToProcess) {
        try {
          const result = processPlace(place, state, stats);
          if (result) {
            newCities.push(result.city);
            newOsmDumps.push(result.osmDump);
            existingOsmIds.add(result.city.osmId);
          }
        } catch (error) {
          console.error(
            `   ❌ Error processing ${place.osmElement.tags.name}:`,
            error,
          );
          stats.errors++;
        }
      }

      console.log(`   ✅ Processed ${placesToProcess.length} places`);

      // Rate limit
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`   ❌ Failed to process ${state.name}:`, error);
      stats.errors++;
    }
  }

  // Process special OSM cities (miscategorized or non-standard)
  {
    console.log("\n📍 Processing special OSM cities...");
    for (const { osmId, stateId, name } of SPECIAL_OSM_CITY_IDS) {
      try {
        // Check if already exists
        if (existingOsmIds.has(osmId)) {
          console.log(`   ⏭️  Skipping ${name}, ${stateId} - already exists`);
          continue;
        }

        // Fetch actual OSM data for this relation
        console.log(`   📡 Fetching OSM data for ${name}...`);
        const data: unknown = await queryOverpass(buildRelationQuery(osmId));
        const parsed = OverpassResponseSchema.parse(data);
        const osmElement = parsed.elements.find(
          (el) => el.type === "relation" && el.id === osmId,
        );

        if (!osmElement) {
          console.error(`   ❌ Could not find relation ${osmId} in OSM`);
          stats.errors++;
          continue;
        }

        // Find state (may not exist for special cases like DC)
        const state = US_STATES.find((s) => s.id === stateId);
        const stateName = state?.name ?? stateId;

        // Extract population from OSM if available
        const { population, source } = extractPopulation(osmElement);

        const county = osmElement.tags["addr:county"] ?? null;

        // Track stats
        stats.totalProcessed++;
        if (source === PopulationSource.OSM) stats.exactMatches++;
        else stats.noMatches++;

        const city: CityRecord = {
          name,
          state: stateName,
          stateId,
          county,
          population,
          osmId,
          osmType: "relation",
          displayName: `${name}, ${stateId}`,
        };

        newCities.push(city);
        newOsmDumps.push({ osmId, data: osmElement });
        existingOsmIds.add(osmId);

        console.log(`   ✅ Added ${name}, ${stateId}`);

        // Rate limit
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`   ❌ Error processing ${name}, ${stateId}:`, error);
        stats.errors++;
      }
    }
  }

  // Write results
  const allCities = [...existingCities, ...newCities];
  const allOsmDumps = [...existingOsmDump, ...newOsmDumps];

  console.log(
    `\n💾 Writing ${allCities.length} cities to ${CITIES_JSONL_PATH}`,
  );
  writeCities(allCities);

  console.log(
    `💾 Writing ${allOsmDumps.length} OSM records to ${OSM_DUMP_PATH}`,
  );
  writeOsmDump(allOsmDumps);

  printStats(stats);
}

function printStats(stats: Stats) {
  console.log("\n✨ Complete!\n");
  console.log("📊 Statistics:");
  if (stats.statesSkipped > 0) {
    console.log(`   States skipped: ${stats.statesSkipped}`);
  }
  console.log(`   Total processed: ${stats.totalProcessed}`);
  console.log(`   Exact matches: ${stats.exactMatches}`);
  console.log(`   No matches: ${stats.noMatches}`);
  if (stats.excluded > 0) {
    console.log(`   Excluded: ${stats.excluded}`);
  }
  console.log(`   Errors: ${stats.errors}`);

  if (stats.totalProcessed > 0) {
    const matchRate = (stats.exactMatches / stats.totalProcessed) * 100;
    console.log(`\n   Match rate: ${matchRate.toFixed(1)}%`);
  }
}

seedCities().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
