import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { fetchWithUA } from "~/utils/fetch";

export const placeRouter = createTRPCRouter({
  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const response = await fetchWithUA(
        // "https://overpass-api.de/api/interpreter",
        "https://3889f2d4-f887-4d8b-8923-d206830ad410.mock.pstmn.io/api/interpreter",
        {
          method: "POST",
          body: "data=" + encodeURIComponent(OSMQuery(input.id)),
        },
      );
      if (!response.ok) {
        throw new Error("Place data response was not ok");
      }
      return response.json();
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
    );
    out geom;`;
}
