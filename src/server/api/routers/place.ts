import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { fetchWithUA } from "~/utils/fetch";

const Bounds = z.object({
  minlat: z.number(),
  minlon: z.number(),
  maxlat: z.number(),
  maxlon: z.number(),
});
const Geometry = z.array(z.object({ lat: z.number(), lon: z.number() }));

const CityResponse = z.object({
  type: z.literal("relation"),
  id: z.number(),
  bounds: Bounds,
  members: z.array(
    z
      .object({
        type: z.literal("way"),
        role: z.literal("outer"),
        geometry: Geometry,
      })
      .or(z.object({ type: z.literal("node"), role: z.literal("label") })),
  ),
  tags: z.object({ name: z.string() }),
});

const RoadResponse = z.object({
  type: z.literal("way"),
  id: z.number(),
  bounds: Bounds,
  geometry: Geometry,
  tags: z.object({
    name: z.string().optional(),
    "name:left": z.string().optional(),
    "name:right": z.string().optional(),
    alt_name: z.string().optional(),
    old_name: z.string().optional(),
    short_name: z.string().optional(),
    nickname: z.string().optional(),
    "bridge:name": z.string().optional(),
    "tiger:name_base": z.string().optional(),
    "tiger:name_type": z.string().optional(),
    "tiger:name_base_1": z.string().optional(),
    "tiger:name_type_1": z.string().optional(),
  }),
});

const OSMResponse = z.object({
  elements: z.tuple([CityResponse]).rest(RoadResponse),
});

const OSMResponseToPlace = OSMResponse.transform((val): Place => {
  const place = val.elements[0];
  const roads = val.elements.slice(1) as z.infer<typeof RoadResponse>[];

  return {
    id: place.id,
    bounds: place.bounds,
    border: place.members.flatMap((node) =>
      node.role === "outer" ? node.geometry : [],
    ),
    roads: roads.flatMap(({ id, bounds, geometry, tags }): [Road] | [] => {
      const alternateNames = [
        tags.name,
        tags.alt_name,
        tags.short_name,
        tags.nickname,
        tags.old_name,
        tags["name:left"],
        tags["name:right"],
        tags["bridge:name"],
      ].filter((name): name is string => !!name && name.length > 0);

      const displayName = alternateNames[0];

      if (!displayName) {
        return [];
      }
      return [
        {
          id,
          displayName,
          alternateNames: alternateNames.map((name) => name.toLowerCase()),
          geometry,
        },
      ];
    }),
  };
});

export type Road = {
  id: number;
  displayName: string;
  alternateNames: string[];
  // bounds: z.infer<typeof Bounds>;
  geometry: z.infer<typeof Geometry>;
};
export type Place = {
  id: number;
  bounds: z.infer<typeof Bounds>;
  border: z.infer<typeof Geometry>;
  roads: Road[];
};

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
      return OSMResponseToPlace.parse(await response.json());
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
