# City Database Seeding Script

This script populates the `City` table with US municipalities from OpenStreetMap, with population data fetched from Wikidata.

## How It Works

1. **Downloads OSM data** - Queries Overpass API state-by-state for administrative boundaries (admin_level=8)
2. **Stores full OSM JSON** - Saves complete OSM relation data including all tags (population, wikidata ID, etc.)
3. **Uses OSM population if available** - Some cities have population directly in OSM
4. **Fetches from Wikidata** - For cities without OSM population, run the separate population script to fetch from Wikidata

## Setup

### 1. Run Database Migration

```bash
npx prisma migrate dev --name add_city_model
```

This creates the `City` table in your database.

### 2. Run the City Seed Script

```bash
npm run seed:cities
```

This fetches all municipalities from OpenStreetMap and stores them with:
- Full OSM relation JSON (all tags preserved)
- Population data if available directly in OSM
- Wikidata IDs for later population fetching

**Expected runtime:** 10-15 minutes (processes all 50 states + DC)

### 3. Fetch Population from Wikidata

```bash
npm run seed:population
```

This fetches population data from Wikidata for cities that have a Wikidata ID.

**Options:**
- `--state=NY` - Only process cities in a specific state
- `--limit=100` - Only process first N cities (for testing)

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

## Output

### City Seed Output

The script processes each state sequentially and displays:
- Number of OSM places found
- Match statistics

Example:
```
📍 Processing Massachusetts (MA)...
   Found 351 places
   ✅ Processed 351 places

✨ Complete!

📊 Statistics:
   Total processed: 19624
   Exact matches: 2450 (from OSM population)
   No matches: 17174
   Errors: 0
```

### Population Fetch Output

```
🌍 Fetching population data from Wikidata...

📊 Found 19624 cities to process

🔍 Found 18500 cities with Wikidata IDs

📡 Fetching population data from Wikidata...
✅ Retrieved 17200 population values

   ✅ Boston, MA: 675,647
   ✅ Cambridge, MA: 118,927
   ⚠️  Small Town, MA: No population found

✨ Complete!

📊 Statistics:
   Cities processed: 18500
   Updated with population: 17200
   No population found: 1300
   Success rate: 93.0%
```

## Schema

Cities are stored with:
- `name` - City name
- `state` / `stateId` - Full name and two-letter code
- `county` - County name (optional)
- `population` - Population count (null if unknown)
- `lat` / `lng` - Coordinates
- `osmId` - OpenStreetMap relation ID
- `osmData` - Full OSM relation JSON with all tags (wikidata, population, official_name, etc.)
- `populationSource` - How population was obtained:
  - `osm` - From OSM population tag
  - `wikidata` - From Wikidata API
  - `no-match` - No population data found

## Re-running

### Re-running city seed (OSM data)

The seed script automatically skips states that already have cities. To re-seed:

```bash
npm run seed:cities -- --clear  # Clears and reseeds all cities
```

### Re-running population fetch

To update population data from Wikidata:
```bash
npm run seed:population  # Updates all cities with Wikidata IDs
npm run seed:population -- --state=NY  # Just one state
```

### Full reset

To start completely fresh:
1. Drop and recreate the table: `npx prisma migrate reset`
2. Re-run the seed: `npm run seed:cities`
3. Fetch populations: `npm run seed:population`
