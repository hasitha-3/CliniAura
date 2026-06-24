#!/usr/bin/env bash
set -e

# Tailscale userspace networking for Render (no root required)
# Key: redirect socket + state to /tmp which is always writable

if [ -n "$TAILSCALE_AUTH_KEY" ]; then
  echo "=== Setting up Tailscale for Render ==="

  TSFILE="tailscale_1.80.3_amd64.tgz"
  TSDIR="tailscale_1.80.3_amd64"
  TSSOCK="/tmp/tailscale.sock"

  echo "Downloading Tailscale..."
  wget -q "https://pkgs.tailscale.com/stable/${TSFILE}"
  tar xzf "${TSFILE}"

  echo "Starting tailscaled (userspace, SOCKS5 on :1055, socket at /tmp)..."
  ./${TSDIR}/tailscaled \
    --tun=userspace-networking \
    --socks5-server=127.0.0.1:1055 \
    --state=mem: \
    --socket="${TSSOCK}" \
    &
  TAILSCALED_PID=$!
  echo "tailscaled started (PID: $TAILSCALED_PID)"

  # Wait for daemon to be ready
  echo "Waiting for tailscaled to start..."
  for i in $(seq 1 15); do
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

  # Route only Tailscale traffic through SOCKS5 proxy
  export ALL_PROXY="socks5://127.0.0.1:1055"
  export NO_PROXY="localhost,127.0.0.1,render.com,onrender.com,mongodb.net,nrf5ond.mongodb.net,kjzfjen.mongodb.net"

  echo "=== Tailscale ready. SOCKS5 on 127.0.0.1:1055 ==="
else
  echo "No TAILSCALE_AUTH_KEY — skipping Tailscale."
fi

echo "=== Starting Node.js server ==="
exec node server.js
