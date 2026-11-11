#!/bin/bash

# WikiBricks Deployment Script

set -euo pipefail  # Exit on error, undefined vars, pipe failures

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
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

    if ! docker compose version &> /dev/null; then
        missing_deps+=("docker compose")
    fi

    if ! command -v git &> /dev/null; then
        missing_deps+=("git")
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

    local db_container=$(docker compose -f "$COMPOSE_FILE" ps -q postgres)

    if [ -n "$db_container" ]; then
        # The container knows the database and user it was created with
        if docker exec "$db_container" sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > "$backup_file"; then
            log INFO "Database backup created: $backup_file"

            # Keep only last 5 backups
            ls -t "$BACKUP_DIR"/wikibricks_backup_*.sql | tail -n +6 | xargs -r rm
        else
            rm -f "$backup_file"
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
    git pull origin release

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

    # Get current commit ID and metadata
    local commit_id=$(git rev-parse HEAD)
    local short_commit_id=$(git rev-parse --short HEAD)
    local commit_message=$(git log -1 --pretty=format:"%s")
    local commit_author=$(git log -1 --pretty=format:"%an")
    local commit_date=$(git log -1 --pretty=format:"%ad" --date=short)

    log INFO "Building with commit: $short_commit_id"
    log INFO "Commit message: $commit_message"
    log INFO "Author: $commit_author ($commit_date)"

    # Build the production image with commit ID as build arg
    COMMIT_ID="$commit_id" docker compose -f "$COMPOSE_FILE" build --no-cache

    if [ $? -eq 0 ]; then
        log INFO "Images built successfully with commit $short_commit_id"
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

replace_app() {
    log INFO "Replacing the application container..."
    docker compose -f "$COMPOSE_FILE" up -d --no-build app &&
        health_check "http://localhost:3000" 15
}

# Rollback function
rollback() {
    local revision=${1:-HEAD~1}
    log WARN "Rolling back to previous version..."

    cd "$SCRIPT_DIR"

    if git reset --hard "$revision" &&
        docker compose -f "$COMPOSE_FILE" build &&
        replace_app; then
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

# Main deployment function
deploy() {
    local start_time=$(date +%s)
    local running_container running_image="" running_tag="" image_info
    running_container=$(docker compose -f "$SCRIPT_DIR/$COMPOSE_FILE" ps --status running -q app)
    if [[ -n "$running_container" ]]; then
        image_info=$(docker inspect --format '{{.Image}} {{.Config.Image}}' "$running_container")
        read -r running_image running_tag <<< "$image_info"
    fi

    log INFO "Starting deployment of WikiBricks..."

    # Create log file if it doesn't exist
    mkdir -p "$(dirname "$LOG_FILE")"
    touch "$LOG_FILE"

    # Backup database
    if ! backup_database; then
        exit 1
    fi

    # Update code
    if ! update_code; then
        exit 1
    fi

    # Build images
    if ! build_images; then
        exit 1
    fi

    if ! replace_app; then
        log ERROR "New container failed to start or pass its health check"
        if [[ -n "$running_image" && -n "$running_tag" ]] &&
            docker image tag "$running_image" "$running_tag" &&
            replace_app; then
            log INFO "Restored the previous running image"
        else
            log ERROR "No previous image could be restored"
        fi
        exit 1
    fi

    # Cleanup
    cleanup

    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    local short_commit_id=$(git rev-parse --short HEAD)

    log INFO "Deployment completed successfully in ${duration}s"
    log INFO "Deployed commit: $short_commit_id"
}

# Show usage
usage() {
    echo "Usage: $0 [OPTION]"
    echo "Options:"
    echo "  deploy     - Build and replace the application container"
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
