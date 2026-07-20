#!/usr/bin/env bash
# Install dependencies and build+install vsomeip (COVESA) into /usr/local.
# Run once, inside WSL2 Ubuntu, as root:  sudo bash vsomeip/00-build.sh
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
    echo "Run as root:  sudo bash vsomeip/00-build.sh" >&2
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export DEBIAN_FRONTEND=noninteractive

echo "[1/3] Installing build + networking dependencies..."
apt-get update
# tshark (non-interactive: skip the "allow non-root capture" debconf prompt).
echo "wireshark-common wireshark-common/install-setuid boolean false" | debconf-set-selections
apt-get install -y build-essential cmake git libboost-all-dev \
                   openvswitch-switch iproute2 tcpdump tshark

echo "[2/3] Cloning + building vsomeip (COVESA master)..."
cd "$SCRIPT_DIR"
if [[ ! -d vsomeip ]]; then
    git clone https://github.com/COVESA/vsomeip.git
fi
cd vsomeip
cmake -Bbuild -DCMAKE_INSTALL_PREFIX=/usr/local -DENABLE_SIGNAL_HANDLING=1 .
cmake --build build --target install -j"$(nproc)"

echo "[3/3] Refreshing linker cache (so libvsomeip3.so is found)..."
ldconfig

echo "Done. vsomeip installed to /usr/local. Next: bash vsomeip/10-build-apps.sh"
