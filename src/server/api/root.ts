import { exampleRouter } from "~/server/api/routers/example";
import { createTRPCRouter } from "~/server/api/trpc";
import { searchRouter } from "./routers/search";
import { placeRouter } from "./routers/place";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  example: exampleRouter,
  search: searchRouter,
  place: placeRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
