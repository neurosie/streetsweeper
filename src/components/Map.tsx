import bbox from "@turf/bbox";
import bboxPolygon from "@turf/bbox-polygon";
import { type BBox2d } from "@turf/helpers/dist/js/lib/geojson";
import transformScale from "@turf/transform-scale";
import mapboxgl, { type IControl } from "mapbox-gl";
import { useEffect, useRef, useState } from "react";
import { type PlaceResponse } from "~/server/geo/geojson";

export default function Map({
  place,
  guessedRoads,
  finished,
  className,
  newMatches,
}: {
  place: PlaceResponse;
  guessedRoads: string[];
  className: string | undefined;
  finished: boolean;
  newMatches: string[];
}) {
  const [map, setMap] = useState<mapboxgl.Map>();
  const mapContainer = useRef(null);

  mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN!;

  useEffect(() => {
    if (!place) {
      return;
    }

    const initialBounds = bbox(
      transformScale(bboxPolygon(place.place.bbox), 1.1),
    ) as BBox2d;

    const map = new mapboxgl.Map({
      container: mapContainer.current!,
      style: "mapbox://styles/neurosie/clnorauph008x01p3db1a6tuf",
      customAttribution:
        'Street data from <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxPitch: 0,
      dragRotate: false,
      bounds: initialBounds,
    });

    map.touchZoomRotate.disableRotation();
    map.keyboard.disableRotation();
    map.addControl(new RecenterControl(initialBounds), "bottom-right");

    map.on("load", () => {
      map.setMaxBounds(map.getBounds());

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
              12,
              8,
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
          id: "roads-halo",
          type: "line",
          source: "roads",
          layout: {
            "line-join": "round",
            "line-cap": "round",
          },
          paint: {
            "line-opacity": [
              "case",
              ["boolean", ["feature-state", "glow"], false],
              0.8,
              0,
            ],
            "line-blur": [
              "interpolate",
              ["exponential", 2],
              ["zoom"],
              10,
              2,
              15,
              16,
            ],
            "line-color": "hsl(58, 91%, 41%)",
            "line-width": [
              "interpolate",
              ["exponential", 2],
              ["zoom"],
              10,
              6,
              15,
              48,
            ],
          },
        },
        "boundary",
      );
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
        "roads-halo",
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

    if (process.env.NODE_ENV !== "development") {
      return () => map.remove();
    }
  }, [place]);

  // Turned guessed roads blue
  useEffect(() => {
    if (!map) return;
    // There's some race condition where if setFeatureState is called too close to the
    // first render it just doesn't work. 1ms delay resolves it.
    setTimeout(() => {
      for (const roadId of guessedRoads) {
        map.setFeatureState({ source: "roads", id: roadId }, { guessed: true });
      }
    }, 0);
  }, [map, guessedRoads]);

  // Highlight the last guessed roads
  const previousMatches = usePrevious(newMatches);
  useEffect(() => {
    if (!map) return;
    if (previousMatches) {
      for (const roadId of previousMatches) {
        map.setFeatureState({ source: "roads", id: roadId }, { glow: false });
      }
    }
    for (const roadId of newMatches) {
      map.setFeatureState({ source: "roads", id: roadId }, { glow: true });
    }
  }, [map, newMatches, previousMatches]);

  // Reveal all roads when the game is over
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
          { source: "roads", id: road.properties.name },
          { guessed: false },
        );
      }
    }
  }, [map, finished, place]);

  return <div id="my-map" ref={mapContainer} className={className} />;
}

const labelOpacityExpression: mapboxgl.Expression = [
  "case",
  ["boolean", ["feature-state", "guessed"], false],
  1,
  0,
];

const usePrevious = <T,>(value: T): T | undefined => {
  const ref = useRef<T>();
  useEffect(() => {
    ref.current = value;
  });
  return ref.current;
};

class RecenterControl implements IControl {
  private initialBounds: BBox2d;
  private container: HTMLElement | undefined;

  constructor(initialBounds: BBox2d) {
    this.initialBounds = initialBounds;
  }

  onAdd(map: mapboxgl.Map): HTMLElement {
    this.container = document.createElement("div");
    this.container.className = "mapboxgl-ctrl mapboxgl-ctrl-group";
    const button = document.createElement("button");
    button.className = "mapboxgl-ctrl-icon";
    button.title = "Recenter";
    button.ariaLabel = "Recenter";
    button.innerHTML = crosshair;
    button.onclick = () => {
      map.fitBounds(this.initialBounds);
    };
    this.container.appendChild(button);
    return this.container;
  }

  onRemove(_map: mapboxgl.Map): void {
    this.container?.parentNode!.removeChild(this.container);
  }
}

const crosshair = `
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M12 3V7M12 17V21M3 12H7M17 12H21M12 12H12.01M19 12C19 15.866 15.866 19 12 19C8.13401 19 5 15.866 5 12C5 8.13401 8.13401 5 12 5C15.866 5 19 8.13401 19 12Z"
      stroke="#000000"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
`;
