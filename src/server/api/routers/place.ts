import bbox from "@turf/bbox";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { lineString, point, polygon } from "@turf/helpers";
import { BBox2d } from "@turf/helpers/dist/js/lib/geojson";
import lineSplit from "@turf/line-split";
import {
  BBox,
  Feature,
  GeoJsonProperties,
  Geometry,
  LineString,
  MultiPolygon,
  Polygon,
} from "geojson";
import osmtogeojson from "osmtogeojson";
import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { fetchWithUA } from "~/utils/fetch";

//     // const geoLine = lineString(geometry2);

//     // const roadSegments = lineSplit(geoLine, geoBorder).features.filter((part) =>
//     //   booleanPointInPolygon(point(part.geometry.coordinates[0]!), geoBorder),
//     // );
//     // console.log(roadSegments.length);
//     // if (roadSegments.length === 0) {
//     //   console.log(geometry2, border, lineSplit(geoLine, geoBorder));
//     //   // throw "dang";
//     // }

type PlaceProperties = {};

interface Place extends Feature<Polygon> {
  bbox: BBox2d;
}

type RoadProperties = {
  name: string;
  alternateNames: string[];
  segmentCount: number | undefined;
};
interface Road extends Feature<LineString, RoadProperties> {
  id: string;
}

export type PlaceResponse = {
  place: Place;
  roads: Road[];
};

export const placeRouter = createTRPCRouter({
  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }): Promise<PlaceResponse> => {
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
      const [place, ...roads] = osmtogeojson(await response.json()).features;
      if (!place || !isFeature(place, "Polygon")) {
        throw "First result was not a polygon";
      }
      return {
        place: { ...place, bbox: (place.bbox ?? bbox(place)) as BBox2d },
        roads: roads.flatMap((road): [Road] | [] => {
          if (!isFeature(road, "LineString") || road.properties == null) {
            console.log("skipping road " + road.id);
            return [];
          }
          const alternateNames = [
            road.properties.name,
            road.properties.alt_name,
            road.properties.short_name,
            road.properties.nickname,
            road.properties.old_name,
            road.properties["name:left"],
            road.properties["name:right"],
            road.properties["bridge:name"],
          ].filter((name): name is string => !!name && name.length > 0);

          const displayName = alternateNames[0];
          if (!displayName) {
            return [];
          }
          return [
            {
              ...road,
              id: road.properties.id!,
              properties: {
                name: displayName,
                alternateNames: alternateNames.map((name) =>
                  name.toLowerCase(),
                ),
                segmentCount: undefined,
              },
            },
          ];
        }),
      };
    }),
});

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
    );
    out geom;`;
}
