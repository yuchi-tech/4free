#!/bin/sh
set -eu

DATA_DIR="${DATA_DIR:-/data}"
XRAY_DIR="$DATA_DIR/xray"
XRAY_CONFIG="$XRAY_DIR/config.json"
CLIENT_JSON="$DATA_DIR/client.json"
STATE_FILE="$DATA_DIR/server.env"

mkdir -p "$XRAY_DIR"

write_state() {
  cat > "$STATE_FILE" <<EOF
XRAY_UUID=$XRAY_UUID
REALITY_PRIVATE_KEY=$REALITY_PRIVATE_KEY
REALITY_PUBLIC_KEY=$REALITY_PUBLIC_KEY
REALITY_SHORT_ID=$REALITY_SHORT_ID
EOF
}

load_or_create_state() {
  if [ -f "$STATE_FILE" ]; then
    # shellcheck disable=SC1090
    . "$STATE_FILE"
  fi

  XRAY_UUID="${XRAY_UUID:-$(cat /proc/sys/kernel/random/uuid)}"

  if [ -z "${REALITY_PRIVATE_KEY:-}" ] || [ -z "${REALITY_PUBLIC_KEY:-}" ]; then
    keys="$(xray x25519)"
    REALITY_PRIVATE_KEY="$(printf '%s\n' "$keys" | awk -F': ' '/Private key/ {print $2}')"
    REALITY_PUBLIC_KEY="$(printf '%s\n' "$keys" | awk -F': ' '/Public key/ {print $2}')"
  fi

  REALITY_SHORT_ID="${REALITY_SHORT_ID:-$(openssl rand -hex 8)}"
  write_state
}

render_xray_config() {
  sed \
    -e "s|\${XRAY_PORT}|${XRAY_PORT:-443}|g" \
    -e "s|\${XRAY_UUID}|$XRAY_UUID|g" \
    -e "s|\${REALITY_PRIVATE_KEY}|$REALITY_PRIVATE_KEY|g" \
    -e "s|\${REALITY_SHORT_ID}|$REALITY_SHORT_ID|g" \
    -e "s|\${REALITY_DEST}|${REALITY_DEST:-www.microsoft.com:443}|g" \
    -e "s|\${REALITY_SERVER_NAME}|${REALITY_SERVER_NAME:-www.microsoft.com}|g" \
    /app/xray/config.template.json > "$XRAY_CONFIG"
}

write_client_json() {
  cat > "$CLIENT_JSON" <<EOF
{
  "serverAddress": "${SERVER_ADDRESS:-}",
  "xrayPort": "${XRAY_PORT:-443}",
  "uuid": "$XRAY_UUID",
  "protocol": "VLESS",
  "transport": "TCP",
  "security": "Reality",
  "flow": "xtls-rprx-vision",
  "sni": "${REALITY_SERVER_NAME:-www.microsoft.com}",
  "fingerprint": "chrome",
  "publicKey": "$REALITY_PUBLIC_KEY",
  "shortId": "$REALITY_SHORT_ID",
  "remark": "${CLIENT_REMARK:-YC4free}"
}
EOF
}

stop_children() {
  if [ -n "${XRAY_PID:-}" ]; then
    kill "$XRAY_PID" 2>/dev/null || true
  fi
  if [ -n "${WEB_PID:-}" ]; then
    kill "$WEB_PID" 2>/dev/null || true
  fi
}

load_or_create_state
render_xray_config
write_client_json

trap stop_children INT TERM

xray run -config "$XRAY_CONFIG" &
XRAY_PID="$!"

node /app/server/server.js &
WEB_PID="$!"

wait -n "$XRAY_PID" "$WEB_PID"
status="$?"
stop_children
exit "$status"

