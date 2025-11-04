# WikiBricks VPS Deployment Guide

This guide provides complete instructions for deploying WikiBricks to a VPS with
rolling updates and zero downtime.

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

## Configuration

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

# JWT Secret (generate a secure random string)
JWT_SECRET=your-very-secure-jwt-secret-here
```

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
