# City Data Seeding Scripts

These scripts populate `data/cities.jsonl` with US municipalities from OpenStreetMap, with population data fetched from Wikidata.

## How It Works

1. **Downloads OSM data** - Queries Overpass API state-by-state for administrative boundaries (admin_level=8)
2. **Writes search data to JSONL** - Saves search-relevant fields (name, state, population, osmId, etc.) to `data/cities.jsonl` (checked into git)
3. **Caches full OSM data locally** - Saves complete OSM relation data to `scripts/data/cities-osm.jsonl` (gitignored, for re-extraction without re-scraping)
4. **Uses OSM population if available** - Some cities have population directly in OSM
5. **Fetches from Wikidata** - Run the separate population script to fetch population from Wikidata

## Usage

### 1. Run the City Seed Script

```bash
npm run seed:cities
```

This fetches all municipalities from OpenStreetMap and writes:

- `data/cities.jsonl` - Search-relevant fields (checked into git, ~5MB)
- `scripts/data/cities-osm.jsonl` - Full OSM data (gitignored, for local re-extraction)

**Expected runtime:** 10-15 minutes (processes all 50 states + DC)

### 2. Fetch Population from Wikidata

```bash
npm run seed:population
```

This reads Wikidata IDs from the cached OSM data and fetches population values, updating `data/cities.jsonl`.

**Options:**

- `--state=NY` - Only process cities in a specific state
- `--limit=100` - Only process first N cities (for testing)
- `--missing-only` - Only process cities without population data

Example:

```bash
npm run seed:population -- --state=NY --limit=50
```

**Rate limiting:** The script conforms to [Wikimedia API Etiquette](https://www.mediawiki.org/wiki/API:Etiquette):

- Serial requests (1 request/second, no parallel requests)
- Batch fetching (50 entities per request using pipe separator)
- Descriptive User-Agent with contact info
- GZip compression enabled
- maxlag parameter for non-interactive processing
- Automatic retry on server busy errors

## Data Format

### cities.jsonl (checked into git)

Each line is a JSON object:

```json
{
  "name": "Boston",
  "state": "Massachusetts",
  "stateId": "MA",
  "county": "Suffolk County",
  "population": 675647,
  "osmId": 2315704,
  "osmType": "relation",
  "displayName": "Boston, MA"
}
```

Fields:

- `name` - City name
- `state` / `stateId` - Full name and two-letter code
- `county` - County name (null if unknown)
- `population` - Population count (null if unknown)
- `osmId` - OpenStreetMap relation ID
- `osmType` - OSM element type (always "relation")
- `displayName` - Formatted display string

### cities-osm.jsonl (gitignored, local cache)

Each line contains the full OSM element data for re-extraction:

```json
{"osmId":2315704,"data":{"type":"relation","id":2315704,"tags":{"name":"Boston","wikidata":"Q100","population":"675647",...},...}}
```

## Re-running

### Re-running city seed (OSM data)

By default, the seed script will only query city lists for states with no cities in the list, to allow quickly retrying failures.

To check all states for new cities to add, run with `--no-skip`. For a totally fresh start, run with `--clear`.

```bash
npm run seed:cities -- --clear    # Clears and reseeds all cities
npm run seed:cities -- --no-skip  # Queries every state, even ones that already have cities.
```

### Re-running population fetch

To update population data from Wikidata:

```bash
npm run seed:population                    # Updates all cities with Wikidata IDs
npm run seed:population -- --state=NY      # Just one state
npm run seed:population -- --missing-only  # Only cities without population
```

### Full reset

To start completely fresh:

1. Run: `npm run seed:cities -- --clear`
2. Fetch populations: `npm run seed:population`
3. Commit the updated `data/cities.jsonl`
