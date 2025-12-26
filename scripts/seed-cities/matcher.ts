import Fuse from "fuse.js";
import {
  PopulationSource,
  type PopulationMatch,
  type OsmElement,
  type SimpleMapsRow,
} from "./types";

export function findPopulation(
  osmPlace: OsmElement,
  stateCities: SimpleMapsRow[],
): PopulationMatch {
  const osmName = osmPlace.tags.name!;

  // Try exact match first (case-insensitive)
  const exactMatch = stateCities.find(
    (city) => city.city.toLowerCase() === osmName.toLowerCase(),
  );

  if (exactMatch) {
    return {
      population: exactMatch.population,
      source: PopulationSource.EXACT_MATCH,
      match: exactMatch,
    };
  }

  // Fuzzy match with Fuse.js
  const fuse = new Fuse(stateCities, {
    keys: ["city", "city_ascii"],
    threshold: 0.2,
    includeScore: true,
  });

  const results = fuse.search(osmName);

  if (results[0] && results[0].score! < 0.2) {
    return {
      population: results[0].item.population,
      source: PopulationSource.FUZZY_MATCH,
      match: results[0].item,
    };
  }

  return {
    population: null,
    source: PopulationSource.NO_MATCH,
  };
}
