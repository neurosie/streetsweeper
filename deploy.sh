#!/bin/bash

# ==============================================================================
# Streetsweeper Deployment Script
# ==============================================================================
# This script automates the deployment process
# Usage: ./deploy.sh
# ==============================================================================

set -e  # Exit on any error

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Starting Streetsweeper deployment...${NC}\n"

# -----------------------------------------------------------------------------
# Step 1: Pull latest code
# -----------------------------------------------------------------------------
echo -e "${YELLOW}📥 Pulling latest code from git...${NC}"
git pull

# Check if there were any changes
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Code updated successfully${NC}\n"
else
    echo -e "${RED}✗ Failed to pull code${NC}"
    exit 1
fi

# -----------------------------------------------------------------------------
# Step 2: Build and start containers
# -----------------------------------------------------------------------------
echo -e "${YELLOW}🔨 Building and starting Docker containers...${NC}"
docker compose up -d --build

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Containers started successfully${NC}\n"
else
    echo -e "${RED}✗ Failed to start containers${NC}"
    exit 1
fi

# -----------------------------------------------------------------------------
# Step 3: Wait for services to be healthy
# -----------------------------------------------------------------------------
echo -e "${YELLOW}⏳ Waiting for services to be healthy...${NC}"
sleep 10

# Check if app is running
if docker compose ps | grep -q "streetsweeper-app.*Up"; then
    echo -e "${GREEN}✓ App is running${NC}"
else
    echo -e "${RED}✗ App failed to start. Check logs with: docker compose logs app${NC}"
    exit 1
fi

# Check if database is running
if docker compose ps | grep -q "streetsweeper-db.*Up"; then
    echo -e "${GREEN}✓ Database is running${NC}"
else
    echo -e "${RED}✗ Database failed to start. Check logs with: docker compose logs postgres${NC}"
    exit 1
fi

# Check if nginx is running
if docker compose ps | grep -q "streetsweeper-nginx.*Up"; then
    echo -e "${GREEN}✓ Nginx is running${NC}\n"
else
    echo -e "${RED}✗ Nginx failed to start. Check logs with: docker compose logs nginx${NC}"
    exit 1
fi

# -----------------------------------------------------------------------------
# Step 4: Show status
# -----------------------------------------------------------------------------
echo -e "${YELLOW}📊 Container status:${NC}"
docker compose ps

# -----------------------------------------------------------------------------
# Step 5: Clean up old images
# -----------------------------------------------------------------------------
echo -e "\n${YELLOW}🧹 Cleaning up old Docker images...${NC}"
docker image prune -f

# -----------------------------------------------------------------------------
# Done!
# -----------------------------------------------------------------------------
echo -e "\n${GREEN}✨ Deployment complete!${NC}"
echo -e "${YELLOW}View logs with: docker compose logs -f${NC}"
echo -e "${YELLOW}View app logs: docker compose logs -f app${NC}"
