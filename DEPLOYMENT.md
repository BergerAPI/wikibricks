# WikiBricks VPS Deployment Guide

This guide covers deployment of WikiBricks to a VPS. The Compose configuration
replaces one application container on host port 3000, so a deployment can briefly
interrupt HTTP requests.

## Prerequisites

- Ubuntu 20.04+ or similar Linux VPS
- Root access to the server
- Domain name (optional, for SSL)
- Basic knowledge of Linux command line

## Quick Setup

### 1. Initial VPS Setup

Run the setup script on your VPS:

```bash
# Download and run the VPS setup script
curl -sSL https://raw.githubusercontent.com/BergerAPI/wikibricks/main/setup-vps.sh -o setup-vps.sh
chmod +x setup-vps.sh

# Run with domain for SSL (optional)
sudo ./setup-vps.sh --domain=your-domain.com

# Or run without domain
sudo ./setup-vps.sh
```

### 2. Deploy Your Application

```bash
# Clone your repository
cd /opt/wikibricks
git clone https://github.com/BergerAPI/wikibricks.git .

# Copy environment configuration
cp .env.example .env
nano .env  # Edit with your production settings

# Run initial deployment
sudo ./deploy.sh deploy
```

### Docker Configuration

- **`Dockerfile`** - Development Docker image
- **`Dockerfile.prod`** - Production optimized image
- **`docker-compose.yml`** - Development environment
- **`docker-compose.prod.yml`** - Production environment

### Asset retention

Vite writes fingerprinted CSS, JavaScript, and the images they reference to
`dist/client/assets` and maps source paths to those files in
`dist/client/.vite/manifest.json`. On
startup, the app copies its files to the Compose volume `app_assets_prod` and
serves requests from both locations, so pages opened before an update or
rollback can still load their assets. The volume retains published assets until
an operator removes them. Keep it across deployments.
If the replacement fails, the deployment script restores the previously
running image.

Files in `public/`, such as a logo, are served at their own path
(`public/logo.svg` at `/logo.svg`). Their URLs do not change between releases,
so browsers revalidate them by ETag.

## Configuration

### Legal pages

The German legal pages use placeholder operator details and send a `noindex`
header. Before publishing, replace the details in `src/routes/legal.tsx` and
verify the applicable imprint disclosures and content license. Confirm the
hosting location, Cloudflare features and cookies, data transfers and
safeguards, and the legal bases and retention periods for accounts,
contributions, logs, and backups. Set purpose-based deletion periods for
logs containing personal data. Update the privacy page before enabling
Umami. Remove the `noindex` header when the pages are ready for indexing.

### Environment Variables

Create `/opt/wikibricks/.env` with:

```bash
# Database Configuration
DB_CONN=postgresql://wikibricks_user:your_secure_password@postgres:5432/wikibricks

# PostgreSQL Configuration
POSTGRES_USER=wikibricks_user
POSTGRES_PASSWORD=your_secure_password

# Application Configuration
NODE_ENV=production
PORT=3000

# Generate with openssl rand -hex 32 and paste the result here.
JWT_SECRET=

# Optional: IP address of the reverse proxy as seen by the app.
TRUSTED_PROXY_IP=
```

If using a reverse proxy, set `TRUSTED_PROXY_IP` to its immediate connection
address and configure it to overwrite `X-Forwarded-For` with the client IP or
append that IP as the rightmost entry. Otherwise, the app rate-limits using the
connection address.

### GitHub Actions Setup

Add these secrets to your GitHub repository:

- `VPS_HOST` - Your VPS IP address
- `VPS_USERNAME` - SSH username (usually 'root' or 'ubuntu')
- `VPS_SSH_KEY` - Private SSH key for authentication
- `VPS_PORT` - SSH port (default: 22)

## Monitoring

### Log Files

- **Application**: `docker-compose logs -f app`
- **Deployment**: `/var/log/wikibricks-deploy.log`
- **Nginx**: `/var/log/nginx/access.log`, `/var/log/nginx/error.log`

### Log Collection for Support

```bash
# Generate comprehensive status report
sudo /opt/wikibricks/monitor.sh status > wikibricks-status-$(date +%Y%m%d).txt

# Collect recent logs
sudo journalctl -u wikibricks --since "1 hour ago" > wikibricks-service-logs.txt
sudo tail -100 /var/log/wikibricks-deploy.log > wikibricks-deploy-logs.txt
```
