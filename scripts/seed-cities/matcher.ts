import {
  PopulationSource,
  type PopulationMatch,
  type OsmElement,
  type SimpleMapsRow,
} from "./types";

/**
 * Patterns to exclude from the database entirely.
 * These are non-city OSM entities that shouldn't be in our city database.
 */
const EXCLUSION_PATTERNS = [
  // Maine unorganized territories (WELS = West of the Easterly Line of the State)
  /\bWELS$/i,
  /^T\d+\s+R\d+/i, // Township/Range notation like "T1 R8"
  /^TA\s+R\d+/i, // TA R7 style
  // Campgrounds
  /\bCampground$/i,
  /\bCamping Area$/i,
  // Unincorporated areas (usually just neighborhoods, not cities)
  /^Unincorporated\s+/i,
  // Generic numbered townships
  /^Township\s+\d+/i,
  /^Township\s+[A-Z]$/i, // Township E, Township D, etc.
];

/**
 * Check if a place name should be excluded from the database.
 */
export function shouldExclude(name: string): boolean {
  return EXCLUSION_PATTERNS.some((pattern) => pattern.test(name));
}

/**
 * Generate name variants to try matching against SimpleMaps.
 * These are only used for matching - the original name is preserved in the database.
 */
function getNameVariants(name: string): string[] {
  const variants: string[] = [name];

  // Saint <-> St. normalization
  if (name.startsWith("Saint ")) {
    variants.push(name.replace(/^Saint /, "St. "));
  } else if (name.startsWith("St. ")) {
    variants.push(name.replace(/^St\. /, "Saint "));
  }

  // Handle "X Township" -> "X" (for matching)
  if (name.endsWith(" Township")) {
    variants.push(name.replace(/ Township$/, ""));
  }

  // Handle compound names with hyphens
  if (name.includes("-")) {
    // Try without the hyphen
    variants.push(name.replace(/-/g, " "));
  }

  // Handle "City of X" -> "X" (for matching only)
  if (name.startsWith("City of ")) {
    variants.push(name.replace(/^City of /, ""));
  }
  if (name.startsWith("Town of ")) {
    variants.push(name.replace(/^Town of /, ""));
  }

  // Handle lowercase "city" suffix (e.g., "Aniak city" -> "Aniak")
  if (/ city$/i.test(name)) {
    variants.push(name.replace(/ city$/i, ""));
  }

  // Handle parenthetical aliases - try both the full name and just the first part
  // e.g., "San Buenaventura (Ventura)" -> also try "San Buenaventura" and "Ventura"
  const parenMatch = name.match(/^(.+?)\s*\(([^)]+)\)$/);
  if (parenMatch?.[1] && parenMatch[2]) {
    variants.push(parenMatch[1].trim());
    variants.push(parenMatch[2].trim());
  }

  // Handle slash aliases - try both parts
  // e.g., "Lapwai / léepwey" -> also try "Lapwai" and "léepwey"
  const slashMatch = name.match(/^(.+?)\s*\/\s*(.+)$/);
  if (slashMatch?.[1] && slashMatch[2]) {
    variants.push(slashMatch[1].trim());
    variants.push(slashMatch[2].trim());
  }

  return variants;
}

export function findPopulation(
  osmPlace: OsmElement,
  stateCities: SimpleMapsRow[],
): PopulationMatch {
  const osmName = osmPlace.tags.name!;
  const variants = getNameVariants(osmName);

  // Try exact match first with all variants (case-insensitive)
  for (const variant of variants) {
    const exactMatch = stateCities.find(
      (city) =>
        city.city.toLowerCase() === variant.toLowerCase() ||
        city.city_ascii.toLowerCase() === variant.toLowerCase(),
    );

    if (exactMatch) {
      return {
        population: exactMatch.population,
        source: PopulationSource.EXACT_MATCH,
        match: exactMatch,
      };
    }
  }

  // Fuzzy matching disabled - too many false positives (Bolton->Boston, etc.)
  return {
    population: null,
    source: PopulationSource.NO_MATCH,
  };
}
