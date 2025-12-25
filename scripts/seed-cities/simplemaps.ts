import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";
import { SimpleMapsRowSchema, type SimpleMapsRow } from "./types";

const DATA_DIR = path.join(__dirname, "../data");
const CSV_PATH = path.join(DATA_DIR, "uscities.csv");

export function loadSimpleMaps(): SimpleMapsRow[] {
  if (!fs.existsSync(CSV_PATH)) {
    console.error("\n❌ SimpleMaps data not found!");
    console.error(`Expected location: ${CSV_PATH}`);
    console.error("\nPlease download it from:");
    console.error("https://simplemaps.com/data/us-cities");
    console.error("\nDownload the Basic (free) dataset");
    console.error("Save as: scripts/data/uscities.csv\n");
    process.exit(1);
  }

  const fileContent = fs.readFileSync(CSV_PATH, "utf-8");
  const rows = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
  }) as unknown[];

  // Validate with Zod
  return rows.map((row) => SimpleMapsRowSchema.parse(row));
}

// Group by state for efficient filtering
export function groupByState(
  cities: SimpleMapsRow[],
): Map<string, SimpleMapsRow[]> {
  const grouped = new Map<string, SimpleMapsRow[]>();

  for (const city of cities) {
    const stateId = city.state_id.toUpperCase();
    if (!grouped.has(stateId)) {
      grouped.set(stateId, []);
    }
    grouped.get(stateId)!.push(city);
  }

  return grouped;
}
