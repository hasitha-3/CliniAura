#!/usr/bin/env bash
set -e

# This script sets up Tailscale in userspace networking mode for Render deployments
# and then starts the Node.js server.

if [ -n "$TAILSCALE_AUTH_KEY" ]; then
  echo "=== Setting up Tailscale for Render ==="
  
  # Download latest stable Tailscale
  TSFILE="tailscale_1.80.3_amd64.tgz"
  echo "Downloading Tailscale..."
  wget -q "https://pkgs.tailscale.com/stable/${TSFILE}"
  tar xzf "${TSFILE}"
  TSDIR="tailscale_1.80.3_amd64"

  echo "Starting tailscaled in userspace mode with SOCKS5 proxy on port 1055..."
  # SOCKS5 server on port 1055 for outbound connections to Tailscale IPs
  ./${TSDIR}/tailscaled \
    --tun=userspace-networking \
    --socks5-server=localhost:1055 \
    --state=mem: \
    &
  TAILSCALED_PID=$!
  echo "tailscaled started (PID: $TAILSCALED_PID)"

  # Wait for the daemon socket to be ready
  sleep 5

  echo "Authenticating Tailscale..."
  ./${TSDIR}/tailscale up \
    --authkey="${TAILSCALE_AUTH_KEY}" \
    --hostname=cliniaura-render-backend \
    --accept-routes \
    --accept-dns=false

  echo "Tailscale status:"
  ./${TSDIR}/tailscale status || true

  # Export SOCKS5 proxy for Node.js (used by ALL_PROXY)
  export ALL_PROXY="socks5://127.0.0.1:1055"
  # Also set for undici / node-fetch
  export HTTPS_PROXY="socks5://127.0.0.1:1055"
  export HTTP_PROXY="socks5://127.0.0.1:1055"
  
  # Only proxy Tailscale IPs (100.x.x.x range) — don't proxy public internet
  export NO_PROXY="localhost,127.0.0.1,render.com,onrender.com,mongodb.net"

  echo "=== Tailscale setup complete. SOCKS5 proxy on 127.0.0.1:1055 ==="
else
  echo "No TAILSCALE_AUTH_KEY found. Skipping Tailscale setup."
fi

echo "=== Starting Node.js server... ==="
exec node server.js
