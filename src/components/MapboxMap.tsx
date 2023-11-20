import mapboxgl from "mapbox-gl";
import { useEffect, useState } from "react";
import { type PlaceResponse } from "~/server/geo/geojson";

export default function MapboxMap({
  place,
  guessedRoads,
  finished,
  className,
}: {
  place: PlaceResponse;
  guessedRoads: string[];
  className: string | undefined;
  finished: boolean;
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
              24,
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
              "hsl(209, 92%, 50%)",
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
          "text-opacity": labelOpacityExpression,
        },
      });

      setMap(map);
    });
  }, [place]);

  if (map) {
    for (const roadId of guessedRoads) {
      map.setFeatureState({ source: "roads", id: roadId }, { guessed: true });
    }
  }

  useEffect(() => {
    if (!map) {
      return;
    }
    if (finished) {
      map.setPaintProperty("roadNames", "text-opacity", 1);
    } else {
      map.setPaintProperty("roadNames", "text-opacity", labelOpacityExpression);
      for (const road of place.roads.features) {
        map.setFeatureState(
          { source: "roads", id: road.properties.id },
          { guessed: false },
        );
      }
    }
  }, [map, finished, place]);

  return <div id="my-map" className={className} />;
}

const labelOpacityExpression: mapboxgl.Expression = [
  "case",
  ["boolean", ["feature-state", "guessed"], false],
  1,
  0,
];
