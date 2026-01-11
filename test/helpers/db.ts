import { PrismaClient } from "@prisma/client";

let prisma: PrismaClient;

/**
 * Get or create a Prisma client instance for tests
 */
export function getTestPrisma(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
    });
  }
  return prisma;
}

/**
 * Clean all data from the database between tests
 */
export async function cleanDatabase() {
  const prisma = getTestPrisma();

  // Delete in reverse order of dependencies
  await prisma.search.deleteMany({});
  await prisma.city.deleteMany({});
}

/**
 * Seed test data for search functionality
 */
export async function seedSearchData() {
  const prisma = getTestPrisma();

  await prisma.search.create({
    data: {
      query: JSON.stringify({ q: "San Francisco" }),
      results: JSON.stringify([
        {
          osm_type: "relation",
          osm_id: "111968",
          name: "San Francisco",
          display_name: "San Francisco, California, United States",
          address: {
            city: "San Francisco",
            state: "California",
            country: "United States",
          },
        },
      ]),
    },
  });
}

/**
 * Seed test data for cities
 */
export async function seedCityData() {
  const prisma = getTestPrisma();

  await prisma.city.createMany({
    data: [
      {
        name: "San Francisco",
        state: "California",
        stateId: "CA",
        county: "San Francisco",
        population: 873965,
        lat: 37.7749,
        lng: -122.4194,
        osmId: BigInt(111968),
        osmType: "relation",
        displayName: "San Francisco, California, United States",
        populationSource: "test",
      },
      {
        name: "Los Angeles",
        state: "California",
        stateId: "CA",
        county: "Los Angeles",
        population: 3979576,
        lat: 34.0522,
        lng: -118.2437,
        osmId: BigInt(207359),
        osmType: "relation",
        displayName: "Los Angeles, California, United States",
        populationSource: "test",
      },
    ],
  });
}

/**
 * Disconnect Prisma client (call in afterAll)
 */
export async function disconnectTestPrisma() {
  if (prisma) {
    await prisma.$disconnect();
  }
}
