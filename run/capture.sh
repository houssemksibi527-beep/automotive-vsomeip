#!/usr/bin/env bash
# Capture ALL switch traffic (both directions) from the SPAN mirror port mon0
# and write it where Wireshark on Windows can open it.
#
# Run as root, in its own terminal, BEFORE starting the apps:
#   sudo bash run/capture.sh
# Override the output dir with:  sudo CAP_DIR=~/captures bash run/capture.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../net/env.sh"

if [[ $EUID -ne 0 ]]; then
    echo "Run as root:  sudo bash run/capture.sh" >&2
    exit 1
fi

# Default: a Windows-visible folder (open directly in Explorer / Wireshark).
CAP_DIR="${CAP_DIR:-/mnt/c/Users/khale/Documents/houssem_ksibi/captures}"
mkdir -p "$CAP_DIR"

ip link show "$MON" >/dev/null 2>&1 || { echo "Mirror port $MON not found — run: sudo bash net/01-up.sh" >&2; exit 1; }

echo "Capturing $MON  ->  $CAP_DIR   (Ctrl-C to stop)"
echo "Open the resulting file in Wireshark on Windows; SOME/IP-SD on UDP 30490 is auto-dissected."

if command -v dumpcap >/dev/null 2>&1; then
    exec dumpcap -i "$MON" -w "$CAP_DIR/rig.pcapng" -b filesize:51200 -b files:20
else
    # tcpdump fallback: rotating .pcap (50 MB x 20 files), unbuffered, full frames.
    exec tcpdump -i "$MON" -n -s0 -U -C 50 -W 20 -w "$CAP_DIR/rig.pcap"
fi
