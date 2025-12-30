**StreetSweeper** is a local geography guessing game, like Sporcle for your neighborhood. Pick a town or city and see how many streets you can name!

➡➡➡ **[Try it out!](https://streetsweeper.vercel.app/)** ⬅⬅⬅

This site uses the [T3 stack](https://create.t3.gg/), namely:

- [Next.js](https://nextjs.org)
- [Prisma](https://prisma.io)
- [Tailwind CSS](https://tailwindcss.com)
- [tRPC](https://trpc.io)

Geo data comes from the OpenStreetMap [Overpass API](https://overpass-turbo.eu/), and is rendered with [MapBox GL JS](https://docs.mapbox.com/mapbox-gl-js/guides/). Search data comes from OpenStreetMap's [Nominatim](https://nominatim.org/).

---

## Local Development

### Option 1: Full Docker Stack (App + DB)

```bash
# 1. Create environment file
cp .env.example .env

# 2. Edit with your secrets
nano .env

# 3. Start all services
docker compose up -d

# 4. Access the app at http://localhost
```

### Option 2: Local App + Docker DB (Faster Iteration)

```bash
# 1. Create environment file
cp .env.example .env

# 2. Edit .env
#  - Change POSTGRES_HOST to "localhost"
#  - Uncomment POSTGRES_PORT line
nano .env

# 3. Start only the database
docker compose up -d postgres

# 4. Run migrations
npx prisma migrate dev

# 5. Start Next.js locally
npm run dev

# 6. Access the app at http://localhost:3000
```

**Stop services:**

```bash
docker compose down
```

---

## Environment Variables

This project uses two types of environment variables:

**Server-side variables** (e.g., `POSTGRES_PASSWORD`, `OWNER_EMAIL`):
- Only available on the server
- Can be changed at runtime by editing `.env` and restarting
- Not exposed to the browser

**Client-side variables** (`NEXT_PUBLIC_*` prefix):
- Embedded into the JavaScript bundle at **build time**
- Sent to and visible in the browser
- Changes require rebuilding: `docker compose up -d --build app`

### Adding a New NEXT_PUBLIC_* Variable

**Option 1: Automatic (Recommended)**
```bash
# 1. Add your variable to .env
echo "NEXT_PUBLIC_MY_VAR=value" >> .env

# 2. Build using the helper script (automatically extracts all NEXT_PUBLIC_* vars)
./docker-compose-build.sh up -d --build
```

**Option 2: Manual**
```bash
# 1. Add to .env
echo "NEXT_PUBLIC_MY_VAR=value" >> .env

# 2. Add to docker-compose.yml build.args section
# 3. Add ARG and ENV to Dockerfile

# 4. Build normally
docker compose up -d --build
```

The helper scripts (`build.sh` and `docker-compose-build.sh`) automatically extract all `NEXT_PUBLIC_*` variables from `.env` and pass them to the Docker build, so you don't need to manually update the Dockerfile or docker-compose.yml each time.

---

**See [DEPLOYMENT.md](./DEPLOYMENT.md) for production deployment instructions.**
