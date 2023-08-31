import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

type City = {
  place_id: string;
  name: string;
  display_name: string;
};

export const searchRouter = createTRPCRouter({
  get: publicProcedure
    .input(z.object({ query: z.string() }))
    .query(async ({ input }) => {
      if (input.query === "") {
        return Promise.resolve([]);
      }
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?city=${input.query}&format=json`,
        {
          headers: new Headers({
            "User-Agent": `StreetSweeper (${process.env.OWNER_EMAIL})`,
          }),
        },
      );
      if (!response.ok) {
        throw new Error("Search suggest response was not ok");
      }
      return response.json() as Promise<[City]>;
    }),
});
