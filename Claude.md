# StreetSweeper

## Project Overview

StreetSweeper is a local geography guessing game where users pick a town or city and try to name as many streets as they can - like Sporcle for your neighborhood.

**Live Site**: https://streetsweeper.vercel.app/

## Tech Stack

Built with the [T3 Stack](https://create.t3.gg/):

- **Next.js** - React framework with SSR and API routes
- **TypeScript** - Type-safe JavaScript
- **Prisma** - Database ORM
- **tRPC** - End-to-end type-safe APIs
- **Tailwind CSS** - Utility-first CSS framework
- **React Query** (@tanstack/react-query) - Data fetching and caching

### External Services

- **OpenStreetMap Overpass API** - Geographic street data
- **OSM Nominatim** - Location search functionality
- **MapBox GL JS** - Interactive map rendering
- **AWS S3** - Data storage (@aws-sdk/client-s3)
- **PostgreSQL** - Database (via Vercel Postgres)

### Additional Libraries

- **@turf/\*** - Geospatial analysis (bbox, line splitting, point-in-polygon, etc.)
- **osmtogeojson** - Convert OSM data to GeoJSON
- **@headlessui/react** - Accessible UI components
- **Bottleneck** - Rate limiting for API calls
- **Vitest** - Testing framework

## Project Structure

```
streetsweeper/
├── src/
│   ├── components/       # React components
│   │   ├── Map.tsx      # MapBox GL map component
│   │   ├── LinkButton.tsx
│   │   └── Loader.tsx
│   ├── pages/           # Next.js pages and API routes
│   │   ├── index.tsx    # Home page
│   │   ├── play/[id].tsx # Game page (dynamic route)
│   │   └── api/trpc/    # tRPC API endpoints
│   ├── server/          # Backend logic
│   │   ├── api/
│   │   │   ├── root.ts  # tRPC router aggregation
│   │   │   ├── trpc.ts  # tRPC configuration
│   │   │   └── routers/
│   │   │       ├── place.ts  # Place/location endpoints
│   │   │       └── search.ts # Search endpoints
│   │   ├── geo/
│   │   │   ├── geojson.ts        # GeoJSON processing
│   │   │   ├── geojson.test.ts
│   │   │   ├── abbreviations.ts   # Street name abbreviations
│   │   │   └── abbreviations.test.ts
│   │   ├── db.ts        # Prisma client
│   │   └── s3.ts        # S3 integration
│   ├── styles/          # Global styles
│   ├── utils/           # Utility functions
│   │   ├── api.ts       # tRPC client setup
│   │   └── fetch.ts     # Fetch utilities
│   └── env.mjs          # Environment variable validation
├── prisma/
│   └── schema.prisma    # Database schema
├── public/              # Static assets
├── devlog/              # Development logs
├── .husky/              # Git hooks
└── manifest.json        # PWA manifest
```

## Key Files and Directories

### Database (Prisma)

**prisma/schema.prisma** - Defines the database schema:
- `Search` model - Caches search query results with updatedAt timestamp

### Server-Side Code

**src/server/api/** - tRPC API definition
- `routers/place.ts` - Handles place/location data and game logic
- `routers/search.ts` - Handles location search queries via Nominatim
- `root.ts` - Combines all routers
- `trpc.ts` - tRPC configuration and middleware

**src/server/geo/** - Geographic data processing
- `geojson.ts` - GeoJSON manipulation and processing
- `abbreviations.ts` - Street name abbreviation handling (St., Ave., Rd., etc.)

**src/server/s3.ts** - AWS S3 integration for storing/retrieving geographic data

**src/server/db.ts** - Prisma client singleton

### Client-Side Code

**src/pages/index.tsx** - Landing page with location search

**src/pages/play/[id].tsx** - Main game page where users guess street names

**src/components/Map.tsx** - MapBox GL map component for visualizing guessed streets

### Configuration

**src/env.mjs** - Environment variable validation using @t3-oss/env-nextjs and Zod

**next.config.mjs** - Next.js configuration

**tailwind.config.ts** - Tailwind CSS configuration

**tsconfig.json** - TypeScript configuration

## Development Workflow

### Setup
```bash
npm install
npm run dev  # Start development server
```

### Available Scripts
- `npm run dev` - Start Next.js dev server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm test` - Run Vitest tests
- `npm run prepare` - Install Husky git hooks

### Git Hooks
The project uses Husky for git hooks:
- Pre-commit hooks are configured in `.husky/`
- Type checking is run on pre-commit (added in commit 81ad3e7)

### Environment Variables
Required environment variables (see `.env.example`):
- `POSTGRES_PRISMA_URL` - PostgreSQL connection string (pooled)
- `POSTGRES_URL_NON_POOLING` - PostgreSQL direct connection
- `NEXT_PUBLIC_MAPBOX_TOKEN` - MapBox API token
- AWS S3 credentials for data storage

## Important Patterns

### tRPC Usage
- All API calls go through tRPC routers
- Type-safe client-server communication
- Located in `src/server/api/routers/`

### Geographic Data Flow
1. User searches for a location (Nominatim API)
2. Location data fetched from OpenStreetMap Overpass API
3. Data converted to GeoJSON using osmtogeojson
4. Processed with @turf libraries for spatial operations
5. Stored in S3 for caching
6. Rendered on MapBox GL map

### Street Name Normalization
- Street names are normalized using abbreviations (src/server/geo/abbreviations.ts)
- This allows flexible matching (e.g., "Main Street" matches "Main St")

## Recent Changes

From git history:
- Fixed roads not changing visual state (id change bug) - commit a029c85
- Improved loading messages on game page - commit 493c469
- Fixed guess list order changing on reload - commit 2fef32f
- Fixed error with road id change - commit abfa656
- Added type checking to pre-commit - commit 81ad3e7

## Testing

Tests are written using Vitest:
- `src/server/geo/geojson.test.ts` - GeoJSON processing tests
- `src/server/geo/abbreviations.test.ts` - Street abbreviation tests

Run tests with: `npm test`

## Deployment

The application is deployed on Vercel at https://streetsweeper.vercel.app/

## Notes for AI Assistants

- This is a geography game, not a street cleaning/sanitation app
- The main game logic involves matching user-typed street names against OSM data
- Map visualization is critical to the user experience
- Performance matters: data is cached in S3 and Prisma for faster loading
- Street name matching must be flexible (handle abbreviations, case, etc.)
- All geographic operations use GeoJSON format
