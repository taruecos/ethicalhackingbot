#!/bin/bash
# Run this ONCE on the VPS to set up auto-deploy
# Usage: bash setup-vps.sh

set -e

REPO_DIR="/root/ethicalhackingbot"
SERVICE_NAME="ethicalhackingbot-webhook"

echo "=== Setting up auto-deploy for EthicalHackingBot ==="

# Make deploy script executable
chmod +x "$REPO_DIR/deploy/deploy.sh"

# Install systemd service
sudo cp "$REPO_DIR/deploy/webhook.service" /etc/systemd/system/${SERVICE_NAME}.service
sudo systemctl daemon-reload
sudo systemctl enable ${SERVICE_NAME}
sudo systemctl start ${SERVICE_NAME}

echo ""
echo "=== Setup complete ==="
echo "Webhook listener running on port 9000"
echo "Service status:"
sudo systemctl status ${SERVICE_NAME} --no-pager
echo ""
echo "Next step: configure GitHub webhook at"
echo "  https://github.com/taruecos/ethicalhackingbot/settings/hooks"
echo "  URL: http://37.27.215.169:9000/webhook"
echo "  Secret: dd85e6a687f9297283569d44c219ca5d148bdd0f7e05acc314c64bfcf0b031e1"
echo "  Events: Just the push event"
