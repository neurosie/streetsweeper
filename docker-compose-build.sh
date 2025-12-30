#!/bin/bash
# ==============================================================================
# Generic docker-compose build wrapper
# ==============================================================================
# This script automatically extracts all NEXT_PUBLIC_* variables from .env
# and passes them to docker-compose build.
#
# Usage:
#   ./docker-compose-build.sh [docker-compose args]
#
# Examples:
#   ./docker-compose-build.sh up -d --build
#   ./docker-compose-build.sh build app
#
# This approach means you never need to modify docker-compose.yml when adding
# new NEXT_PUBLIC_* environment variables - just add them to .env!
# ==============================================================================

set -e  # Exit on error

echo "🔍 Extracting NEXT_PUBLIC_* variables from .env..."

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found!"
    echo "Please create .env from .env.example and set your variables."
    exit 1
fi

# Extract all NEXT_PUBLIC_* variables from .env and export them
# This makes them available to docker-compose's ${VAR} interpolation
while IFS='=' read -r key value; do
    # Skip comments and empty lines
    if [[ $key =~ ^#.*$ ]] || [[ -z $key ]]; then
        continue
    fi

    # Export ALL variables from .env (docker-compose needs them)
    # Remove quotes from value if present
    value=$(echo "$value" | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
    export "$key=$value"

    # Report NEXT_PUBLIC_ vars specifically
    if [[ $key =~ ^NEXT_PUBLIC_ ]]; then
        echo "  ✓ Found: $key"
    fi
done < .env

echo ""
echo "🏗️  Running docker-compose $@..."
docker compose "$@"

echo ""
echo "✅ Done!"
