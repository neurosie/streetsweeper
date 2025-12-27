# City Database Seeding Script

This script populates the `City` table with US municipalities from OpenStreetMap, enriched with population data from SimpleMaps.

## How It Works

1. **Downloads OSM data** - Queries Overpass API state-by-state for administrative boundaries (admin_level=8)
2. **Matches population data** - Fuzzy matches OSM cities to SimpleMaps dataset to get population
3. **Seeds database** - Inserts cities into PostgreSQL with OSM IDs and population rankings

## Setup

### 1. Download SimpleMaps Data

1. Go to https://simplemaps.com/data/us-cities
2. Download the **Basic (free)** dataset
3. Extract and save the file as: `scripts/data/uscities.csv`

The script will error with instructions if this file is missing.

### 2. Run Database Migration

```bash
npx prisma migrate dev --name add_city_model
```

This creates the `City` table in your database.

### 3. Run the Seed Script

```bash
npm run seed:cities
```

**Expected runtime:** 10-15 minutes (processes all 50 states + DC)

## Output

The script processes each state sequentially and displays:
- Number of OSM places found
- Number of SimpleMaps cities for matching
- Match statistics (exact/fuzzy/no match)
- Final summary with total match rate

Example:
```
📍 Processing Massachusetts (MA)...
   Found 351 OSM places
   Found 568 SimpleMaps cities
   ✅ Inserted 351 places

✨ Seeding complete!

📊 Statistics:
   Total processed: 19624
   Exact matches: 15234
   Fuzzy matches: 2845
   No matches: 1545
   Errors: 0

   Match rate: 92.1%
```

## Schema

Cities are stored with:
- `name` - City name
- `state` / `stateId` - Full name and two-letter code
- `county` - County name (optional)
- `population` - Population count (null if unknown)
- `lat` / `lng` - Coordinates
- `osmId` - OpenStreetMap relation ID
- `populationSource` - How population was matched (exact-match, fuzzy-match, no-match)

## Re-running

To update data:
1. Drop and recreate the table: `npx prisma migrate reset`
2. Re-run the seed: `npm run seed:cities`

Or delete all cities and re-seed:
```sql
DELETE FROM "City";
```
