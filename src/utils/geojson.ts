import { type Position } from "geojson";
import { type Road } from "~/server/api/routers/place";

// There's bookkeeping here for joining length but not any other properties,
// so alternate names may potentially be lost if they only apply to a subset of segments.
// IDK if that will come up in practice.
//
// Whichever segment is picked first gives its ID to the whole joined road, and that's non-deterministic.
// That could be an issue later if I want to aggregate stats by road.
export function joinRoadSegments(roads: Road[]): Road[] {
  const keyedRoads: Record<string, Set<Road>> = {};
  for (const road of roads) {
    const roadName = road.properties.name;
    if (!(roadName in keyedRoads)) {
      keyedRoads[roadName] = new Set([road]);
    } else {
      keyedRoads[roadName]!.add(road);
    }
  }

  const joinedRoads = Object.values(keyedRoads).flatMap((roads) => {
    const joinedRoads: Road[] = [];
    while (true) {
      const seg = setPop(roads);
      if (!seg) {
        return joinedRoads;
      }
      let coordsA = seg.geometry.coordinates;
      let length = seg.properties.lengthMi;
      extend: while (true) {
        const startA = coordsA[0]!;
        const endA = coordsA[coordsA.length - 1]!;
        search: for (const roadB of roads.values()) {
          const coordsB = roadB.geometry.coordinates;
          const startB = coordsB[0]!;
          const endB = coordsB[coordsB.length - 1]!;
          if (coordEqual(startB, startA)) {
            coordsA = coordsB.slice().reverse().concat(coordsA);
          } else if (coordEqual(endB, startA)) {
            coordsA = coordsB.concat(coordsA);
          } else if (coordEqual(startB, endA)) {
            coordsA = coordsA.concat(coordsB);
          } else if (coordEqual(endB, endA)) {
            coordsA = coordsA.concat(coordsB.slice().reverse());
          } else {
            // No match, keep searching through unmatched segments
            continue search;
          }
          // Match found and segment extended, try to extend again
          length += roadB.properties.lengthMi;
          roads.delete(roadB);
          continue extend;
        }
        // All matches exhausted
        break extend;
      }
      seg.geometry.coordinates = coordsA;
      seg.properties.lengthMi = length;
      joinedRoads.push(seg);
    }
  });
  return joinedRoads;
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
