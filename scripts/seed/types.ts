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

// Population source tracking
export enum PopulationSource {
  OSM = "osm",
  WIKIDATA = "wikidata",
  NO_MATCH = "no-match",
}
