import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { appRouter } from "~/server/api/root";
import { getTestPrisma, disconnectTestPrisma } from "~/../../test/helpers/db";
import {
  MockS3Client,
  createMockOverpassResponse,
} from "~/../../test/helpers/mocks";
import * as overpass from "~/server/osm/overpass";
import { ALGORITHM_VERSION } from "~/server/geo/geojson";

describe("Place Router Integration Tests", () => {
  let mockS3: MockS3Client;
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeEach(() => {
    // Create fresh mock S3 for each test
    mockS3 = new MockS3Client();

    // Create caller with mocked S3
    caller = appRouter.createCaller({
      prisma: getTestPrisma(),
      s3: mockS3 as any, // Type cast since we're mocking
    });

    // Mock the Overpass API query
    vi.spyOn(overpass, "queryOverpass").mockResolvedValue(
      createMockOverpassResponse(),
    );
  });

  afterAll(async () => {
    await disconnectTestPrisma();
    vi.restoreAllMocks();
  });

  describe("place.getById", () => {
    it("should fetch and cache place data from Overpass API", async () => {
      const placeId = "111968"; // San Francisco OSM ID

      const result = await caller.place.getById({ id: placeId });

      // Should return an S3 URL
      expect(result).toContain("mock-s3.example.com");
      expect(result).toContain(placeId);

      // Verify queryOverpass was called
      expect(overpass.queryOverpass).toHaveBeenCalledTimes(1);
    });

    it("should return cached place data on subsequent requests", async () => {
      const placeId = "111968";

      // First request
      const result1 = await caller.place.getById({ id: placeId });

      // Clear the mock call count
      vi.clearAllMocks();

      // Second request
      const result2 = await caller.place.getById({ id: placeId });

      // Should return same URL
      expect(result1).toBe(result2);

      // Should NOT call Overpass API again (data is cached in S3)
      expect(overpass.queryOverpass).not.toHaveBeenCalled();
    });

    it("should use cached OSM data if available", async () => {
      const placeId = "111968";

      // Pre-populate OSM cache in S3
      const mockOsmData = createMockOverpassResponse();
      await mockS3.putObject(`osmResponse/${placeId}`, JSON.stringify(mockOsmData));

      const result = await caller.place.getById({ id: placeId });

      // Should return an S3 URL
      expect(result).toContain(placeId);

      // Should NOT call Overpass API (OSM data is already cached)
      expect(overpass.queryOverpass).not.toHaveBeenCalled();
    });

    it("should handle different place IDs", async () => {
      const placeId1 = "111968";
      const placeId2 = "207359";

      const result1 = await caller.place.getById({ id: placeId1 });
      const result2 = await caller.place.getById({ id: placeId2 });

      // Should return different URLs for different places
      expect(result1).toContain(placeId1);
      expect(result2).toContain(placeId2);
      expect(result1).not.toBe(result2);
    });

    it("should store both OSM and transformed data in S3", async () => {
      const placeId = "111968";

      await caller.place.getById({ id: placeId });

      // Verify OSM data was stored
      const osmData = await mockS3.getObject(`osmResponse/${placeId}`);
      expect(osmData).toBeTruthy();
      expect(JSON.parse(osmData!)).toHaveProperty("elements");

      // Verify transformed place data was stored
      const placeData = await mockS3.doesObjectExist(`place/${ALGORITHM_VERSION}/${placeId}`);
      expect(placeData).toBe(true);
    });
  });
});
