#!/usr/bin/env bash

# This script sets up Tailscale in userspace networking mode for Render deployments
# and then starts the Node.js server.

if [ -n "$TAILSCALE_AUTH_KEY" ]; then
  echo "Downloading Tailscale..."
  # Download static binaries for Tailscale
  wget https://pkgs.tailscale.com/stable/tailscale_1.66.4_amd64.tgz
  tar xzf tailscale_1.66.4_amd64.tgz
  
  echo "Starting tailscaled in userspace mode..."
  # Run tailscaled with userspace networking and expose an HTTP/SOCKS5 proxy on port 1055
  ./tailscale_1.66.4_amd64/tailscaled --tun=userspace-networking --socks5-server=localhost:1055 --outbound-http-proxy-listen=localhost:1055 &
  
  # Wait for the daemon to start
  sleep 5
  
  echo "Authenticating Tailscale..."
  ./tailscale_1.66.4_amd64/tailscale up --authkey=${TAILSCALE_AUTH_KEY} --hostname=cliniaura-render-backend --accept-routes
  
  # Set the HTTP_PROXY environment variable so Node.js can route requests through Tailscale
  export HTTP_PROXY="http://127.0.0.1:1055"
  echo "Tailscale setup complete. Proxy running on $HTTP_PROXY."
else
  echo "No TAILSCALE_AUTH_KEY found in environment. Skipping Tailscale setup."
fi

echo "Starting Node.js server..."
node server.js
