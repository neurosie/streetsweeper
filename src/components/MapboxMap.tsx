import mapboxgl from "mapbox-gl";
import { useEffect } from "react";

export default function MapboxMap() {
  mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN!;

  useEffect(() => {
    // setPageIsMounted(true);

    let map = new mapboxgl.Map({
      container: "my-map",
      style: "mapbox://styles/neurosie/cllwx185501bg01qi8q5l4ntt",
      center: [-73.692371, 42.726931], // 42.726931, -73.692371
      zoom: 12,
      // pitch: 45,
      // maxBounds: [
      //     [-77.875588, 38.50705], // Southwest coordinates
      //     [-76.15381, 39.548764], // Northeast coordinates
      // ],
    });

    initializeMap(map);
    // setMap(map);
  }, []);

  return <div id="my-map" style={{ height: 500, width: 500 }} />;
}

function initializeMap(map: mapboxgl.Map) {
  // add event listeners
}
