#!/usr/bin/env bash
# One command to rule them all: `npm run dev`.
# Ensures everything the rig needs, then starts the Next.js console.
#   - self-elevates to root (network namespaces / OVS / tshark need it)
#   - installs UI deps, tshark, and builds vsomeip + the rig apps on first run
# After this, you only click buttons in the browser.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"   # ui/
ROOT="$(cd "$HERE/.." && pwd)"                            # repo root

# 1. root — API routes run netns / OVS / tshark
if [[ $EUID -ne 0 ]]; then
  echo "==> elevating (netns / OVS / tshark need root; you may be asked for your password)"
  exec sudo --preserve-env=PATH,HOME bash "$HERE/scripts/dev.sh" "$@"
fi

# 2. UI dependencies
if [[ ! -d "$HERE/node_modules" ]]; then
  echo "==> installing UI dependencies"
  (cd "$HERE" && npm install)
fi

# 3. tshark (packet dissection for the capture view)
if ! command -v tshark >/dev/null 2>&1; then
  echo "==> installing tshark"
  export DEBIAN_FRONTEND=noninteractive
  echo "wireshark-common wireshark-common/install-setuid boolean false" | debconf-set-selections
  apt-get update -qq
  apt-get install -y tshark
fi

# 4. vsomeip library (first run only — a few minutes)
if [[ ! -e /usr/local/lib/libvsomeip3.so ]]; then
  echo "==> building vsomeip (first run, this takes a few minutes)"
  bash "$ROOT/vsomeip/00-build.sh"
fi

# 5. the two rig apps
if [[ ! -x "$ROOT/vsomeip/build/lidar_service" || ! -x "$ROOT/vsomeip/build/steering_client" ]]; then
  echo "==> building the LIDAR + steering apps"
  bash "$ROOT/vsomeip/10-build-apps.sh"
fi

# 6. run — must start from ui/ so the API routes resolve the repo root correctly.
#    Poll for file changes: inotify doesn't fire on the Windows (/mnt/c) mount.
cd "$HERE"
export WATCHPACK_POLLING=true
echo "==> Rig Console ready at http://localhost:3000"
exec "$HERE/node_modules/.bin/next" dev -H 0.0.0.0 -p 3000
