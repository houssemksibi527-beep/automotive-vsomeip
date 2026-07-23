#!/usr/bin/env bash
# Launch the HPC SOME/IP client inside the 'hpc' namespace.
# Run as root:  sudo bash run/hpc.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../net/env.sh"

if [[ $EUID -ne 0 ]]; then
    echo "Run as root:  sudo bash run/hpc.sh" >&2
    exit 1
fi

ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BIN="$ROOT/vsomeip/build/hpc_client"
CFG="$ROOT/vsomeip/config/hpc.json"

[[ -x "$BIN" ]] || { echo "Missing $BIN — build first: bash vsomeip/10-build-apps.sh" >&2; exit 1; }

exec ip netns exec "${HPC_NS:-hpc}" env \
    VSOMEIP_CONFIGURATION="$CFG" \
    VSOMEIP_APPLICATION_NAME=hpc_client \
    "$BIN" "$@"
