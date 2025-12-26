import { fetchWithUA } from "~/utils/fetch";
import { retryWithBackoff, RATE_LIMIT_BACKOFF_OPTIONS } from "~/utils/backoff";

/**
 * Execute an Overpass API query with retry and exponential backoff
 * @param query - Overpass QL query string
 * @returns Parsed JSON response
 */
export async function queryOverpass<T = unknown>(query: string): Promise<T> {
  return retryWithBackoff(async () => {
    const response = await fetchWithUA(
      "	https://overpass.private.coffee/api/interpreter",
      {
        method: "POST",
        body: "data=" + encodeURIComponent(query),
      },
    );

    if (!response.ok) {
      throw new Error(
        `Overpass API error: ${response.status} ${response.statusText}`,
      );
    }

    return (await response.json()) as T;
  }, RATE_LIMIT_BACKOFF_OPTIONS);
}

/**
 * Build Overpass query to fetch street data for a specific OSM relation
 */
export function buildStreetsQuery(relationId: string): string {
  return `[out:json];
    relation(${relationId})->.orig;
    .orig out geom;
    .orig map_to_area->.searchArea;
    (
        nwr["highway"="residential"](area.searchArea);
        nwr["highway"="unclassified"](area.searchArea);
        nwr["highway"="primary"](area.searchArea);
        nwr["highway"="secondary"](area.searchArea);
        nwr["highway"="tertiary"](area.searchArea);
        nwr["highway"="trunk"](area.searchArea);
    );
    out geom;`;
}

/**
 * Build Overpass query to fetch municipalities (admin_level=8) for a US state
 * @param stateISO - Two-letter state code (e.g., "RI", "MA")
 */
export function buildMunicipalitiesQuery(stateISO: string): string {
  return `[out:json];
area["ISO3166-2"="US-${stateISO}"]->.state;
(
  relation["boundary"="administrative"]["admin_level"="8"](area.state);
);
out center tags;`;
}
