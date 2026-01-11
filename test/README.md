# Integration Testing Guide

This directory contains integration tests for the Streetsweeper API. The tests exercise real database operations using PostgreSQL instead of mocking Prisma calls.

## Test Structure

```
test/
├── setup/
│   └── globalSetup.ts       # Database setup and teardown
├── helpers/
│   ├── db.ts                # Database utilities (seed, clean, disconnect)
│   ├── trpc.ts              # tRPC test context and caller creation
│   └── mocks.ts             # Mock implementations for external services
└── README.md                # This file
```

## Running Tests

### Quick Start

```bash
# Run all tests
npm test

# Run tests once (non-watch mode)
npm run test:run

# Run integration tests only
npm run test:integration

# Run unit tests only
npm run test:unit

# Run with UI
npm run test:ui

# Run with coverage
npm run test:coverage
```

## Database Setup

The test suite supports **two database modes**:

### Option 1: Testcontainers (Recommended)

If you have Docker installed and running, tests will automatically:
- Start a fresh PostgreSQL container
- Run migrations
- Execute tests
- Tear down the container

**Requirements:**
- Docker must be installed and running
- No additional configuration needed

**Advantages:**
- Fully isolated test database
- No manual setup required
- Clean slate for every test run
- Same database version as production (PostgreSQL 16)

### Option 2: Manual Test Database

If Docker is not available, you can use a manual test database:

**Setup:**

1. Create a test database:
   ```bash
   createdb streetsweeper_test
   ```

2. Set the environment variable:
   ```bash
   export TEST_DATABASE_URL="postgresql://user:password@localhost:5432/streetsweeper_test"
   ```

3. Run tests:
   ```bash
   npm test
   ```

**Advantages:**
- Works without Docker
- Can use existing PostgreSQL installation
- Faster startup (no container creation)

**Disadvantages:**
- Requires manual database setup
- Must clean database between test runs manually if needed
- Shared database state (if not cleaned properly)

## Test Organization

### Integration Tests

Location: `src/server/api/routers/*.test.ts`

These tests:
- Use real PostgreSQL database
- Exercise full tRPC procedure logic
- Test database queries and transactions
- Mock only external APIs (Overpass, S3)

Example:
```typescript
import { createTestCaller } from "~/../../test/helpers/trpc";
import { seedCityData, cleanDatabase } from "~/../../test/helpers/db";

describe("Search Router", () => {
  beforeAll(async () => {
    await seedCityData();
  });

  it("should find cities", async () => {
    const caller = createTestCaller();
    const result = await caller.search({ query: "San Francisco" });
    expect(result).toHaveLength(1);
  });

  afterAll(async () => {
    await cleanDatabase();
  });
});
```

### Unit Tests

Location: `src/server/geo/*.test.ts`

These tests:
- Test pure functions and utilities
- No database required
- Fast execution

## Test Helpers

### Database Helpers (`test/helpers/db.ts`)

```typescript
import { getTestPrisma, seedCityData, cleanDatabase } from "~/../../test/helpers/db";

// Get Prisma client connected to test database
const prisma = getTestPrisma();

// Seed test data
await seedCityData();

// Clean all tables
await cleanDatabase();
```

### tRPC Helpers (`test/helpers/trpc.ts`)

```typescript
import { createTestCaller } from "~/../../test/helpers/trpc";

// Create a caller to invoke procedures directly
const caller = createTestCaller();

// Call procedures
const result = await caller.search({ query: "..." });
const place = await caller.place.getById({ id: "..." });
```

### Mock Helpers (`test/helpers/mocks.ts`)

```typescript
import { MockS3Client, createMockOverpassResponse } from "~/../../test/helpers/mocks";

// Mock S3 client for testing
const mockS3 = new MockS3Client();
await mockS3.putObject("key", "value");

// Mock Overpass API response
const mockData = createMockOverpassResponse();
```

## Writing New Tests

### Integration Test Template

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { createTestCaller } from "~/../../test/helpers/trpc";
import { cleanDatabase, disconnectTestPrisma } from "~/../../test/helpers/db";

describe("My Router Integration Tests", () => {
  let caller: ReturnType<typeof createTestCaller>;

  beforeEach(() => {
    caller = createTestCaller();
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectTestPrisma();
  });

  it("should do something", async () => {
    const result = await caller.myRouter.myProcedure({ input: "test" });
    expect(result).toBeDefined();
  });
});
```

## Configuration

### Vitest Config (`vitest.config.ts`)

Key settings:
- **Global setup**: Starts/stops database container
- **Test timeout**: 30s (for slow database operations)
- **Hook timeout**: 60s (for container startup)
- **File parallelism**: Disabled (to avoid conflicts)

To enable parallel tests (if your tests are fully isolated):
```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    fileParallelism: true, // Enable parallel execution
  },
});
```

## Troubleshooting

### Docker not found

**Error:**
```
Error: Could not find a working container runtime strategy
```

**Solution:**
Either:
1. Install Docker and start the daemon, OR
2. Use manual database mode (see Option 2 above)

### Migrations fail

**Error:**
```
Migration failed: ...
```

**Solution:**
1. Ensure your database is accessible
2. Check connection string format
3. Verify Prisma schema is valid
4. Try running migrations manually:
   ```bash
   npx prisma migrate deploy
   ```

### Tests hang

**Possible causes:**
- Database connection not closed
- Container not stopping properly

**Solution:**
- Check `afterAll()` hooks call `disconnectTestPrisma()`
- Verify `cleanDatabase()` completes successfully

### Port conflicts

**Error:**
```
Port 5432 already in use
```

**Solution:**
- Stop other PostgreSQL instances
- Testcontainers will automatically use a random available port

## Best Practices

1. **Clean database between tests**: Use `cleanDatabase()` in `afterAll` or `beforeEach`
2. **Seed minimal data**: Only create data needed for specific tests
3. **Isolate tests**: Each test should be independent
4. **Mock external APIs**: Use mocks for S3, Overpass, etc.
5. **Test real database logic**: Don't mock Prisma - test actual queries
6. **Fast feedback**: Run unit tests during development, integration tests before commit

## CI/CD Integration

For GitHub Actions or other CI systems:

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm run test:run
        # Testcontainers will automatically use Docker in CI
```

## Performance Tips

1. **Use testcontainers in CI**: Fully isolated, no cleanup needed
2. **Use manual database locally**: Faster for development
3. **Limit test data**: Seed only what you need
4. **Run unit tests first**: Faster feedback loop
5. **Parallelize when possible**: If tests are isolated

## Further Reading

- [Vitest Documentation](https://vitest.dev/)
- [Testcontainers Documentation](https://node.testcontainers.org/)
- [tRPC Testing Guide](https://trpc.io/docs/server/testing)
- [Prisma Testing Guide](https://www.prisma.io/docs/guides/testing)
