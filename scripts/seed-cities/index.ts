import { PrismaClient } from "@prisma/client";
import { loadSimpleMaps, groupByState } from "./simplemaps";
import { US_STATES } from "./states";
import { findPopulation, shouldExclude } from "./matcher";
import {
  PopulationSource,
  OverpassResponseSchema,
  type OsmElement,
  type SimpleMapsRow,
} from "./types";
import {
  queryOverpass,
  buildMunicipalitiesQuery,
} from "../../src/server/osm/overpass";

const prisma = new PrismaClient();

// Parse command line arguments
const args = process.argv.slice(2);
const isRematch = args.includes("--rematch");

type Stats = {
  totalProcessed: number;
  exactMatches: number;
  fuzzyMatches: number;
  noMatches: number;
  errors: number;
  statesSkipped: number;
  excluded: number;
};

type PlaceToProcess = {
  osmId: number;
  name: string;
  osmType: string;
  lat: number | null;
  lng: number | null;
  county: string | null;
  // For rematch mode - existing DB record ID
  dbId?: number;
};

/**
 * Process a single place - either insert (seed) or update (rematch)
 */
async function processPlace(
  place: PlaceToProcess,
  state: { id: string; name: string },
  stateCities: SimpleMapsRow[],
  stats: Stats,
  mode: "seed" | "rematch",
): Promise<void> {
  // Skip places that should be excluded
  if (shouldExclude(place.name)) {
    if (mode === "rematch" && place.dbId) {
      console.log(`   🗑️  Deleting excluded place: ${place.name}`);
      await prisma.city.delete({ where: { id: place.dbId } });
    } else {
      console.log(`   🗑️  Excluding: ${place.name}`);
    }
    stats.excluded++;
    return;
  }

  // Create OSM element for matching
  const osmElement: OsmElement = {
    type: "relation",
    id: place.osmId,
    tags: { name: place.name },
    center: place.lat && place.lng ? { lat: place.lat, lon: place.lng } : undefined,
  };

  const { population, source, match } = findPopulation(osmElement, stateCities);

  // Track stats
  stats.totalProcessed++;
  if (source === PopulationSource.EXACT_MATCH) stats.exactMatches++;
  else if (source === PopulationSource.FUZZY_MATCH) stats.fuzzyMatches++;
  else stats.noMatches++;

  if (mode === "seed") {
    await prisma.city.create({
      data: {
        name: place.name,
        state: state.name,
        stateId: state.id,
        county: place.county ?? match?.county_name ?? null,
        population: population,
        lat: match?.lat ?? place.lat,
        lng: match?.lng ?? place.lng,
        osmId: place.osmId,
        osmType: place.osmType,
        displayName: `${place.name}, ${state.id}`,
        populationSource: source,
      },
    });
  } else if (place.dbId) {
    await prisma.city.update({
      where: { id: place.dbId },
      data: {
        population: population,
        populationSource: source,
        county: match?.county_name ?? place.county,
        lat: match?.lat ?? place.lat,
        lng: match?.lng ?? place.lng,
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
    return cities.map((city) => ({
      osmId: Number(city.osmId),
      name: city.name,
      osmType: city.osmType,
      lat: city.lat,
      lng: city.lng,
      county: city.county,
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
      osmId: place.id,
      name: place.tags.name!,
      osmType: place.type,
      lat: place.center?.lat ?? null,
      lng: place.center?.lon ?? null,
      county: place.tags["addr:county"] ?? null,
    }));
}

async function seedCities() {
  const mode = isRematch ? "rematch" : "seed";

  console.log("🌎 Loading SimpleMaps data...");
  const simpleMapsData = loadSimpleMaps();
  const citiesByState = groupByState(simpleMapsData);
  console.log(`✅ Loaded ${simpleMapsData.length} cities from SimpleMaps\n`);

  if (isRematch) {
    console.log("🔄 Rematch mode - re-running matching on existing cities\n");
    console.log("🗑️  Clearing existing population data...");
    await prisma.city.updateMany({
      data: { population: null, populationSource: null },
    });
  }

  const stats: Stats = {
    totalProcessed: 0,
    exactMatches: 0,
    fuzzyMatches: 0,
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

      const stateCities = citiesByState.get(state.id) ?? [];
      console.log(`   Found ${stateCities.length} SimpleMaps cities`);

      // In seed mode, filter out duplicates (both within results and in DB)
      let placesToProcess = places;
      if (mode === "seed") {
        // Dedupe within the results themselves
        const seenOsmIds = new Set<number>();
        placesToProcess = places.filter((p) => {
          if (seenOsmIds.has(p.osmId)) return false;
          seenOsmIds.add(p.osmId);
          return true;
        });

        // Filter out any that already exist in DB
        const existingOsmIds = new Set(
          (await prisma.city.findMany({
            where: { osmId: { in: placesToProcess.map((p) => BigInt(p.osmId)) } },
            select: { osmId: true },
          })).map((c) => Number(c.osmId)),
        );
        placesToProcess = placesToProcess.filter((p) => !existingOsmIds.has(p.osmId));
      }

      for (const place of placesToProcess) {
        try {
          await processPlace(place, state, stateCities, stats, mode);
        } catch (error) {
          console.error(`   ❌ Error processing ${place.name}:`, error);
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
  console.log(`   Fuzzy matches: ${stats.fuzzyMatches}`);
  console.log(`   No matches: ${stats.noMatches}`);
  if (stats.excluded > 0) {
    console.log(`   Excluded: ${stats.excluded}`);
  }
  console.log(`   Errors: ${stats.errors}`);

  if (stats.totalProcessed > 0) {
    const matchRate =
      ((stats.exactMatches + stats.fuzzyMatches) / stats.totalProcessed) * 100;
    console.log(`\n   Match rate: ${matchRate.toFixed(1)}%`);
  }
}

seedCities().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
