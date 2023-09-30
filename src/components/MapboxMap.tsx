import mapboxgl from "mapbox-gl";
import { useEffect, useState } from "react";
import { PlaceResponse } from "~/server/api/routers/place";

export default function MapboxMap({
  place,
  guessedRoads,
}: {
  place: PlaceResponse;
  guessedRoads: Set<string>;
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
      bounds: place.place.bbox,
    });

    map.on("load", () => {
      map.addSource("boundary", {
        type: "geojson",
        data: place.place,
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
        const layerId = `road-${road.id}`;
        map.addSource(layerId, {
          type: "geojson",
          data: road,
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
      className="h-[600px] w-full md:max-w-[800px] md:self-center"
    />
  );
}
