import { backOff, type IBackOffOptions } from "exponential-backoff";

/**
 * Default backoff configuration for retrying failed operations
 */
export const DEFAULT_BACKOFF_OPTIONS: Partial<IBackOffOptions> = {
  numOfAttempts: 5,
  startingDelay: 1000, // Start with 1 second
  timeMultiple: 2, // Double the delay each time (1s, 2s, 4s, 8s, 16s)
  maxDelay: 30000, // Cap at 30 seconds
};

/**
 * Retry a function with exponential backoff
 * @param fn - The async function to retry
 * @param options - Backoff options (merged with defaults)
 * @returns Promise that resolves with the function result
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options?: Partial<IBackOffOptions>,
): Promise<T> {
  return backOff(fn, { ...DEFAULT_BACKOFF_OPTIONS, ...options });
}

/**
 * Backoff configuration for API rate-limited requests
 */
export const RATE_LIMIT_BACKOFF_OPTIONS: Partial<IBackOffOptions> = {
  ...DEFAULT_BACKOFF_OPTIONS,
  retry: (error: Error) => {
    // Retry on rate limits (429), server errors (5xx), and network issues
    const shouldRetry =
      error.message.includes("429") ||
      error.message.includes("Too Many Requests") ||
      error.message.includes("5") ||
      error.message.includes("fetch") ||
      error.message.includes("network") ||
      error.message.includes("timeout");

    if (shouldRetry) {
      console.log(`   ⏳ Retrying due to: ${error.message}`);
    }
    return shouldRetry;
  },
};
