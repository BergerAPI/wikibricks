#!/bin/bash

# WikiBricks Rolling Deployment Script
# This script performs zero-downtime rolling updates on a VPS

set -euo pipefail  # Exit on error, undefined vars, pipe failures

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_NAME="wikibricks"
REGISTRY_URL="${REGISTRY_URL:-}"
IMAGE_NAME="${IMAGE_NAME:-wikibricks-app}"
COMPOSE_FILE="docker-compose.prod.yml"
BACKUP_DIR="/opt/wikibricks/backups"
LOG_FILE="/var/log/wikibricks-deploy.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    local level=$1
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')

    case $level in
        INFO)  echo -e "${GREEN}[INFO]${NC} $message" ;;
        WARN)  echo -e "${YELLOW}[WARN]${NC} $message" ;;
        ERROR) echo -e "${RED}[ERROR]${NC} $message" ;;
        DEBUG) echo -e "${BLUE}[DEBUG]${NC} $message" ;;
    esac

    echo "[$timestamp] [$level] $message" >> "$LOG_FILE"
}

# Check if running as root or with sudo
check_permissions() {
    if [[ $EUID -ne 0 ]]; then
        log ERROR "This script must be run as root or with sudo"
        exit 1
    fi
}

# Check prerequisites
check_prerequisites() {
    log INFO "Checking prerequisites..."

    local missing_deps=()

    if ! command -v docker &> /dev/null; then
        missing_deps+=("docker")
    fi

    if ! command -v docker compose &> /dev/null; then
        missing_deps+=("docker compose")
    fi

    if ! command -v git &> /dev/null; then
        missing_deps+=("git")
    fi

    if ! command -v pg_dump &> /dev/null; then
        missing_deps+=("postgresql-client")
    fi

    if [ ${#missing_deps[@]} -ne 0 ]; then
        log ERROR "Missing dependencies: ${missing_deps[*]}"
        log INFO "Please install missing dependencies and run again"
        exit 1
    fi

    log INFO "Prerequisites check passed"
}

# Create backup of database
backup_database() {
    log INFO "Creating database backup..."

    mkdir -p "$BACKUP_DIR"

    local backup_file="$BACKUP_DIR/wikibricks_backup_$(date +%Y%m%d_%H%M%S).sql"

    # Get database connection details from compose file
    local db_container=$(docker compose -f "$COMPOSE_FILE" ps -q postgres)

    if [ -n "$db_container" ]; then
        docker exec "$db_container" pg_dump -U wikibricks_user wikibricks > "$backup_file"

        if [ $? -eq 0 ]; then
            log INFO "Database backup created: $backup_file"

            # Keep only last 5 backups
            ls -t "$BACKUP_DIR"/wikibricks_backup_*.sql | tail -n +6 | xargs -r rm
        else
            log ERROR "Database backup failed"
            return 1
        fi
    else
        log WARN "No database container found, skipping backup"
    fi
}

# Pull latest code from repository
update_code() {
    log INFO "Updating code from repository..."

    # Ensure we're in the project directory
    cd "$SCRIPT_DIR"

    # Stash any local changes
    git stash push -m "Deploy script stash $(date)"

    # Pull latest changes
    git pull origin main

    if [ $? -eq 0 ]; then
        log INFO "Code updated successfully"
    else
        log ERROR "Failed to update code"
        return 1
    fi
}

# Build new images
build_images() {
    log INFO "Building new Docker images..."

    cd "$SCRIPT_DIR"

    # Build the production image
    docker compose -f "$COMPOSE_FILE" build --no-cache

    if [ $? -eq 0 ]; then
        log INFO "Images built successfully"
    else
        log ERROR "Failed to build images"
        return 1
    fi
}

# Perform health check
health_check() {
    local service_url=${1:-"http://localhost:3000"}
    local max_attempts=${2:-30}
    local attempt=1

    log INFO "Performing health check on $service_url"

    while [ $attempt -le $max_attempts ]; do
        if curl -f -s "$service_url" > /dev/null 2>&1; then
            log INFO "Health check passed (attempt $attempt/$max_attempts)"
            return 0
        fi

        log DEBUG "Health check failed (attempt $attempt/$max_attempts), retrying..."
        sleep 2
        ((attempt++))
    done

    log ERROR "Health check failed after $max_attempts attempts"
    return 1
}

# Rolling update with zero downtime
rolling_update() {
    log INFO "Starting rolling update..."

    cd "$SCRIPT_DIR"

    # Start new containers with different names
    log INFO "Starting new application containers..."

    # Scale up the app service to 2 instances
    docker compose -f "$COMPOSE_FILE" up -d --scale app=2

    # Wait for new container to be ready
    sleep 10

    # Health check on new container
    if ! health_check "http://localhost:3000" 15; then
        log ERROR "New container failed health check, rolling back..."
        rollback
        return 1
    fi

    log INFO "New container is healthy, completing update..."

    # Scale back to 1 instance (removes old container)
    docker compose -f "$COMPOSE_FILE" up -d --scale app=1

    # Final health check
    if health_check "http://localhost:3000" 10; then
        log INFO "Rolling update completed successfully"
        return 0
    else
        log ERROR "Final health check failed"
        return 1
    fi
}

# Rollback function
rollback() {
    log WARN "Rolling back to previous version..."

    cd "$SCRIPT_DIR"

    # Reset to previous git commit
    git reset --hard HEAD~1

    # Rebuild and restart with previous code
    docker compose -f "$COMPOSE_FILE" build
    docker compose -f "$COMPOSE_FILE" up -d

    if health_check "http://localhost:3000" 15; then
        log INFO "Rollback completed successfully"
    else
        log ERROR "Rollback failed - manual intervention required"
        exit 1
    fi
}

# Cleanup old images and containers
cleanup() {
    log INFO "Cleaning up old Docker images and containers..."

    # Remove dangling images
    docker image prune -f

    # Remove unused containers
    docker container prune -f

    log INFO "Cleanup completed"
}

# Send notification (customize as needed)
send_notification() {
    local status=$1
    local message=$2

    # curl -X POST -H 'Content-type: application/json' \
    #     --data "{\"text\":\"WikiBricks Deployment $status: $message\"}" \
    #     "$SLACK_WEBHOOK_URL"

    log INFO "Notification sent: $status - $message"
}

# Main deployment function
deploy() {
    local start_time=$(date +%s)

    log INFO "Starting deployment of WikiBricks..."

    # Create log file if it doesn't exist
    mkdir -p "$(dirname "$LOG_FILE")"
    touch "$LOG_FILE"

    # Backup database
    if ! backup_database; then
        send_notification "FAILED" "Database backup failed"
        exit 1
    fi

    # Update code
    if ! update_code; then
        send_notification "FAILED" "Code update failed"
        exit 1
    fi

    # Build images
    if ! build_images; then
        send_notification "FAILED" "Image build failed"
        exit 1
    fi

    # Perform rolling update
    if ! rolling_update; then
        send_notification "FAILED" "Rolling update failed"
        exit 1
    fi

    # Cleanup
    cleanup

    local end_time=$(date +%s)
    local duration=$((end_time - start_time))

    log INFO "Deployment completed successfully in ${duration}s"
    send_notification "SUCCESS" "Deployment completed in ${duration}s"
}

# Show usage
usage() {
    echo "Usage: $0 [OPTION]"
    echo "Options:"
    echo "  deploy     - Perform full deployment with rolling update"
    echo "  rollback   - Rollback to previous version"
    echo "  health     - Perform health check only"
    echo "  backup     - Create database backup only"
    echo "  cleanup    - Cleanup old Docker images and containers"
    echo "  --help     - Show this help message"
}

# Main script logic
main() {
    case ${1:-deploy} in
        deploy)
            check_permissions
            check_prerequisites
            deploy
            ;;
        rollback)
            check_permissions
            rollback
            ;;
        health)
            health_check
            ;;
        backup)
            check_permissions
            backup_database
            ;;
        cleanup)
            check_permissions
            cleanup
            ;;
        --help|-h)
            usage
            ;;
        *)
            log ERROR "Unknown option: $1"
            usage
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"
