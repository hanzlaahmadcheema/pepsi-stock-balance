#!/usr/bin/env bash
set -e

# ==============================================================================
#  Pepsi Stock Balance - Update & Run Everything (Linux / Unix)
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=============================================================================="
echo "  PEPSI STOCK BALANCE - UPDATE AND RUN EVERYTHING (LINUX)"
echo "=============================================================================="
echo "[INFO] Working Directory: $SCRIPT_DIR"
echo "[INFO] Timestamp: $(date)"
echo "=============================================================================="
echo ""

echo "[1/5] Pulling latest code from origin main..."
git fetch origin main
git reset --hard origin/main
echo "[OK] Code updated to commit: $(git log -1 --oneline)"
echo ""

echo "[2/5] Verifying Node dependencies..."
npm install --no-audit --no-fund
echo ""

echo "[3/5] Generating Prisma client..."
npx prisma generate
echo ""

echo "[4/5] Building application and standalone sync daemon..."
npm run build
echo "[OK] Build completed."
echo ""

echo "[5/5] Starting application and services..."

# Check if systemd service exists
if systemctl is-active --quiet pepsi-depot-web.service 2>/dev/null; then
    echo "[INFO] Restarting systemd services..."
    sudo systemctl restart pepsi-depot-web.service
    sudo systemctl restart pepsi-depot-sync.service 2>/dev/null || true
    echo "[OK] Services restarted."
    exit 0
fi

# Check if PM2 is running
if command -v pm2 >/dev/null 2>&1 && pm2 list | grep -q "pepsi"; then
    echo "[INFO] Restarting PM2 processes..."
    pm2 restart all
    exit 0
fi

echo "[INFO] Starting Next.js server on port 3000..."
npm run start &
SERVER_PID=$!

echo "[INFO] Starting Sync Daemon..."
if [ -f "dist/daemon/standalone.js" ]; then
    node dist/daemon/standalone.js &
    DAEMON_PID=$!
else
    npm run sync:daemon &
    DAEMON_PID=$!
fi

echo ""
echo "=============================================================================="
echo "  Application running at: http://localhost:3000"
echo "  Server PID: $SERVER_PID | Daemon PID: $DAEMON_PID"
echo "=============================================================================="
echo "Press Ctrl+C to stop."

trap "kill $SERVER_PID $DAEMON_PID 2>/dev/null || true; exit 0" SIGINT SIGTERM
wait
