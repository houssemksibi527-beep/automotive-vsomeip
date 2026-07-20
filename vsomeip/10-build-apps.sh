#!/usr/bin/env bash
# Build the LIDAR service and STEERING client against the installed vsomeip.
# Run after 00-build.sh:  bash vsomeip/10-build-apps.sh   (root not required)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

cmake -Bbuild -S src
cmake --build build -j"$(nproc)"

echo
echo "Built:"
echo "  $SCRIPT_DIR/build/lidar_service"
echo "  $SCRIPT_DIR/build/steering_client"
