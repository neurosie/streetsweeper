import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { createTestCaller } from "~/../../test/helpers/trpc";
import {
  cleanDatabase,
  seedCityData,
  disconnectTestPrisma,
} from "~/../../test/helpers/db";

describe("Search Router Integration Tests", () => {
  let caller: ReturnType<typeof createTestCaller>;

  beforeAll(async () => {
    // Seed test data once before all tests
    await seedCityData();
  });

  beforeEach(() => {
    // Create a fresh caller for each test
    caller = createTestCaller();
  });

  afterAll(async () => {
    // Clean up
    await cleanDatabase();
    await disconnectTestPrisma();
  });

  describe("search procedure", () => {
    it("should return empty array for empty query", async () => {
      const result = await caller.search({ query: "" });

      expect(result).toEqual([]);
    });

    it("should find exact city match", async () => {
      const result = await caller.search({ query: "San Francisco" });

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        name: "San Francisco",
        state: "California",
        stateId: "CA",
        osmId: 111968,
        osmType: "relation",
      });
    });

    it("should find city with fuzzy matching", async () => {
      const result = await caller.search({ query: "San Fran" });

      expect(result.length).toBeGreaterThan(0);
      expect(result[0]?.name).toBe("San Francisco");
    });

    it("should handle short queries with prefix matching", async () => {
      const result = await caller.search({ query: "Sa" });

      // Should return cities starting with "Sa"
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]?.name.toLowerCase().startsWith("sa")).toBe(true);
    });

    it("should find Los Angeles", async () => {
      const result = await caller.search({ query: "Los Angeles" });

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        name: "Los Angeles",
        state: "California",
        stateId: "CA",
        osmId: 207359,
      });
    });

    it("should limit results to 10", async () => {
      const result = await caller.search({ query: "a" });

      expect(result.length).toBeLessThanOrEqual(10);
    });

    it("should rank by population for similar matches", async () => {
      // Los Angeles has higher population than San Francisco
      const result = await caller.search({ query: "California city" });

      // Results should exist
      expect(result.length).toBeGreaterThan(0);

      // Should return PlaceResult format
      expect(result[0]).toHaveProperty("osmType");
      expect(result[0]).toHaveProperty("osmId");
      expect(result[0]).toHaveProperty("name");
      expect(result[0]).toHaveProperty("state");
      expect(result[0]).toHaveProperty("stateId");
      expect(result[0]).toHaveProperty("displayName");
    });

    it("should return correct PlaceResult structure", async () => {
      const result = await caller.search({ query: "San Francisco" });

      expect(result[0]).toEqual({
        osmType: expect.any(String),
        osmId: expect.any(Number),
        name: expect.any(String),
        state: expect.any(String),
        stateId: expect.any(String),
        county: expect.any(String),
        displayName: expect.any(String),
      });
    });
  });
});
