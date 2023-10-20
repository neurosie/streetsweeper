import bbox from "@turf/bbox";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { type BBox2d } from "@turf/helpers/dist/js/lib/geojson";
import length from "@turf/length";
import lineSplit from "@turf/line-split";
import {
  type Feature,
  type FeatureCollection,
  type Geometry,
  type LineString,
  type Polygon,
} from "geojson";
import osmtogeojson from "osmtogeojson";
import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { generateAbbreviations } from "~/utils/abbreviations";
import { fetchWithUA } from "~/utils/fetch";
import { joinRoadSegments } from "~/utils/geojson";

export type PlaceResponse = {
  place: Place;
  roads: TypedCollection<Road>;
};

interface Place extends Feature<Polygon, PlaceProperties> {
  bbox: BBox2d;
}
type PlaceProperties = {
  totalLengthMi: number;
};

export type Road = Feature<LineString, RoadProperties>;
type RoadProperties = {
  name: string;
  id: string;
  alternateNames: string[];
  lengthMi: number;
};

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

function transformGeodata(response: unknown): PlaceResponse {
  const [place, ...roads] = osmtogeojson(response).features;

  if (!place || !isFeature(place, "Polygon")) {
    throw "First result was not a polygon";
  }

  const transformedRoads = roads.flatMap((road): [Road] | [] => {
    if (!isFeature(road, "LineString") || road.properties == null) {
      console.log(`skipping road ${road.id} (${road.type})`);
      return [];
    }

    // Take the first available name as canonical, and the rest as alternates.
    const alternateNames = [
      road.properties.name,
      road.properties.alt_name,
      road.properties.short_name,
      road.properties.nickname,
      road.properties.old_name,
      road.properties["name:left"],
      road.properties["name:right"],
      road.properties["bridge:name"],
    ].filter(
      (name): name is string => typeof name === "string" && name.length > 0,
    );

    const displayName = alternateNames[0];
    if (!displayName) {
      return [];
    }

    const id: unknown = road.properties.id;
    if (typeof id !== "string") {
      return [];
    }

    // Check if the road exits the place border, and if it does trim it down.
    // Algorithm based on https://gis.stackexchange.com/a/459122,
    // modified to check a point slightly inside each segment instead of the strict beginning,
    // as I found that to be imprecise for bounds checking.
    const roadSegments = lineSplit(road, place).features;
    if (roadSegments.length > 0) {
      const inBoundsSegments = roadSegments.filter((seg) => {
        if (seg.geometry.coordinates.length < 2) {
          return false;
        }
        const pointA = seg.geometry.coordinates[0]!;
        const pointB = seg.geometry.coordinates[1]!;
        const testPoint = [
          (pointA[0]! + pointB[0]!) / 2,
          (pointA[1]! + pointB[1]!) / 2,
        ];
        return booleanPointInPolygon(testPoint, place);
      });

      if (inBoundsSegments.length === 0) {
        return [];
      }
      // A line may enter and leave multiple times, this probably needs special handling.
      if (inBoundsSegments.length > 1) {
        console.log(`Unimplemented: MultiLineString road support (${road.id})`);
        return [];
      }
      road.geometry = inBoundsSegments[0]!.geometry;
    }

    return [
      {
        ...road,
        properties: {
          name: displayName,
          id,
          alternateNames: [
            ...new Set(
              alternateNames.flatMap((name) => generateAbbreviations(name)),
            ),
          ],
          lengthMi: length(road, { units: "miles" }),
        },
      },
    ];
  });

  const joinedRoads = joinRoadSegments(transformedRoads);

  return {
    place: {
      ...place,
      bbox: (place.bbox ?? bbox(place)) as BBox2d,
      properties: {
        totalLengthMi: joinedRoads.reduce(
          (sum, road) => sum + road.properties.lengthMi,
          0,
        ),
      },
    },
    roads: { type: "FeatureCollection", features: joinedRoads },
  };
}

interface TypedCollection<T extends Feature>
  extends FeatureCollection<T["geometry"], T["properties"]> {
  features: Array<T>;
}

function isFeature<T extends Feature["geometry"]["type"]>(
  feature: Feature,
  type: T,
): feature is Feature<Extract<Geometry, { type: T }>> {
  return feature.geometry.type === type;
}

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
