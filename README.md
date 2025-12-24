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

**See [DEPLOYMENT.md](./DEPLOYMENT.md) for production deployment instructions.**
