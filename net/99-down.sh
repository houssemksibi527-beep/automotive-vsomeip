#!/usr/bin/env bash
# Tear down the simulated segment (switch, namespaces, veths, mirror).
# Run as root:  sudo bash net/99-down.sh
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/env.sh"

if [[ $EUID -ne 0 ]]; then
    echo "Run as root:  sudo bash net/99-down.sh" >&2
    exit 1
fi

ovs-vsctl --if-exists clear bridge "$BR" mirrors
ovs-vsctl --if-exists del-br "$BR"
ip netns del "$IVI_NS" 2>/dev/null || true
ip netns del "$HPC_NS" 2>/dev/null || true
ip link del "$IVI_OVS" 2>/dev/null || true
ip link del "$HPC_OVS" 2>/dev/null || true

echo "Segment torn down."
