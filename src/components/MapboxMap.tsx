import mapboxgl from "mapbox-gl";
import { useEffect, useState } from "react";
import { Place } from "~/server/api/routers/place";

export default function MapboxMap({
  place,
  guessedRoads,
}: {
  place: Place;
  guessedRoads: Set<number>;
}) {
  const [map, setMap] = useState<mapboxgl.Map>();

  mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN!;

  useEffect(() => {
    if (!place) {
      return;
    }
    let map = new mapboxgl.Map({
      container: "my-map",
      style: "mapbox://styles/neurosie/cllwx185501bg01qi8q5l4ntt",
      bounds: [
        [place.bounds.minlon, place.bounds.minlat],
        [place.bounds.maxlon, place.bounds.maxlat],
      ],
    });

    const coordinates = [place.border.map(({ lat, lon }) => [lon, lat])];

    map.on("load", () => {
      map.addSource("boundary", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: { type: "Polygon", coordinates },
        },
      });

      map.addLayer({
        id: "boundary",
        type: "line",
        source: "boundary",
        layout: {},
        paint: {
          "line-color": "#000",
          "line-width": 3,
        },
      });

      place.roads.map((road) => {
        const roadCoords = road.geometry.map(
          ({ lat, lon }: { lat: number; lon: number }) => [lon, lat],
        );
        const layerId = `road-${road.id}`;
        map.addSource(layerId, {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: { type: "LineString", coordinates: roadCoords },
          },
        });

        map.addLayer({
          id: layerId,
          type: "line",
          source: layerId,
          layout: {
            "line-join": "round",
            "line-cap": "round",
          },
          paint: {
            "line-color": "#888",
            "line-width": [
              "interpolate",
              ["exponential", 2],
              ["zoom"],
              10,
              1,
              15,
              16,
            ],
            "line-color-transition": { duration: 500 },
          },
        });
      });
    });

    setMap(map);
  }, [place]);

  useEffect(() => {
    if (!place || !map) {
      return;
    }
    for (const roadId of guessedRoads) {
      map.setPaintProperty(`road-${roadId}`, "line-color", "#03e");
    }
  }, [place, guessedRoads]);

  return (
    <div
      id="my-map"
      className="h-80 w-full"
      // style={{ height: 500 /*, width: 800*/ }}
    />
  );
}
