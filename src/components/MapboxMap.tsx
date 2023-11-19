import mapboxgl from "mapbox-gl";
import { useEffect, useState } from "react";
import { type PlaceResponse } from "~/server/geo/geojson";

export default function MapboxMap({
  place,
  guessedRoads,
  className,
}: {
  place: PlaceResponse;
  guessedRoads: string[];
  className: string | undefined;
}) {
  const [map, setMap] = useState<mapboxgl.Map>();

  mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN!;

  useEffect(() => {
    if (!place) {
      return;
    }
    const map = new mapboxgl.Map({
      container: "my-map",
      style: "mapbox://styles/neurosie/clnorauph008x01p3db1a6tuf",
      bounds: place.place.bbox,
    });

    map.on("load", () => {
      // Get the first layer with text, so other layers can be placed below it
      let firstSymbolId;
      for (const layer of map.getStyle().layers) {
        if (layer.type === "symbol") {
          firstSymbolId = layer.id;
          break;
        }
      }

      map.addSource("boundary", {
        type: "geojson",
        data: place.place,
      });
      map.addLayer(
        {
          id: "boundary",
          type: "line",
          source: "boundary",
          layout: {},
          paint: {
            "line-color": "hsl(209, 80%, 20%)",
            "line-width": [
              "interpolate",
              ["exponential", 2],
              ["zoom"],
              10,
              2,
              15,
              32,
            ],
          },
        },
        firstSymbolId,
      );

      map.addSource("roads", {
        type: "geojson",
        data: place.roads,
        promoteId: "id",
      });
      map.addLayer(
        {
          id: "roads",
          type: "line",
          source: "roads",
          layout: {
            "line-join": "round",
            "line-cap": "round",
          },
          paint: {
            "line-color": [
              "case",
              ["boolean", ["feature-state", "guessed"], false],
              "hsl(161, 97%, 32%)",
              "hsl(209, 20%, 70%)",
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
        },
        "boundary",
      );

      map.addLayer({
        id: "roadNames",
        type: "symbol",
        source: "roads",
        layout: {
          "text-field": "{name}",
          "symbol-placement": "line",
          "text-size": 14,
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

      setMap(map);
    });
  }, [place]);

  useEffect(() => {
    if (!map) {
      return;
    }
    for (const roadId of guessedRoads) {
      map.setFeatureState({ source: "roads", id: roadId }, { guessed: true });
    }
  }, [guessedRoads, map]);

  return <div id="my-map" className={className} />;
}
