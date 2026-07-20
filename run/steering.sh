#!/usr/bin/env bash
# Launch the STEERING SOME/IP client inside the 'steering' namespace.
# Run as root:  sudo bash run/steering.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../net/env.sh"

if [[ $EUID -ne 0 ]]; then
    echo "Run as root:  sudo bash run/steering.sh" >&2
    exit 1
fi

ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BIN="$ROOT/vsomeip/build/steering_client"
CFG="$ROOT/vsomeip/config/steering.json"

[[ -x "$BIN" ]] || { echo "Missing $BIN — build first: bash vsomeip/10-build-apps.sh" >&2; exit 1; }

exec ip netns exec "$STEER_NS" env \
    VSOMEIP_CONFIGURATION="$CFG" \
    VSOMEIP_APPLICATION_NAME=steering_client \
    "$BIN" "$@"
