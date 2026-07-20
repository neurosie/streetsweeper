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
  const mapContainer = useRef<HTMLDivElement>(null);
  const initialBounds = useRef<BBox2d>();
  const hasInteracted = useRef(false);

  mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN!;

  useEffect(() => {
    if (!place) {
      return;
    }

    const bounds = bbox(
      transformScale(bboxPolygon(place.place.bbox), 1.1),
    ) as BBox2d;
    initialBounds.current = bounds;
    hasInteracted.current = false;

    const map = new mapboxgl.Map({
      container: mapContainer.current!,
      style: "mapbox://styles/neurosie/clnorauph008x01p3db1a6tuf",
      customAttribution:
        'Street data from <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxPitch: 0,
      dragRotate: false,
      bounds,
    });

    map.touchZoomRotate.disableRotation();
    map.keyboard.disableRotation();
    map.addControl(
      new RecenterControl(bounds, () => {
        hasInteracted.current = false;
      }),
      "bottom-right",
    );

    map.on("load", () => {
      // Skipped for the hidden breakpoint's map, which has no real size yet;
      // the resize observer sets the limit once it's actually shown.
      if ((mapContainer.current?.clientHeight ?? 0) > 0) {
        updateMaxBounds(map, bounds);
      }

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
        promoteId: "name",
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

  // Note a deliberate pan or zoom, so that resizing the viewport afterwards
  // doesn't throw away the framing the user chose. Every gesture path fires
  // movestart carrying the originalEvent that caused it, while programmatic
  // moves (fitBounds, jumpTo, resize) pass no event data at all. Listening to
  // dragstart/zoomstart instead would miss box zoom and keyboard panning.
  useEffect(() => {
    if (!map) return;

    const markInteracted = (event: { originalEvent?: unknown }) => {
      if (event.originalEvent) {
        hasInteracted.current = true;
      }
    };

    map.on("movestart", markInteracted);
    return () => {
      map.off("movestart", markInteracted);
    };
  }, [map]);

  // Keep the canvas in sync with its container. mapbox-gl 2.x doesn't observe
  // its container, so when the mobile keyboard opens or closes the canvas keeps
  // its old dimensions and the map no longer fills the space.
  useEffect(() => {
    const container = mapContainer.current;
    if (!map || !container) return;

    let lastWidth = container.clientWidth;
    let lastHeight = container.clientHeight;
    let refitQueued = false;

    // Recomputing the limit resets mapbox's input handlers and clears inertia,
    // so defer it while a gesture or animation is running. Without this, a drag
    // that dismisses the keyboard is cancelled by the resize it triggers.
    const applyMaxBounds = () => {
      const bounds = initialBounds.current;
      if (!bounds) return;

      if (map.isMoving() || map.isZooming()) {
        if (!refitQueued) {
          refitQueued = true;
          map.once("moveend", () => {
            refitQueued = false;
            applyMaxBounds();
          });
        }
        return;
      }

      updateMaxBounds(map, bounds);
    };

    const observer = new ResizeObserver(() => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      // Both breakpoint layouts stay mounted and CSS hides one, so this fires
      // for a container with no size. mapbox substitutes a fabricated 400x300
      // viewport in that case, and a limit measured against it would describe a
      // viewport that never existed. Wait until the container is really shown;
      // the size will differ from the last seen one, so this still runs then.
      if (width === 0 || height === 0) return;
      // Nothing to do when the size is unchanged, which also covers the
      // callback ResizeObserver delivers on observe(): the map is already
      // sized correctly there, and skipping keeps it from animating on mount.
      if (width === lastWidth && height === lastHeight) return;
      lastWidth = width;
      lastHeight = height;

      // Release the limit before resizing. resize() re-constrains the camera,
      // and a limit measured against the old size would clamp zoom and centre
      // to fit a viewport that no longer exists.
      map.setMaxBounds(undefined);
      // Keeps whatever is centered centered, at the current zoom.
      map.resize();
      applyMaxBounds();

      // Until the user has framed the map themselves, keep it fitted to the
      // place so the whole area stays visible as the viewport changes.
      if (!hasInteracted.current && initialBounds.current) {
        map.fitBounds(initialBounds.current, { duration: 300 });
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [map]);

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

/**
 * Limit panning to roughly what's visible when the place is fitted to the
 * viewport.
 *
 * This has to be recomputed whenever the container resizes. The limit is
 * derived from what fits on screen, so one computed for a full-height viewport
 * is too tight once the keyboard shrinks the map: fitting the same place in a
 * shorter viewport needs a wider view, which the old limit forbids, leaving the
 * user unable to zoom out far enough to see the whole boundary.
 *
 * The camera is saved and restored around the measurement, so this only reads
 * the fitted extent rather than moving the map. Both calls are synchronous and
 * mapbox renders on an animation frame, so nothing is drawn in between.
 */
function updateMaxBounds(map: mapboxgl.Map, placeBounds: BBox2d) {
  const center = map.getCenter();
  const zoom = map.getZoom();

  map.setMaxBounds(undefined);
  map.fitBounds(placeBounds, { duration: 0 });
  const limit = map.getBounds();

  map.jumpTo({ center, zoom });
  map.setMaxBounds(limit);
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
  private onRecenter: () => void;
  private container: HTMLElement | undefined;

  constructor(initialBounds: BBox2d, onRecenter: () => void) {
    this.initialBounds = initialBounds;
    this.onRecenter = onRecenter;
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
      this.onRecenter();
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
