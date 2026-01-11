// Re-export shared state data
export { US_STATES } from "../../src/data/states";

export const SPECIAL_OSM_CITY_IDS: Array<{
  osmId: number;
  stateId: string;
  name: string;
}> = [
  // New York City (admin_level=5, unique consolidated city)
  { osmId: 175905, stateId: "NY", name: "New York City" },
  // Honolulu, HI (boundary="place" instead of "administrative")
  { osmId: 119231, stateId: "HI", name: "Honolulu" },
  // Washington, D.C. (boundary="place" instead of "administrative")
  { osmId: 5396194, stateId: "DC", name: "Washington" },
];
