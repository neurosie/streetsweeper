import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    // Use global setup for starting/stopping PostgreSQL container
    globalSetup: ["./test/setup/globalSetup.ts"],

    // Test environment
    environment: "node",

    // Test timeout (increased for integration tests)
    testTimeout: 30000,

    // Setup timeout (container startup can take time)
    hookTimeout: 60000,

    // Run tests serially for integration tests to avoid conflicts
    // You can change this to true for parallel execution if tests are isolated
    fileParallelism: false,

    // Include patterns
    include: ["**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],

    // Exclude patterns
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "**/cypress/**",
      "**/.{idea,git,cache,output,temp}/**",
    ],

    // Coverage configuration (optional)
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "**/*.config.{js,ts}",
        "**/node_modules/**",
        "**/.next/**",
        "**/test/**",
        "**/*.test.{js,ts}",
        "**/*.spec.{js,ts}",
      ],
    },
  },

  // Path aliases to match tsconfig.json
  resolve: {
    alias: {
      "~": path.resolve(__dirname, "./src"),
    },
  },
});
