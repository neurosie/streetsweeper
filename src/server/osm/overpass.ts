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
 * Build Overpass query to fetch municipalities for a US state
 * @param stateISO - Two-letter state code (e.g., "RI", "MA")
 *
 * Query strategy:
 * - admin_level=8: Standard municipalities (cities, towns, villages)
 * - admin_level=6 + border_type~city: Consolidated city-counties and independent cities
 *   (e.g., San Francisco, Denver, Baltimore, St. Louis, VA independent cities)
 * - admin_level=7 + border_type~city|borough (NY only): NY cities use level 7,
 *   plus NYC boroughs (Brooklyn, Queens, Manhattan, Bronx, Staten Island)
 */
export function buildMunicipalitiesQuery(stateISO: string): string {
  // NY uses admin_level=7 for cities and boroughs
  const nySpecificQuery =
    stateISO === "NY"
      ? `relation["boundary"="administrative"]["admin_level"="7"]["border_type"~"city|borough"](area.state);`
      : "";

  return `[out:json];
area["ISO3166-2"="US-${stateISO}"]->.state;
(
  relation["boundary"="administrative"]["admin_level"="8"](area.state);
  relation["boundary"="administrative"]["admin_level"="6"]["border_type"~"city"](area.state);
  ${nySpecificQuery}
);
out center tags;`;
}
