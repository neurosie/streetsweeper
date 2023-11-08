import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { fetchWithUA } from "~/utils/fetch";
import { transformGeodata, type PlaceResponse } from "~/server/geo/geojson";

export const placeRouter = createTRPCRouter({
  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input: { id } }): Promise<PlaceResponse> => {
      // Turning off transformed data caching while I work on the transform
      // const place = await ctx.prisma.place.findUnique({
      //   where: { id },
      // });
      // if (place) {
      //   return JSON.parse(place.response) as PlaceResponse;
      // }

      let osmText = (
        await ctx.prisma.osmResponse.findUnique({
          where: { id },
        })
      )?.response;
      if (!osmText) {
        const osmResponse = await fetchWithUA(
          "https://overpass-api.de/api/interpreter",
          {
            method: "POST",
            body: "data=" + encodeURIComponent(OSMQuery(id)),
          },
        );
        if (!osmResponse.ok) {
          throw new Error("Place data response was not ok");
        }

        osmText = await osmResponse.text();
        await ctx.prisma.osmResponse.create({
          data: { id, response: osmText },
        });
      }

      const finalPlace = transformGeodata(JSON.parse(osmText));

      // await ctx.prisma.place.create({
      //   data: { id, response: JSON.stringify(finalPlace) },
      // });

      return finalPlace;
    }),
});

function OSMQuery(relationId: string) {
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
