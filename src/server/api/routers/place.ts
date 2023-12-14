import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { fetchWithUA } from "~/utils/fetch";
import { ALGORITHM_VERSION, transformGeodata } from "~/server/geo/geojson";

export const placeRouter = createTRPCRouter({
  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input: { id } }): Promise<string> => {
      if (await ctx.s3.doesObjectExist(placeKey(id))) {
        return ctx.s3.getObjectUrl(placeKey(id));
      }

      let osmText = await ctx.s3.getObject(osmKey(id));
      if (!osmText) {
        const osmResponse = await fetchWithUA(
          "https://overpass-api.de/api/interpreter",
          {
            method: "POST",
            body: "data=" + encodeURIComponent(openStreetMapQuery(id)),
          },
        );
        if (!osmResponse.ok) {
          throw new Error("Place data response was not ok");
        }

        osmText = await osmResponse.text();
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

function openStreetMapQuery(relationId: string) {
  return `[out:json];
    relation(${relationId})->.orig;
    .orig out geom;
    .orig map_to_area->.searchArea;
    (
        nwr["highway"="residential"](area.searchArea);
        nwr["highway"="unclassified"](area.searchArea);
        nwr["highway"="primary"](area.searchArea);
        nwr["highway"="secondary"](area.searchArea);
        nwr["highway"="tertiary"](area.searchArea);
        nwr["highway"="trunk"](area.searchArea);
    );
    out geom;`;
}
