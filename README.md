**StreetSweeper** is a local geography guessing game, like Sporcle for your neighborhood. Pick a town or city and see how many streets you can name!

➡➡➡ **[Try it out!](https://streetsweeper.xyz/)** ⬅⬅⬅

This site uses the [T3 stack](https://create.t3.gg/), namely:

- [Next.js](https://nextjs.org)
- [Tailwind CSS](https://tailwindcss.com)
- [tRPC](https://trpc.io)

Geo data comes from the OpenStreetMap [Overpass API](https://overpass-turbo.eu/), and is rendered with [MapBox GL JS](https://docs.mapbox.com/mapbox-gl-js/guides/).

---

## Local Development

```bash
# 1. Create environment file
cp .env.example .env

# 2. Edit with your secrets
nano .env

# 3. Install dependencies
npm install

# 4. Start dev server
npm run dev

# 5. Access the app at http://localhost:3000
```

---

## Deployment

The app is deployed on [Fly.io](https://fly.io/).

### First-time setup

```bash
# Set runtime secrets (only needed once)
fly secrets set OWNER_EMAIL=your-email@example.com
```

The Mapbox token is **not** a Fly secret. It is passed as a `--build-arg` at deploy time.

Production uses the URL-restricted token (`streetsweeper.xyz`); it will not work
on other hostnames, including `streetsweeper.fly.dev`. Local development uses the
unrestricted token in `.env`, which is gitignored. For CI, store the production token as a GitHub Actions secret named
`MAPBOX_PROD_TOKEN` (alongside `FLY_API_TOKEN`).

### Deploy

```bash
# Store the production Mapbox token once (gitignored)
echo 'MAPBOX_PROD_TOKEN=pk.your_prod_token' >> .env.deploy.local

npm run deploy
```

Use `npm run deploy` rather than `fly deploy` directly — it passes a necessary build arg.

Pushes to `main` also trigger automatic deployment via GitHub Actions. This requires `FLY_API_TOKEN` and `MAPBOX_PROD_TOKEN` secrets set in the GitHub repo settings.

### Custom domain

```bash
# Add your domain
fly certs add yourdomain.com

# Allocate IPs if needed
fly ips allocate-v4
fly ips allocate-v6

# Check cert status
fly certs check yourdomain.com
```

Then add the A and AAAA records shown by `fly certs add` to your DNS provider. Fly.io auto-issues TLS certs once DNS propagates.
