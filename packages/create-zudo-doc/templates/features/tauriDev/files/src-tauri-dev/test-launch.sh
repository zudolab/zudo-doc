#!/bin/bash
# Test script: launch app via open (Finder simulation), verify dev server loads.
# Usage: bash test-launch.sh [count]
#   count  — number of launch iterations (default 3)
# Exits 0 on success, 1 on failure.
#
# The script reads the port from devServerUrl in a known test config.json, or
# accepts it via the DEV_PORT env var. Readiness is checked by curling
# <devServerUrl>/ (root), not /___ready — zfb dev server has no /___ready endpoint.
#
# The app must already be built: src-tauri-dev/target/release/bundle/macos/zudo-doc\ dev.app

COUNT=${1:-3}
PASS=0
FAIL=0

# Port to check: parse from test config, or fall back to env var / default 4321
TEST_CONFIG="${HOME}/Library/Application Support/com.takazudo.zudo-doc-dev/config.json"
if [ -f "$TEST_CONFIG" ]; then
  DEV_SERVER_URL=$(python3 -c "import json,sys; d=json.load(open(sys.argv[1])); print(d.get('devServerUrl',''))" "$TEST_CONFIG" 2>/dev/null)
  DEV_PORT=$(echo "$DEV_SERVER_URL" | sed 's/.*:\([0-9]*\).*/\1/')
fi
DEV_PORT="${DEV_PORT:-${DEV_PORT_OVERRIDE:-4321}}"
READY_URL="http://localhost:${DEV_PORT}/"

echo "Using port: ${DEV_PORT} (ready URL: ${READY_URL})"

for RUN in $(seq 1 "$COUNT"); do
  echo "=== Run $RUN/$COUNT ==="

  # Kill everything
  ps aux | grep "zudo-doc-dev" | grep -v grep | awk '{print $2}' | xargs kill 2>/dev/null
  lsof -ti :"$DEV_PORT" | xargs kill 2>/dev/null
  sleep 3

  # Launch via open (use build output or override)
  APP_PATH="${APP_OVERRIDE:-$(dirname "$0")/target/release/bundle/macos/zudo-doc dev.app}"
  open "$APP_PATH"

  # Wait up to 60s for dev server to be available
  OK=0
  for i in $(seq 1 20); do
    sleep 3
    READY=$(curl -s -o /dev/null -w "%{http_code}" "$READY_URL" 2>/dev/null)
    if [ "$READY" = "200" ]; then
      echo "  Run $RUN: PASS (ready at $((i*3))s, HTTP 200 at ${READY_URL})"
      OK=1
      PASS=$((PASS + 1))
      break
    fi
  done

  if [ "$OK" = "0" ]; then
    echo "  Run $RUN: FAIL (server not ready after 60s)"
    FAIL=$((FAIL + 1))
  fi
done

# Cleanup
ps aux | grep "zudo-doc-dev" | grep -v grep | awk '{print $2}' | xargs kill 2>/dev/null
lsof -ti :"$DEV_PORT" | xargs kill 2>/dev/null

echo ""
echo "=== Results: $PASS/$COUNT passed, $FAIL failed ==="
[ "$FAIL" -gt 0 ] && exit 1 || exit 0
