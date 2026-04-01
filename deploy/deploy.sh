#!/bin/bash
# Auto-deploy script — triggered by GitHub webhook
# Pulls latest code and rebuilds Docker containers

set -e

REPO_DIR="/root/ethicalhackingbot"
COMPOSE_DIR="$REPO_DIR/dashboard"
LOG_FILE="/var/log/ethicalhackingbot-deploy.log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "=== Deploy started ==="

cd "$REPO_DIR"

log "Pulling latest code..."
git pull origin main 2>&1 | tee -a "$LOG_FILE"

log "Building and restarting containers..."
cd "$COMPOSE_DIR"
docker compose build --no-cache 2>&1 | tee -a "$LOG_FILE"
docker compose up -d 2>&1 | tee -a "$LOG_FILE"

log "Cleanup old images..."
docker image prune -f 2>&1 | tee -a "$LOG_FILE"

log "=== Deploy complete ==="
