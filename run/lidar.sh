#!/usr/bin/env bash
# Launch the LIDAR SOME/IP service inside the 'lidar' namespace.
# Run as root:  sudo bash run/lidar.sh   [--cycle <ms>]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../net/env.sh"

if [[ $EUID -ne 0 ]]; then
    echo "Run as root:  sudo bash run/lidar.sh" >&2
    exit 1
fi

ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BIN="$ROOT/vsomeip/build/lidar_service"
CFG="$ROOT/vsomeip/config/lidar.json"

[[ -x "$BIN" ]] || { echo "Missing $BIN — build first: bash vsomeip/10-build-apps.sh" >&2; exit 1; }

exec ip netns exec "$LIDAR_NS" env \
    VSOMEIP_CONFIGURATION="$CFG" \
    VSOMEIP_APPLICATION_NAME=lidar_service \
    "$BIN" "$@"
