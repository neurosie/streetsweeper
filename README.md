**StreetSweeper** is a local geography guessing game, like Sporcle for your neighborhood. Pick a town or city and see how many streets you can name!

➡➡➡ **[Try it out!](https://streetsweeper.vercel.app/)** ⬅⬅⬅

This site uses the [T3 stack](https://create.t3.gg/), namely:

- [Next.js](https://nextjs.org)
- [Prisma](https://prisma.io)
- [Tailwind CSS](https://tailwindcss.com)
- [tRPC](https://trpc.io)

Geo data comes from the OpenStreetMap [Overpass API](https://overpass-turbo.eu/), and is rendered with [MapBox GL JS](https://docs.mapbox.com/mapbox-gl-js/guides/). Search data comes from OpenStreetMap's [Nominatim](https://nominatim.org/).

---

## Local Development with Docker

```bash
# 1. Create environment file
cp .env.example .env

# 2. Edit with your secrets
nano .env

# 3. Start all services
docker compose up -d

# 4. View logs
docker compose logs -f app

# 5. Access the app
# http://localhost
```

**Stop services:**

```bash
docker compose down
```

**See [DEPLOYMENT.md](./DEPLOYMENT.md) for production deployment instructions.**
