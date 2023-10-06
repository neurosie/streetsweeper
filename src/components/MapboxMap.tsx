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

      map.addSource("roads", {
        type: "geojson",
        data: place.roads,
        promoteId: "id",
      });
      map.addLayer({
        id: "roads",
        type: "line",
        source: "roads",
        // textField: "name",
        layout: {
          "line-join": "round",
          "line-cap": "round",
        },
        paint: {
          "line-color": [
            "case",
            ["boolean", ["feature-state", "guessed"], false],
            "#03e",
            "#888",
          ],
          "line-width": [
            "interpolate",
            ["exponential", 2],
            ["zoom"],
            10,
            1,
            15,
            16,
          ],
        },
      });
      map.addLayer({
        id: "roadNames",
        type: "symbol",
        source: "roads",
        layout: {
          "text-field": "{name}",
          "symbol-placement": "line",
        },
        paint: {
          "text-halo-color": "#fff",
          "text-halo-width": 2,
          "text-opacity": [
            "case",
            ["boolean", ["feature-state", "guessed"], false],
            1,
            0,
          ],
        },
      });
    });

    setMap(map);
  }, [place]);

  useEffect(() => {
    if (!place || !map) {
      return;
    }
    for (const roadId of guessedRoads) {
      map.setFeatureState({ source: "roads", id: roadId }, { guessed: true });
    }
  }, [place, guessedRoads]);

  return (
    <div
      id="my-map"
      className="h-[600px] w-full md:max-w-[800px] md:self-center"
    />
  );
}
