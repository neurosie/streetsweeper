import Bottleneck from "bottleneck";
import { z } from "zod";

import { publicProcedure } from "~/server/api/trpc";
import { fetchWithUA } from "~/utils/fetch";

export type Place = {
  osm_type: string;
  osm_id: number;
  name: string;
  display_name: string;
};

const limiter = new Bottleneck({
  maxConcurrent: 1,
  minTime: 1500, // ms
});

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
      const externalResponse = await limiter.schedule(() =>
        fetchWithUA(
          `https://nominatim.openstreetmap.org/search?city=${query}&format=json`,
        ),
      );
      if (!externalResponse.ok) {
        throw new Error("Search suggest response was not ok");
      }
      results = await externalResponse.text();
      await ctx.prisma.search.create({
        data: { query, results },
      });
    } else {
      results = response.results!;
    }
    return JSON.parse(results) as [Place];
  });
