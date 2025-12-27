import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { ALGORITHM_VERSION, transformGeodata } from "~/server/geo/geojson";
import { queryOverpass, buildStreetsQuery } from "~/server/osm/overpass";

export const placeRouter = createTRPCRouter({
  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input: { id } }): Promise<string> => {
      if (await ctx.s3.doesObjectExist(placeKey(id))) {
        return ctx.s3.getObjectUrl(placeKey(id));
      }

      let osmText = await ctx.s3.getObject(osmKey(id));
      if (!osmText) {
        const osmData = await queryOverpass(buildStreetsQuery(id));
        osmText = JSON.stringify(osmData);
        await ctx.s3.putObject(osmKey(id), osmText);
      }

      const finalPlace = transformGeodata(JSON.parse(osmText));

      await ctx.s3.putObject(placeKey(id), JSON.stringify(finalPlace));

      return ctx.s3.getObjectUrl(placeKey(id));
    }),
});

function osmKey(id: string) {
  return `osmResponse/${id}`;
}

function placeKey(id: string) {
  return `place/${ALGORITHM_VERSION}/${id}`;
}
