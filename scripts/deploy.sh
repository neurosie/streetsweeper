#!/usr/bin/env bash
#
# Deploy to Fly.io, passing the Mapbox token as a build arg (Next inlines
# NEXT_PUBLIC_* at build time). See README "Deployment".
#
# Reads MAPBOX_PROD_TOKEN, deliberately not NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN from
# .env -- that is the unrestricted dev token and must never reach production.
# Set it in the environment or in .env.deploy.local (gitignored).

set -euo pipefail

# Run from the repo root so the paths below work regardless of caller cwd.
cd "$(dirname "${BASH_SOURCE[0]}")/.."

if [[ -f .env.deploy.local ]]; then
  # shellcheck disable=SC1091
  source .env.deploy.local
fi

if [[ -z "${MAPBOX_PROD_TOKEN:-}" ]]; then
  cat >&2 <<'EOF'
ERROR: MAPBOX_PROD_TOKEN is not set.

Use the URL-restricted production token (streetsweeper.xyz) from
https://account.mapbox.com/access-tokens/ -- not the unrestricted
development token in .env.

  echo 'MAPBOX_PROD_TOKEN=pk.your_prod_token' >> .env.deploy.local

EOF
  exit 1
fi

exec flyctl deploy \
  --build-arg NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN="$MAPBOX_PROD_TOKEN" \
  "$@"
