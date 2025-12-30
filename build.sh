#!/bin/bash
# ==============================================================================
# Generic build script for Next.js Docker images
# ==============================================================================
# This script automatically extracts all NEXT_PUBLIC_* variables from .env
# and passes them as build arguments to Docker.
#
# Usage:
#   ./build.sh
#
# This approach means you never need to modify the Dockerfile when adding
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

# Extract all NEXT_PUBLIC_* variables from .env and build the --build-arg string
BUILD_ARGS=""
while IFS='=' read -r key value; do
    # Skip comments and empty lines
    if [[ $key =~ ^#.*$ ]] || [[ -z $key ]]; then
        continue
    fi

    # Check if variable starts with NEXT_PUBLIC_
    if [[ $key =~ ^NEXT_PUBLIC_ ]]; then
        # Remove quotes from value if present
        value=$(echo "$value" | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
        echo "  ✓ Found: $key"
        BUILD_ARGS="$BUILD_ARGS --build-arg $key=$value"
    fi
done < .env

if [ -z "$BUILD_ARGS" ]; then
    echo "⚠️  Warning: No NEXT_PUBLIC_* variables found in .env"
    echo "The build will proceed but client-side env vars won't be available."
fi

echo ""
echo "🏗️  Building Docker image..."
docker build $BUILD_ARGS -t streetsweeper-app .

echo ""
echo "✅ Build complete!"
