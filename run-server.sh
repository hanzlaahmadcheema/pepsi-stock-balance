#!/usr/bin/env bash

# ==============================================================================
# Pepsi Stock & Balance ERP — Auto-Restarting Server Watchdog
# Keeps the Next.js server continuously running in an infinite auto-healing loop.
# If the process is killed or stops, it restarts within 3 seconds automatically.
# ==============================================================================

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT="${PORT:-3000}"
LOG_FILE="$PROJECT_DIR/server.log"
WATCHDOG_LOG="$PROJECT_DIR/watchdog.log"
PID_FILE="$PROJECT_DIR/.server.pid"
WATCHDOG_PID_FILE="$PROJECT_DIR/.watchdog.pid"

cd "$PROJECT_DIR"

is_running() {
  curl -s -f --connect-timeout 5 --max-time 8 "http://localhost:$PORT/health" > /dev/null 2>&1
}

start_server_loop() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting Pepsi ERP watchdog loop on port $PORT..."
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Press Ctrl+C at any time to stop."

  # Trap SIGINT/SIGTERM to cleanly kill child server when user presses Ctrl+C
  cleanup() {
    echo ""
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Stopping watchdog and server..."
    if [ -f "$PID_FILE" ]; then
      kill "$(cat "$PID_FILE")" 2>/dev/null || true
      rm -f "$PID_FILE"
    fi
    fuser -k "$PORT/tcp" 2>/dev/null || true
    echo "✓ Stopped cleanly."
    exit 0
  }
  trap cleanup SIGINT SIGTERM

  FAIL_COUNT=0

  while true; do
    SERVER_ALIVE=false
    if [ -f "$PID_FILE" ]; then
      CURR_PID=$(cat "$PID_FILE" 2>/dev/null || echo "")
      if [ -n "$CURR_PID" ] && kill -0 "$CURR_PID" 2>/dev/null; then
        SERVER_ALIVE=true
      fi
    fi

    if is_running; then
      FAIL_COUNT=0
    else
      FAIL_COUNT=$((FAIL_COUNT + 1))
      # If process already exited, or if 3 consecutive health checks failed (over 15s)
      if [ "$SERVER_ALIVE" = false ] || [ "$FAIL_COUNT" -ge 3 ]; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Server not responding (Fail count: $FAIL_COUNT, Alive: $SERVER_ALIVE). Restarting Next.js server..." | tee -a "$WATCHDOG_LOG"

        # Free port 3000 cleanly
        fuser -k "$PORT/tcp" > /dev/null 2>&1 || true
        sleep 1

        # Start Next.js in production mode
        npx next start -p "$PORT" >> "$LOG_FILE" 2>&1 &
        SERVER_PID=$!
        echo "$SERVER_PID" > "$PID_FILE"
        FAIL_COUNT=0

        # Wait up to 20 seconds for health check to pass
        for i in {1..20}; do
          if is_running; then
            echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✓ Server is healthy and active on http://localhost:$PORT (PID $SERVER_PID)" | tee -a "$WATCHDOG_LOG"
            break
          fi
          sleep 1
        done
      fi
    fi

    sleep 5
  done
}

case "$1" in
  start|--daemon)
    if [ -f "$WATCHDOG_PID_FILE" ] && kill -0 "$(cat "$WATCHDOG_PID_FILE")" 2>/dev/null; then
      echo "Watchdog is already running (PID $(cat "$WATCHDOG_PID_FILE"))."
      exit 0
    fi
    echo "Starting watchdog daemon in background..."
    setsid nohup "$0" run-loop > /dev/null 2>&1 &
    WATCHDOG_PID=$!
    echo "$WATCHDOG_PID" > "$WATCHDOG_PID_FILE"
    sleep 2
    if is_running; then
      echo "✓ Server is active on http://localhost:$PORT (Watchdog PID $WATCHDOG_PID)"
    fi
    ;;

  stop)
    echo "Stopping server and watchdog..."
    if [ -f "$WATCHDOG_PID_FILE" ]; then
      kill "$(cat "$WATCHDOG_PID_FILE")" 2>/dev/null || true
      rm -f "$WATCHDOG_PID_FILE"
    fi
    if [ -f "$PID_FILE" ]; then
      kill "$(cat "$PID_FILE")" 2>/dev/null || true
      rm -f "$PID_FILE"
    fi
    fuser -k "$PORT/tcp" 2>/dev/null || true
    echo "✓ All server and watchdog processes stopped."
    ;;

  status)
    if is_running; then
      echo "✓ Server is ACTIVE on http://localhost:$PORT"
      if [ -f "$PID_FILE" ]; then
        echo "  Server PID: $(cat "$PID_FILE" 2>/dev/null || echo 'Unknown')"
      fi
      if [ -f "$WATCHDOG_PID_FILE" ]; then
        echo "  Watchdog PID: $(cat "$WATCHDOG_PID_FILE" 2>/dev/null || echo 'Unknown')"
      fi
    else
      echo "✗ Server is NOT running on port $PORT."
    fi
    exit 0
    ;;


  run-loop)
    start_server_loop
    ;;

  *)
    echo "=============================================================="
    echo " Pepsi Regional ERP — Auto-Restart Server Watchdog"
    echo "=============================================================="
    echo " Usage:"
    echo "   ./run-server.sh           -> Run in foreground (auto-restarts if killed)"
    echo "   ./run-server.sh start     -> Run in background daemon (stays alive)"
    echo "   ./run-server.sh stop      -> Stop both server and watchdog"
    echo "   ./run-server.sh status    -> Check status and PIDs"
    echo "=============================================================="
    echo ""
    start_server_loop
    ;;
esac
