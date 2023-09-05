import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { prisma } from "~/server/db";
import { fetchWithUA } from "~/utils/fetch";

export type Place = {
  osm_type: string;
  osm_id: number;
  name: string;
  display_name: string;
};

export const searchRouter = publicProcedure
  .input(z.object({ query: z.string() }))
  .query(async ({ input, ctx }) => {
    const { query } = input;
    if (query === "") {
      return Promise.resolve([]);
    }
    const response = await ctx.prisma.search.findUnique({ where: { query } });
    let results;
    if (response === null) {
      const externalResponse = await fetchWithUA(
        //   `https://nominatim.openstreetmap.org/search?city=${query}&format=json`,
        `https://3889f2d4-f887-4d8b-8923-d206830ad410.mock.pstmn.io/search?city=${query}&format=json`,
      );
      if (!externalResponse.ok) {
        throw new Error("Search suggest response was not ok");
      }
      results = await externalResponse.text();
      await prisma.search.create({
        data: { query, results },
      });
    } else {
      results = response.results!;
    }
    return JSON.parse(results) as [Place];
    // return response.json() as Promise<[Place]>;
  });
