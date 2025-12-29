/**
 * Calculate ranking weights based on query length
 */
export function getRankingWeights(queryLength: number): {
  similarity: number;
  population: number;
} {
  if (queryLength <= 2) {
    // Short queries: heavily favor population
    return { similarity: 0.3, population: 0.7 };
  } else if (queryLength <= 6) {
    // Medium queries: balanced
    return { similarity: 0.6, population: 0.4 };
  } else {
    // Long queries: favor match quality
    return { similarity: 0.7, population: 0.3 };
  }
}

/**
 * Normalize population score for ranking (log scale)
 */
export function normalizePopulationScore(population: number | null): number {
  if (!population) return 0.1;
  return Math.log10(population + 1) / 7; // Normalize to ~0-1 (10M people = 7)
}

/**
 * Calculate final ranking score
 */
export function calculateFinalScore(
  matchScore: number,
  population: number | null,
  queryLength: number,
): number {
  const weights = getRankingWeights(queryLength);
  const populationScore = normalizePopulationScore(population);
  return matchScore * weights.similarity + populationScore * weights.population;
}
