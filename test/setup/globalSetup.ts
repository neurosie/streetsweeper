import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

/**
 * Global setup that runs once before all tests.
 *
 * This setup supports two modes:
 *
 * 1. Testcontainers (if Docker is available):
 *    - Automatically starts a PostgreSQL container
 *    - Runs migrations
 *    - Tears down the container after tests
 *
 * 2. Manual database (fallback):
 *    - Uses TEST_DATABASE_URL environment variable
 *    - You must set up a test database manually
 *    - Runs migrations on the test database
 *
 * To use manual mode, set TEST_DATABASE_URL in your environment:
 * export TEST_DATABASE_URL="postgresql://user:password@localhost:5432/streetsweeper_test"
 */
export async function setup() {
  // Check if Docker is available
  const hasDocker = await checkDocker();

  if (hasDocker) {
    console.log("🚀 Docker detected - using Testcontainers...");
    await setupWithTestcontainers();
  } else {
    console.log("⚠️  Docker not available - using manual test database...");
    await setupWithManualDatabase();
  }
}

/**
 * Check if Docker is available
 */
async function checkDocker(): Promise<boolean> {
  try {
    await execAsync("docker --version");
    return true;
  } catch {
    return false;
  }
}

/**
 * Setup using Testcontainers (requires Docker)
 */
async function setupWithTestcontainers() {
  const { PostgreSqlContainer } = await import("@testcontainers/postgresql");

  console.log("🚀 Starting PostgreSQL container for tests...");

  const postgresContainer = await new PostgreSqlContainer("postgres:16-alpine")
    .withExposedPorts(5432)
    .withDatabase("streetsweeper_test")
    .withUsername("test")
    .withPassword("test")
    .start();

  const connectionString = postgresContainer.getConnectionUri();

  // Set environment variables for Prisma
  process.env.DATABASE_URL = connectionString;
  process.env.POSTGRES_PRISMA_URL = connectionString;
  process.env.POSTGRES_URL_NON_POOLING = connectionString;

  console.log(`✅ PostgreSQL container started at ${connectionString}`);

  // Run Prisma migrations
  await runMigrations(connectionString);

  // Store container and connection string for teardown
  (global as any).__POSTGRES_CONTAINER__ = postgresContainer;
  (global as any).__POSTGRES_URI__ = connectionString;
}

/**
 * Setup using manual test database
 */
async function setupWithManualDatabase() {
  const testDatabaseUrl = process.env.TEST_DATABASE_URL;

  if (!testDatabaseUrl) {
    console.error(`
❌ ERROR: TEST_DATABASE_URL environment variable is not set.

To run tests without Docker, you need to set up a test database:

1. Create a PostgreSQL database for testing:
   createdb streetsweeper_test

2. Set the TEST_DATABASE_URL environment variable:
   export TEST_DATABASE_URL="postgresql://user:password@localhost:5432/streetsweeper_test"

3. Run tests:
   npm test

Alternatively, if you have Docker installed, make sure the Docker daemon is running.
`);
    throw new Error("TEST_DATABASE_URL not set and Docker not available");
  }

  console.log(`📦 Using test database at ${testDatabaseUrl.replace(/:[^:@]*@/, ':***@')}`);

  // Set environment variables for Prisma
  process.env.DATABASE_URL = testDatabaseUrl;
  process.env.POSTGRES_PRISMA_URL = testDatabaseUrl;
  process.env.POSTGRES_URL_NON_POOLING = testDatabaseUrl;

  // Run Prisma migrations
  await runMigrations(testDatabaseUrl);

  // Store connection string
  (global as any).__POSTGRES_URI__ = testDatabaseUrl;
}

/**
 * Run Prisma migrations
 */
async function runMigrations(connectionString: string) {
  console.log("🔄 Running Prisma migrations...");
  try {
    await execAsync("npx prisma migrate deploy", {
      env: {
        ...process.env,
        DATABASE_URL: connectionString,
      },
    });
    console.log("✅ Migrations completed successfully");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  }
}

/**
 * Global teardown that runs once after all tests.
 */
export async function teardown() {
  const container = (global as any).__POSTGRES_CONTAINER__;

  if (container) {
    console.log("🛑 Stopping PostgreSQL container...");
    await container.stop();
    console.log("✅ PostgreSQL container stopped");
  } else {
    console.log("✅ Tests completed (using manual database)");
  }
}
