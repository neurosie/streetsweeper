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
