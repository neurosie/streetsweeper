import { readFileSync } from "fs";
import { join } from "path";

export type CityData = {
  name: string;
  state: string;
  stateId: string;
  county: string | null;
  population: number | null;
  osmId: number;
  osmType: string;
  displayName: string;
};

/**
 * Load city data from the JSONL file checked into the repo.
 * Each line is a JSON object with search-relevant fields.
 */
export function loadCities(): CityData[] {
  const filePath = join(process.cwd(), "data", "cities.jsonl");
  const content = readFileSync(filePath, "utf-8");
  return content
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as CityData);
}
