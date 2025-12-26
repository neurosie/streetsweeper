import { z } from "zod";

// OSM Overpass API response types
export const OsmTagsSchema = z
  .object({
    name: z.string().optional(),
    admin_level: z.string().optional(),
    boundary: z.string().optional(),
    "addr:county": z.string().optional(),
    wikidata: z.string().optional(),
    population: z.string().optional(),
  })
  .passthrough(); // Allow other properties

export const OsmElementSchema = z.object({
  type: z.enum(["node", "way", "relation"]),
  id: z.number(),
  center: z
    .object({
      lat: z.number(),
      lon: z.number(),
    })
    .optional(),
  lat: z.number().optional(),
  lon: z.number().optional(),
  tags: OsmTagsSchema,
});

export const OverpassResponseSchema = z.object({
  elements: z.array(OsmElementSchema),
});

export type OsmElement = z.infer<typeof OsmElementSchema>;

// SimpleMaps CSV types
export const SimpleMapsRowSchema = z.object({
  city: z.string(),
  city_ascii: z.string(),
  state_id: z.string(),
  state_name: z.string(),
  county_name: z.string().optional().default(""),
  lat: z.coerce.number(),
  lng: z.coerce.number(),
  population: z.coerce.number(),
});

export type SimpleMapsRow = z.infer<typeof SimpleMapsRowSchema>;

// Population match result
export enum PopulationSource {
  EXACT_MATCH = "exact-match",
  FUZZY_MATCH = "fuzzy-match",
  NO_MATCH = "no-match",
}

export type PopulationMatch = {
  population: number | null;
  source: PopulationSource;
  match?: SimpleMapsRow;
};
