#!/usr/bin/env bash
# Launch the IVI SOME/IP service inside the 'ivi' namespace.
# Run as root:  sudo bash run/ivi.sh    [--cycle <ms>]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../net/env.sh"

if [[ $EUID -ne 0 ]]; then
    echo "Run as root:  sudo bash run/ivi.sh" >&2
    exit 1
fi

ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BIN="$ROOT/vsomeip/build/ivi_service"
CFG="$ROOT/vsomeip/config/ivi.json"

[[ -x "$BIN" ]] || { echo "Missing $BIN — build first: bash vsomeip/10-build-apps.sh" >&2; exit 1; }

# Executes inside the IVI network namespace (falls back to "ivi" if not set in net/env.sh)
exec ip netns exec "${IVI_NS:-ivi}" env \
    VSOMEIP_CONFIGURATION="$CFG" \
    VSOMEIP_APPLICATION_NAME=ivi_service \
    "$BIN" "$@"
