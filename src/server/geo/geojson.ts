import { type Position } from "geojson";
import bbox from "@turf/bbox";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { type BBox2d } from "@turf/helpers/dist/js/lib/geojson";
import length from "@turf/length";
import lineSplit from "@turf/line-split";
import {
  type MultiPolygon,
  type Feature,
  type FeatureCollection,
  type Geometry,
  type LineString,
  type MultiLineString,
  type Polygon,
} from "geojson";
import osmtogeojson from "osmtogeojson";
import { generateAbbreviations } from "./abbreviations";
import { z } from "zod";
import booleanIntersects from "@turf/boolean-intersects";

/**
 * Top-level geodata for a city or town.
 */
export interface Place
  extends Feature<Polygon | MultiPolygon, PlaceProperties> {
  bbox: BBox2d;
}
type PlaceProperties = {
  name: string;
  totalLengthMi: number;
};

/**
 * Geodata for all road segments in a Place with a particular name.
 */
export type Road = Feature<LineString | MultiLineString, RoadProperties>;
type RoadProperties = {
  name: string;
  id: string;
  // osmIds: string[];
  alternateNames: string[];
  lengthMi: number;
};

/**
 * API response for a Place and all its contained roads.
 */
export type PlaceResponse = {
  place: Place;
  roads: TypedCollection<Road>;
};

export interface TypedCollection<T extends Feature>
  extends FeatureCollection<T["geometry"], T["properties"]> {
  features: Array<T>;
}

const OsmPlaceProperties = z.object({
  name: z.string(),
  population: z.string().optional(),
});

export function transformGeodata(response: unknown): PlaceResponse {
  const [place, ...roads] = osmtogeojson(response).features;

  if (!place || !isPolygonOrMultiPolygon(place)) {
    throw `First result was a ${place?.geometry.type}, not a (Multi)Polygon`;
  }

  // Group all OSM road segments by their main name, gathering relevant data they carry with them.
  const roadSegmentMap = new Map<
    string, // display name
    {
      segments: MultiLineString["coordinates"];
      alternateNames: Set<string>;
      ids: Set<string>;
    }
  >();

  for (const road of roads) {
    if (!isFeature(road, "LineString") || road.properties == null) {
      console.log(`skipping road ${road.id} (${road.type})`);
      continue;
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
      continue;
    }

    const id: unknown = road.properties.id;
    if (typeof id !== "string") {
      continue;
    }

    let segments: MultiLineString["coordinates"];
    // Check if the road exits the place border, and if it does trim it down.
    // Algorithm based on https://gis.stackexchange.com/a/459122,
    // modified to check a point slightly inside each segment instead of the strict beginning,
    // as I found that to be imprecise for bounds checking.
    const roadSegments = lineSplit(road, place).features;
    // TODO: buffer place in lineSplit above, check how that interacts with MultiPolygon/enclaves
    // Then check against roads lying on borders (way/12515907)
    if (roadSegments.length === 0) {
      segments = [road.geometry.coordinates];
    } else {
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
        continue;
      }

      segments = inBoundsSegments.map((seg) => seg.geometry.coordinates);
    }

    const savedRoad = roadSegmentMap.get(displayName);
    if (savedRoad) {
      roadSegmentMap.set(displayName, {
        segments: [...savedRoad.segments, ...segments],
        alternateNames: new Set([
          ...savedRoad.alternateNames,
          ...alternateNames,
        ]),
        ids: new Set([...savedRoad.ids, id]),
      });
    } else {
      roadSegmentMap.set(displayName, {
        segments,
        alternateNames: new Set(alternateNames),
        ids: new Set([id]),
      });
    }
  }

  // For each logical road (potentially many segments that share a name)
  // - finalize the geometry
  // - synthesize an ID from the segment IDs
  // - generate acceptable short names for guessing
  const finalRoads: PlaceResponse["roads"] = {
    type: "FeatureCollection",
    features: Array.from(
      roadSegmentMap,
      ([name, { segments, alternateNames, ids }]) => {
        const unifiedSegments = unifySegments(segments);
        let geometry: LineString | MultiLineString;
        if (unifiedSegments.length === 1) {
          geometry = { type: "LineString", coordinates: unifiedSegments[0]! };
        } else {
          geometry = { type: "MultiLineString", coordinates: unifiedSegments };
        }

        const sortedIds = Array.from(ids).sort();

        return {
          type: "Feature",
          geometry,
          properties: {
            name,
            id: sortedIds.join("-"),
            alternateNames: Array.from(
              new Set(
                Array.from(alternateNames).flatMap((name) =>
                  generateAbbreviations(name, "easy"),
                ),
              ),
            ),
            lengthMi: length(
              { type: "Feature", geometry, properties: {} },
              { units: "miles" },
            ),
          },
        };
      },
    ),
  };

  // For the place boundary, exclude any polygons that don't have roads in them.
  let placeGeometry = place.geometry;
  if (place.geometry.type === "MultiPolygon") {
    const polysWithRoads: MultiPolygon["coordinates"] = [];
    for (const poly of place.geometry.coordinates) {
      if (
        finalRoads.features.some((road) =>
          booleanIntersects({ type: "Polygon", coordinates: poly }, road),
        )
      ) {
        polysWithRoads.push(poly);
      }
    }
    if (polysWithRoads.length === 0) {
      throw "No boundary polygons contained roads.";
    } else if (polysWithRoads.length === 1) {
      placeGeometry = { type: "Polygon", coordinates: polysWithRoads[0]! };
    } else {
      placeGeometry = { type: "MultiPolygon", coordinates: polysWithRoads };
    }
  }

  const placeProperties = OsmPlaceProperties.parse(place.properties);

  return {
    place: {
      type: "Feature",
      geometry: placeGeometry,
      id: place.id,
      bbox: bbox(finalRoads) as BBox2d,
      properties: {
        name: placeProperties.name,
        totalLengthMi: finalRoads.features.reduce(
          (sum, road) => sum + road.properties.lengthMi,
          0,
        ),
      },
    },
    roads: finalRoads,
  };
}

function isFeature<T extends Feature["geometry"]["type"]>(
  feature: Feature,
  type: T,
): feature is Feature<Extract<Geometry, { type: T }>> {
  return feature.geometry.type === type;
}

function isPolygonOrMultiPolygon(
  feature: Feature,
): feature is Feature<Polygon | MultiPolygon> {
  return isFeature(feature, "Polygon") || isFeature(feature, "MultiPolygon");
}

// Takes a MultiLineString geometry and joins segments that meet at their endpoints.
export function unifySegments(
  segments: MultiLineString["coordinates"],
): typeof segments {
  const segmentSet = new Set(segments);
  const joinedSegments: typeof segments = [];
  while (true) {
    let segmentA = setPop(segmentSet);
    if (!segmentA) {
      // All segments processed
      return joinedSegments;
    }
    extend: while (true) {
      const startA = segmentA[0]!;
      const endA = segmentA[segmentA.length - 1]!;
      search: for (const segmentB of segmentSet.values()) {
        const startB = segmentB[0]!;
        const endB = segmentB[segmentB.length - 1]!;
        if (coordEqual(startB, startA)) {
          segmentA = segmentB.slice().reverse().concat(segmentA.slice(1));
        } else if (coordEqual(endB, startA)) {
          segmentA = segmentB.concat(segmentA.slice(1));
        } else if (coordEqual(startB, endA)) {
          segmentA = segmentA.concat(segmentB.slice(1));
        } else if (coordEqual(endB, endA)) {
          segmentA = segmentA.concat(segmentB.slice(0, -1).reverse());
        } else {
          // No match, keep searching through unmatched segments
          continue search;
        }
        // Match found and segment extended, try to extend again
        segmentSet.delete(segmentB);
        continue extend;
      }
      // All matches exhausted
      break extend;
    }
    joinedSegments.push(segmentA);
  }
}

function setPop<T>(set: Set<T>) {
  for (const value of set) {
    set.delete(value);
    return value;
  }
  return null;
}

const COORD_EPSILON = 0.000001; // 3 feet of latitude
function coordEqual(a: Position, b: Position) {
  return (
    Math.abs(a[0]! - b[0]!) < COORD_EPSILON &&
    Math.abs(a[1]! - b[1]!) < COORD_EPSILON
  );
}

// Utility for representing geo coordinates as a 2 digit hex hash, for debugging purposes
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function hashCoord(coord: Position) {
  const buf = new ArrayBuffer(16);
  const buf1 = new Float64Array(buf);
  buf1[0] = coord[0]!;
  buf1[1] = coord[1]!;
  const buf2 = new Uint32Array(buf);
  return (buf2[1]! % 16).toString(16) + (buf2[3]! % 16).toString(16);
}
