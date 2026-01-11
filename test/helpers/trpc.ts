import { type inferProcedureInput } from "@trpc/server";
import { type AppRouter, appRouter } from "~/server/api/root";
import { getTestPrisma } from "./db";
import { s3 } from "~/server/s3";

/**
 * Create a test context for tRPC with test database
 */
export function createTestContext() {
  return {
    prisma: getTestPrisma(),
    s3, // Use the same S3 client (could mock this if needed)
  };
}

/**
 * Create a tRPC caller for testing procedures
 * This allows you to call tRPC procedures directly without HTTP
 */
export function createTestCaller() {
  const ctx = createTestContext();
  return appRouter.createCaller(ctx);
}

/**
 * Helper type for getting procedure input types
 */
export type RouterInput = inferProcedureInput<AppRouter>;
