#!/usr/bin/env bash
set -e

# Tailscale userspace networking for Render (no root required)
# Socket + state go to /tmp (always writable)

if [ -n "$TAILSCALE_AUTH_KEY" ]; then
  echo "=== Setting up Tailscale for Render ==="

  TSFILE="tailscale_1.80.3_amd64.tgz"
  TSDIR="tailscale_1.80.3_amd64"
  TSSOCK="/tmp/tailscale.sock"

  echo "Downloading Tailscale..."
  wget -q "https://pkgs.tailscale.com/stable/${TSFILE}"
  tar xzf "${TSFILE}"

  echo "Starting tailscaled (userspace, SOCKS5 on 127.0.0.1:1055)..."
  ./${TSDIR}/tailscaled \
    --tun=userspace-networking \
    --socks5-server=127.0.0.1:1055 \
    --state=mem: \
    --socket="${TSSOCK}" \
    &
  echo "tailscaled started (PID: $!)"

  # Wait for socket to appear
  echo "Waiting for tailscaled socket..."
  for i in $(seq 1 20); do
    if [ -S "${TSSOCK}" ]; then
      echo "Socket ready after ${i}s"
      break
    fi
    sleep 1
  done

  echo "Authenticating with Tailscale..."
  ./${TSDIR}/tailscale \
    --socket="${TSSOCK}" \
    up \
    --authkey="${TAILSCALE_AUTH_KEY}" \
    --hostname=cliniaura-render \
    --accept-routes \
    --accept-dns=false

  echo "Tailscale status:"
  ./${TSDIR}/tailscale --socket="${TSSOCK}" status || true

  # IMPORTANT: Do NOT set ALL_PROXY / HTTP_PROXY / HTTPS_PROXY
  # Node.js native fetch (undici) picks those up and tries HTTP CONNECT
  # which is incompatible with Tailscale's SOCKS5 server.
  # Instead we export a custom var that server.js reads explicitly via node-fetch.
  export EDGE_SOCKS5="socks5://127.0.0.1:1055"

  echo "=== Tailscale ready. Custom var EDGE_SOCKS5 set ==="
else
  echo "No TAILSCALE_AUTH_KEY - skipping Tailscale."
fi

echo "=== Starting Node.js server ==="
exec node server.js
