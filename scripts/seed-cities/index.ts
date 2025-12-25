import { PrismaClient } from "@prisma/client";
import { loadSimpleMaps, groupByState } from "./simplemaps";
import { US_STATES } from "./states";
import { findPopulation } from "./matcher";
import { PopulationSource, OverpassResponseSchema } from "./types";
import {
  queryOverpass,
  buildMunicipalitiesQuery,
} from "../../src/server/osm/overpass";

const prisma = new PrismaClient();

async function seedCities() {
  console.log("🌎 Loading SimpleMaps data...");
  const simpleMapsData = loadSimpleMaps();
  const citiesByState = groupByState(simpleMapsData);
  console.log(`✅ Loaded ${simpleMapsData.length} cities from SimpleMaps\n`);

  const stats = {
    totalProcessed: 0,
    exactMatches: 0,
    fuzzyMatches: 0,
    noMatches: 0,
    errors: 0,
  };

  for (const state of US_STATES) {
    console.log(`\n📍 Processing ${state.name} (${state.id})...`);

    try {
      // Fetch OSM places for this state
      const data: unknown = await queryOverpass(
        buildMunicipalitiesQuery(state.id),
      );
      const parsed = OverpassResponseSchema.parse(data);
      const osmPlaces = parsed.elements.filter(
        (el) => el.type === "relation",
      );

      console.log(`   Found ${osmPlaces.length} OSM places`);

      if (osmPlaces.length === 0) {
        console.log(`   ⚠️  No results, skipping`);
        continue;
      }

      // Get SimpleMaps cities for this state
      const stateCities = citiesByState.get(state.id) || [];
      console.log(`   Found ${stateCities.length} SimpleMaps cities`);

      // Match and insert
      for (const place of osmPlaces) {
        try {
          const { population, source, match } = findPopulation(
            place,
            stateCities,
          );

          // Track stats
          stats.totalProcessed++;
          if (source === PopulationSource.EXACT_MATCH) stats.exactMatches++;
          else if (source === PopulationSource.FUZZY_MATCH)
            stats.fuzzyMatches++;
          else stats.noMatches++;

          await prisma.city.create({
            data: {
              name: place.tags.name,
              state: state.name,
              stateId: state.id,
              county: place.tags["addr:county"] || match?.county_name || null,
              population: population,
              lat: match?.lat ?? place.center?.lat ?? null,
              lng: match?.lng ?? place.center?.lon ?? null,
              osmId: place.id,
              osmType: place.type,
              displayName: `${place.tags.name}, ${state.id}`,
              populationSource: source,
            },
          });
        } catch (error) {
          console.error(`   ❌ Error processing ${place.tags.name}:`, error);
          stats.errors++;
        }
      }

      console.log(`   ✅ Inserted ${osmPlaces.length} places`);

      // Rate limit: wait 1 second between states to be respectful to Overpass
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`   ❌ Failed to process ${state.name}:`, error);
      stats.errors++;
    }
  }

  console.log("\n✨ Seeding complete!\n");
  console.log("📊 Statistics:");
  console.log(`   Total processed: ${stats.totalProcessed}`);
  console.log(`   Exact matches: ${stats.exactMatches}`);
  console.log(`   Fuzzy matches: ${stats.fuzzyMatches}`);
  console.log(`   No matches: ${stats.noMatches}`);
  console.log(`   Errors: ${stats.errors}`);

  const matchRate =
    ((stats.exactMatches + stats.fuzzyMatches) / stats.totalProcessed) * 100;
  console.log(`\n   Match rate: ${matchRate.toFixed(1)}%`);
}

seedCities()
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
