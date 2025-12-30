# Streetsweeper Deployment Guide

This guide walks you through deploying your Next.js app to a Digital Ocean droplet using Docker. Perfect for devops beginners!

## 📋 Table of Contents

- [Prerequisites](#prerequisites)
- [Initial Server Setup](#initial-server-setup)
- [Configure Your Domain](#configure-your-domain)
- [First-Time Deployment](#first-time-deployment)
- [SSL Certificate Setup](#ssl-certificate-setup)
- [Update and Redeploy](#update-and-redeploy)
- [Troubleshooting](#troubleshooting)
- [Backup and Restore](#backup-and-restore)
- [Useful Commands](#useful-commands)

---

## Prerequisites

### What You Need

1. **Digital Ocean Droplet**

   - Minimum: 1GB RAM, 25GB SSD (Basic droplet ~$6/month)
   - Recommended: 2GB RAM, 50GB SSD (Regular droplet ~$12/month)
   - Ubuntu 22.04 LTS

2. **Domain Name**

   - Any domain provider (Namecheap, Google Domains, etc.)
   - You'll point it to your droplet's IP address

3. **Your Email**
   - Needed for Let's Encrypt SSL certificates
   - You'll get expiration notices

---

## Initial Server Setup

### 1. Create and Access Your Droplet

```bash
# SSH into your droplet (replace with your droplet's IP)
ssh root@your-droplet-ip
```

### 2. Create a Non-Root User (Security Best Practice)

```bash
# Create a new user
adduser deploy

# Add user to sudo group
usermod -aG sudo deploy

# Switch to the new user
su - deploy
```

### 3. Install Docker and Docker Compose

```bash
# Update package list
sudo apt update

# Install prerequisites
sudo apt install -y apt-transport-https ca-certificates curl software-properties-common

# Add Docker's official GPG key
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# Add Docker repository
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Add your user to docker group (so you don't need sudo)
sudo usermod -aG docker ${USER}

# Log out and back in for group changes to take effect
exit
# Then SSH back in
```

### 4. Verify Docker Installation

```bash
# Check Docker version
docker --version

# Check Docker Compose version
docker compose version

# Test Docker (should see "Hello from Docker!")
docker run hello-world
```

### 5. Install Git

```bash
sudo apt install -y git
```

---

## Configure Your Domain

### 1. Get Your Droplet's IP Address

In your Digital Ocean dashboard, copy your droplet's IP address.

### 2. Set Up DNS Records

In your domain provider's dashboard:

1. **Create an A record:**

   - Host: `@` (or your subdomain)
   - Value: `your-droplet-ip`
   - TTL: 3600 (1 hour)

2. **Create a CNAME record for www (optional):**
   - Host: `www`
   - Value: `yourdomain.com`
   - TTL: 3600

**Wait 5-60 minutes** for DNS to propagate. Check with:

```bash
dig yourdomain.com
```

---

## First-Time Deployment

### 1. Clone Your Repository

```bash
# Create a directory for your apps
mkdir -p ~/apps
cd ~/apps

# Clone your repository
git clone https://github.com/yourusername/streetsweeper.git
cd streetsweeper
```

### 2. Configure Secrets (Environment Variables)

Secrets are managed in a `.env` file that stays on the server and is **never committed to git**.

```bash
# Create your secrets file from the template
cp .env.example .env

# Edit with your production values
nano .env
```

**Fill in your actual values:**

```bash
# Database Credentials - GENERATE A STRONG PASSWORD!
# Use: openssl rand -base64 32
POSTGRES_USER=streetsweeper
POSTGRES_PASSWORD=YOUR_SUPER_SECURE_RANDOM_PASSWORD_HERE
POSTGRES_DB=streetsweeper

# Database URLs (these use the credentials above)
POSTGRES_PRISMA_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}?pgbouncer=true&connect_timeout=15
POSTGRES_URL_NON_POOLING=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}?connect_timeout=15

# Your email
OWNER_EMAIL=your-actual-email@example.com

# Your Mapbox token
# NOTE: This should be set before building. Next.js embeds it at build time.
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.your_actual_mapbox_token_here

# Node environment
NODE_ENV=production
```

**Save and exit** (Ctrl+X, then Y, then Enter)

**Important**:
- This file stays on the server. When you `git pull`, it won't be overwritten. See [SECRETS.md](./SECRETS.md) for more details.
- **Note**: `NEXT_PUBLIC_*` variables must be set before building. They're embedded into the JavaScript bundle at build time, not runtime. If you add or change them later, you must rebuild with `docker compose up -d --build app`.

**For production, also change the nginx config:**

```bash
# In .env, change:
NGINX_CONFIG_FILE=nginx.local.conf

# To:
NGINX_CONFIG_FILE=nginx.conf
```

### 3. Configure Nginx Domain

```bash
# Edit nginx.conf
nano nginx.conf
```

**Replace ALL instances of `yourdomain.com`** with your actual domain:

```nginx
# Before:
server_name yourdomain.com www.yourdomain.com;
ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;

# After:
server_name myactualsite.com www.myactualsite.com;
ssl_certificate /etc/letsencrypt/live/myactualsite.com/fullchain.pem;
```

**Save and exit**

### 4. Initial Start (Without SSL)

First, we'll start with HTTP-only to test everything works, then add SSL.

**Backup the full nginx.conf and temporarily replace it with an HTTP-only version:**

```bash
# Backup the full config (you'll restore this after getting SSL)
cp nginx.conf nginx.conf.full

# Create temporary HTTP-only config
cat > nginx.conf << 'EOF'
# Temporary HTTP-only configuration for initial setup
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';

    access_log /var/log/nginx/access.log main;

    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;

    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript
               application/json application/javascript application/xml+rss;

    server {
        listen 80;
        listen [::]:80;

        # REPLACE WITH YOUR DOMAIN
        server_name yourdomain.com www.yourdomain.com;

        # Let's Encrypt challenge location
        location /.well-known/acme-challenge/ {
            root /var/www/certbot;
        }

        # Proxy to Next.js app
        location / {
            proxy_pass http://app:3000;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}
EOF
```

**Start the services:**

```bash
# Start postgres and app (not nginx yet)
docker compose up -d postgres app

# Wait 30 seconds for database to initialize
sleep 30

# Check if services are running
docker compose ps

# Check logs
docker compose logs -f app
# Press Ctrl+C to exit logs
```

**Start nginx:**

```bash
docker compose up -d nginx
```

**Test your site:**
Visit `http://yourdomain.com` in your browser. You should see your app (no HTTPS yet).

---

## SSL Certificate Setup

### 1. Obtain SSL Certificate

```bash
# Create directories for certbot
mkdir -p certbot/conf certbot/www

# Get your first certificate (REPLACE with your domain and email)
docker compose run --rm certbot certonly --webroot \
    --webroot-path=/var/www/certbot \
    --email your-email@example.com \
    --agree-tos \
    --no-eff-email \
    -d yourdomain.com \
    -d www.yourdomain.com
```

**You should see:** "Successfully received certificate"

### 2. Enable HTTPS in Nginx

Now that you have an SSL certificate, restore the full nginx configuration:

```bash
# Restore the full nginx.conf from backup
cp nginx.conf.full nginx.conf

# Verify your domain is correct in the config
grep "server_name" nginx.conf
# Should show: server_name yourdomain.com www.yourdomain.com

# If it still says "yourdomain.com", replace it with your actual domain
sed -i 's/yourdomain.com/streetsweeper.xyz/g' nginx.conf
```

**Reload nginx to apply SSL:**

```bash
docker compose restart nginx

# Or rebuild everything
docker compose up -d
```

### 3. Test HTTPS

Visit `https://yourdomain.com` - you should see a secure connection!

Test SSL configuration: https://www.ssllabs.com/ssltest/

### 4. Set Up Auto-Renewal

```bash
# Test renewal (dry run)
docker compose run --rm certbot renew --dry-run

# If successful, add to crontab for automatic renewal
crontab -e
```

**Add this line** (runs twice daily):

```cron
0 0,12 * * * cd ~/apps/streetsweeper && docker compose run --rm certbot renew && docker compose restart nginx
```

---

## Update and Redeploy

This is your typical deployment workflow after making changes:

```bash
# SSH into your server
ssh deploy@your-droplet-ip

# Navigate to your app
cd ~/apps/streetsweeper

# Pull latest changes from git
# Don't worry - this won't overwrite your .env file!
git pull

# Rebuild and restart (this handles migrations automatically)
docker compose up -d --build

# Watch the logs to ensure everything starts correctly
docker compose logs -f app

# Press Ctrl+C when satisfied
```

**That's it!** Your app is updated and running.

**Note**: Your `.env` file with secrets stays untouched by `git pull` because it's in `.gitignore`.

### Managing Environment Variables

**Runtime-only variables** (server-side, like `POSTGRES_PASSWORD`, `OWNER_EMAIL`):
- Just edit `.env` and restart: `docker compose restart app`
- No rebuild needed!

**Build-time variables** (`NEXT_PUBLIC_*` - client-side):
- Edit `.env` with the new value
- **MUST rebuild**: `docker compose up -d --build app`

**Adding a new NEXT_PUBLIC_* variable**:
1. Add it to `.env`
2. Add it to `docker-compose.yml` build args section
3. Add ARG and ENV to `Dockerfile`
4. Rebuild: `docker compose up -d --build app`

---

## Troubleshooting

### View Logs

```bash
# All services
docker compose logs -f

# Just the app
docker compose logs -f app

# Just the database
docker compose logs -f postgres

# Just nginx
docker compose logs -f nginx

# Last 100 lines
docker compose logs --tail=100 app
```

### Mapbox Token Error / Map Not Loading

**Problem**: Game page shows error about Mapbox token, or map doesn't load.

**Cause**: In Next.js, `NEXT_PUBLIC_*` environment variables are embedded at **build time**, not runtime. If you added/changed the Mapbox token in `.env` after building, it won't be in the JavaScript bundle.

**Solution**: Rebuild the Docker image to embed the token:

```bash
# Make sure NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN is set in .env
cat .env | grep MAPBOX

# Rebuild the app container (this re-embeds the token)
docker compose up -d --build app

# Check logs to ensure it started correctly
docker compose logs -f app
```

**Prevention**: Always set `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` in `.env` BEFORE the first build.

### App Won't Start

```bash
# Check if containers are running
docker compose ps

# Check if database is healthy
docker compose exec postgres pg_isready -U streetsweeper

# Restart everything
docker compose restart

# Nuclear option: rebuild from scratch
docker compose down
docker compose up -d --build
```

### Database Connection Errors

```bash
# Check database is running
docker compose ps postgres

# Check database logs
docker compose logs postgres

# Connect to database manually
docker compose exec postgres psql -U streetsweeper -d streetsweeper

# Inside postgres:
\dt    # List tables
\q     # Quit
```

### Migrations Not Running

```bash
# Run migrations manually
docker compose exec app npx prisma migrate deploy

# Or reset database (DANGER: deletes all data!)
docker compose exec app npx prisma migrate reset
```

### SSL Certificate Issues

```bash
# Check certificate expiration
docker compose run --rm certbot certificates

# Renew manually
docker compose run --rm certbot renew

# Get a new certificate (if needed)
docker compose run --rm certbot certonly --webroot \
    --webroot-path=/var/www/certbot \
    --email your-email@example.com \
    --agree-tos \
    -d yourdomain.com
```

### Out of Disk Space

```bash
# Check disk usage
df -h

# Clean up Docker
docker system prune -a --volumes

# WARNING: This removes unused images, containers, and volumes!
```

### Port Already in Use

```bash
# See what's using port 80/443
sudo netstat -tulpn | grep :80
sudo netstat -tulpn | grep :443

# Stop conflicting service (e.g., apache2)
sudo systemctl stop apache2
sudo systemctl disable apache2
```

---

## Backup and Restore

### Backup Database

```bash
# Create a backup file
docker compose exec postgres pg_dump -U streetsweeper streetsweeper > backup-$(date +%Y%m%d-%H%M%S).sql

# Or create a compressed backup
docker compose exec postgres pg_dump -U streetsweeper streetsweeper | gzip > backup-$(date +%Y%m%d-%H%M%S).sql.gz
```

### Restore Database

```bash
# Restore from backup
cat backup-20240101-120000.sql | docker compose exec -T postgres psql -U streetsweeper -d streetsweeper

# Or from compressed backup
gunzip -c backup-20240101-120000.sql.gz | docker compose exec -T postgres psql -U streetsweeper -d streetsweeper
```

### Automatic Backups

```bash
# Create backup script
nano ~/backup-db.sh
```

**Add:**

```bash
#!/bin/bash
cd ~/apps/streetsweeper
docker compose exec postgres pg_dump -U streetsweeper streetsweeper | gzip > ~/backups/db-$(date +%Y%m%d-%H%M%S).sql.gz
# Keep only last 30 days
find ~/backups -name "db-*.sql.gz" -mtime +30 -delete
```

```bash
# Make executable
chmod +x ~/backup-db.sh

# Create backups directory
mkdir -p ~/backups

# Add to crontab (daily at 2 AM)
crontab -e
```

**Add:**

```cron
0 2 * * * ~/backup-db.sh
```

---

## Useful Commands

### Docker Compose

```bash
# Start all services
docker compose up -d

# Stop all services
docker compose down

# Restart a service
docker compose restart app

# Rebuild and start
docker compose up -d --build

# View running containers
docker compose ps

# View logs
docker compose logs -f [service-name]

# Execute command in container
docker compose exec app sh
docker compose exec postgres psql -U streetsweeper

# Remove everything (including volumes - DANGER!)
docker compose down -v
```

### Docker Management

```bash
# List all containers
docker ps -a

# List all images
docker images

# Remove stopped containers
docker container prune

# Remove unused images
docker image prune -a

# Remove unused volumes
docker volume prune

# Remove everything unused
docker system prune -a --volumes

# View disk usage
docker system df
```

### Server Management

```bash
# Check system resources
htop  # (install with: sudo apt install htop)

# Check disk usage
df -h

# Check memory usage
free -h

# View running processes
ps aux

# Restart server
sudo reboot
```

---

## Reset and Start Fresh

If things are really broken and you want to start over:

```bash
# Stop and remove everything
docker compose down -v

# Remove all Docker data
docker system prune -a --volumes

# Pull latest code
git pull

# Start fresh
docker compose up -d --build

# Watch it come up
docker compose logs -f
```

---

## Next Steps

- **Monitoring**: Set up monitoring with Uptime Robot or Pingdom
- **Firewall**: Configure UFW: `sudo ufw allow 80/tcp && sudo ufw allow 443/tcp && sudo ufw enable`
- **Backups**: Set up automated backups to Digital Ocean Spaces or S3
- **Scaling**: When you outgrow a single droplet, consider Kubernetes or managed services

---

## Questions?

- Check Docker logs first: `docker compose logs -f`
- Review nginx logs: `docker compose logs nginx`
- Test locally with: `docker compose up` (without `-d`)
- Search error messages - Docker errors are usually clear

Good luck with your deployment! 🚀
