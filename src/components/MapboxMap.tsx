import mapboxgl from "mapbox-gl";
import { useEffect, useState } from "react";

export default function MapboxMap({ data }: { data: any }) {
  const [map, setMap] = useState<mapboxgl.Map>();

  mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN!;

  useEffect(() => {
    if (!data) {
      return;
    }
    const city = data.elements[0];
    const bounds = city.bounds;
    let map = new mapboxgl.Map({
      container: "my-map",
      style: "mapbox://styles/neurosie/cllwx185501bg01qi8q5l4ntt",
      bounds: [
        [bounds.minlon, bounds.minlat],
        [bounds.maxlon, bounds.maxlat],
      ],
    });

    const coordinates = [
      city.members
        .filter((node: any) => node.type === "way" && node.role === "outer")
        .flatMap((node: any) =>
          node.geometry.map(({ lat, lon }: { lat: number; lon: number }) => [
            lon,
            lat,
          ]),
        ),
    ];

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

      data.elements.slice(1).forEach((road: any, i: number) => {
        const roadCoords = road.geometry.map(
          ({ lat, lon }: { lat: number; lon: number }) => [lon, lat],
        );
        const layerId = `road-${i}`;
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
            "line-width": 3,
          },
        });
      });
    });

    setMap(map);
  }, [data]);

  return <div id="my-map" style={{ height: 700, width: 800 }} />;
}
