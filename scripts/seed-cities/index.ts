import { PrismaClient } from "@prisma/client";
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
} from "../../src/server/osm/overpass";

const prisma = new PrismaClient();

// Parse command line arguments
const args = process.argv.slice(2);
const isRematch = args.includes("--rematch");
const shouldClear = args.includes("--clear");

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
  // For rematch mode - existing DB record ID
  dbId?: number;
};

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
 * Process a single place - either insert (seed) or update (rematch)
 */
async function processPlace(
  place: PlaceToProcess,
  state: { id: string; name: string },
  stats: Stats,
  mode: "seed" | "rematch",
): Promise<void> {
  const osmElement = place.osmElement;
  const name = osmElement.tags.name!;

  // Skip places that should be excluded
  if (shouldExclude(name)) {
    if (mode === "rematch" && place.dbId) {
      console.log(`   🗑️  Deleting excluded place: ${name}`);
      await prisma.city.delete({ where: { id: place.dbId } });
    } else {
      console.log(`   🗑️  Excluding: ${name}`);
    }
    stats.excluded++;
    return;
  }

  // Extract population from OSM if available
  const { population, source } = extractPopulation(osmElement);

  // Get coordinates
  const lat = osmElement.center?.lat ?? osmElement.lat ?? null;
  const lng = osmElement.center?.lon ?? osmElement.lon ?? null;
  const county = osmElement.tags["addr:county"] ?? null;

  // Track stats
  stats.totalProcessed++;
  if (source === PopulationSource.OSM) stats.exactMatches++;
  else stats.noMatches++;

  if (mode === "seed") {
    await prisma.city.create({
      data: {
        name,
        state: state.name,
        stateId: state.id,
        county,
        population,
        lat,
        lng,
        osmId: BigInt(osmElement.id),
        osmType: osmElement.type,
        osmData: osmElement as any, // Store full OSM JSON
        displayName: `${name}, ${state.id}`,
        populationSource: source,
      },
    });
  } else if (place.dbId) {
    await prisma.city.update({
      where: { id: place.dbId },
      data: {
        population,
        populationSource: source,
        osmData: osmElement as any, // Update OSM JSON
      },
    });
  }
}

/**
 * Get places to process for a state - either from OSM (seed) or DB (rematch)
 */
async function getPlacesForState(
  stateId: string,
  mode: "seed" | "rematch",
): Promise<PlaceToProcess[]> {
  if (mode === "rematch") {
    const cities = await prisma.city.findMany({
      where: { stateId },
    });
    return cities
      .filter((city) => city.osmData) // Only process if we have OSM data
      .map((city) => ({
        osmElement: city.osmData as OsmElement,
        dbId: city.id,
      }));
  }

  // Seed mode - fetch from OSM
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
  const mode = isRematch ? "rematch" : "seed";

  if (shouldClear) {
    console.log("🗑️  Clearing city table...");
    const count = await prisma.city.count();
    await prisma.city.deleteMany({});
    console.log(`✅ Deleted ${count} cities\n`);
  }

  if (isRematch) {
    console.log("🔄 Rematch mode - re-processing existing cities from OSM data\n");
    console.log("🗑️  Clearing existing population data...");
    await prisma.city.updateMany({
      data: { population: null, populationSource: null },
    });
  }

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
      // In seed mode, skip states that already have cities
      if (mode === "seed") {
        const existingCount = await prisma.city.count({
          where: { stateId: state.id },
        });
        if (existingCount > 0) {
          console.log(
            `   ⏭️  Skipping - ${existingCount} cities already exist`,
          );
          stats.statesSkipped++;
          continue;
        }
      }

      const places = await getPlacesForState(state.id, mode);
      console.log(`   Found ${places.length} places`);

      if (places.length === 0) {
        console.log(`   ⚠️  No results, skipping`);
        continue;
      }

      // In seed mode, filter out duplicates (both within results and in DB)
      let placesToProcess = places;
      if (mode === "seed") {
        // Dedupe within the results themselves
        const seenOsmIds = new Set<number>();
        placesToProcess = places.filter((p) => {
          if (seenOsmIds.has(p.osmElement.id)) return false;
          seenOsmIds.add(p.osmElement.id);
          return true;
        });

        // Filter out any that already exist in DB
        const existingOsmIds = new Set(
          (await prisma.city.findMany({
            where: { osmId: { in: placesToProcess.map((p) => BigInt(p.osmElement.id)) } },
            select: { osmId: true },
          })).map((c) => Number(c.osmId)),
        );
        placesToProcess = placesToProcess.filter((p) => !existingOsmIds.has(p.osmElement.id));
      }

      for (const place of placesToProcess) {
        try {
          await processPlace(place, state, stats, mode);
        } catch (error) {
          console.error(`   ❌ Error processing ${place.osmElement.tags.name}:`, error);
          stats.errors++;
        }
      }

      console.log(`   ✅ Processed ${placesToProcess.length} places`);

      // Rate limit in seed mode
      if (mode === "seed") {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.error(`   ❌ Failed to process ${state.name}:`, error);
      stats.errors++;
    }
  }

  // Process special OSM cities (miscategorized or non-standard)
  if (mode === "seed") {
    console.log("\n📍 Processing special OSM cities...");
    for (const { osmId, stateId, name } of SPECIAL_OSM_CITY_IDS) {
      try {
        // Check if already exists
        const existing = await prisma.city.findFirst({
          where: { osmId: BigInt(osmId) },
        });
        if (existing) {
          console.log(`   ⏭️  Skipping ${name}, ${stateId} - already exists`);
          continue;
        }

        // Find state (may not exist for special cases like DC)
        const state = US_STATES.find((s) => s.id === stateId);
        const stateName = state?.name ?? stateId;

        // Create minimal OSM element - population will be fetched via Wikidata later
        const osmElement: OsmElement = {
          type: "relation",
          id: osmId,
          tags: { name },
        };

        // Track stats
        stats.totalProcessed++;
        stats.noMatches++;

        await prisma.city.create({
          data: {
            name,
            state: stateName,
            stateId,
            county: null,
            population: null,
            lat: null,
            lng: null,
            osmId: BigInt(osmId),
            osmType: "relation",
            osmData: osmElement as any,
            displayName: `${name}, ${stateId}`,
            populationSource: PopulationSource.NO_MATCH,
          },
        });

        console.log(`   ✅ Added ${name}, ${stateId}`);
      } catch (error) {
        console.error(`   ❌ Error processing ${name}, ${stateId}:`, error);
        stats.errors++;
      }
    }
  }

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
