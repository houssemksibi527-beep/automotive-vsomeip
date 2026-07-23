#!/usr/bin/env bash
# Bring up the simulated in-car Ethernet segment:
#
#   netns ivi (192.168.10.13) --veth--\                 /--veth-- netns hpc (192.168.10.14)
#                                        [ br0 : OVS switch, VLAN 10 ]
#                                              |
#                                           mon0  (SPAN: copy of ALL traffic -> Wireshark)
#
# The two ECUs have NO direct link; every frame is switched by br0.
# Run inside WSL2 Ubuntu as root:  sudo bash net/01-up.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/env.sh"

if [[ $EUID -ne 0 ]]; then
    echo "Run as root:  sudo bash net/01-up.sh" >&2
    exit 1
fi

echo "[1/9] Starting Open vSwitch..."
modprobe openvswitch 2>/dev/null || true
/usr/share/openvswitch/scripts/ovs-ctl --system-id=random --no-monitor start || true

# Datapath choice is critical: the userspace (netdev) datapath does NOT deliver IP
# multicast on this stack, and SOME/IP Service Discovery is multicast. The kernel
# datapath ("system") delivers it correctly, so prefer it whenever the module loads.
echo "[2/9] Creating bridge $BR..."
if modprobe -n openvswitch >/dev/null 2>&1 || lsmod | grep -q '^openvswitch'; then
    DP="system"
else
    DP="netdev"
    echo "  WARNING: openvswitch kernel module unavailable -> falling back to userspace datapath."
    echo "           SOME/IP Service Discovery multicast will likely NOT be delivered."
fi
ovs-vsctl --may-exist add-br "$BR" -- set bridge "$BR" datapath_type="$DP"
ip link set "$BR" up
echo "  datapath: $DP"

echo "[3/9] Creating namespaces $IVI_NS and $HPC_NS..."
ip netns add "$IVI_NS" 2>/dev/null || true
ip netns add "$HPC_NS" 2>/dev/null || true

echo "[4/9] Creating veth pairs (removing any stale ones first)..."
ip link del "$IVI_OVS" 2>/dev/null || true
ip link del "$HPC_OVS" 2>/dev/null || true
ip link add "$IVI_VETH" type veth peer name "$IVI_OVS"
ip link add "$HPC_VETH" type veth peer name "$HPC_OVS"
ip link set "$IVI_VETH" netns "$IVI_NS"
ip link set "$HPC_VETH" netns "$HPC_NS"

echo "[5/9] Attaching switch ends as ACCESS ports on VLAN $VLAN..."
ovs-vsctl --may-exist add-port "$BR" "$IVI_OVS" tag="$VLAN"
ovs-vsctl --may-exist add-port "$BR" "$HPC_OVS" tag="$VLAN"
ip link set "$IVI_OVS" up
ip link set "$HPC_OVS" up

echo "[6/9] Assigning IPs inside the namespaces..."
ip netns exec "$IVI_NS" ip addr add "$IVI_IP" dev "$IVI_VETH"
ip netns exec "$IVI_NS" ip link set "$IVI_VETH" up
ip netns exec "$IVI_NS" ip link set lo up
ip netns exec "$HPC_NS" ip addr add "$HPC_IP" dev "$HPC_VETH"
ip netns exec "$HPC_NS" ip link set "$HPC_VETH" up
ip netns exec "$HPC_NS" ip link set lo up

echo "[7/9] Adding a multicast route so SOME/IP-SD egresses the veth (no default gw exists)..."
ip netns exec "$IVI_NS" ip route add 224.0.0.0/4 dev "$IVI_VETH"
ip netns exec "$HPC_NS" ip route add 224.0.0.0/4 dev "$HPC_VETH"

# Reverse-path filtering silently drops inbound SOME/IP-SD multicast at the IP
# layer (the packet reaches the veth but never the joined socket). Turn it off
# in each namespace so Service Discovery is actually received.
ip netns exec "$IVI_NS" sysctl -qw net.ipv4.conf.all.rp_filter=0
ip netns exec "$IVI_NS" sysctl -qw net.ipv4.conf.default.rp_filter=0
ip netns exec "$IVI_NS" sysctl -qw "net.ipv4.conf.$IVI_VETH.rp_filter=0"
ip netns exec "$HPC_NS" sysctl -qw net.ipv4.conf.all.rp_filter=0
ip netns exec "$HPC_NS" sysctl -qw net.ipv4.conf.default.rp_filter=0
ip netns exec "$HPC_NS" sysctl -qw "net.ipv4.conf.$HPC_VETH.rp_filter=0"

echo "[8/9] Creating SPAN mirror port $MON (copies ALL switch traffic, both directions)..."
ovs-vsctl --may-exist add-port "$BR" "$MON" -- set interface "$MON" type=internal
ip link set "$MON" up
ovs-vsctl -- --id=@m get port "$MON" \
          -- --id=@s create mirror name=span0 select-all=true output-port=@m \
          -- set bridge "$BR" mirrors=@s

echo "[9/9] Disabling multicast snooping (no IGMP querier -> SD must flood inside the VLAN)..."
ovs-vsctl set bridge "$BR" mcast_snooping_enable=false

echo
echo "Segment is up. Switch topology:"
ovs-vsctl show
echo
echo "Next:"
echo "  sudo bash run/capture.sh     # start capture FIRST (in its own terminal)"
echo "  sudo bash run/ivi.sh         # then the IVI service"
echo "  sudo bash run/hpc.sh         # then the HPC client"
echo "  sudo bash net/99-down.sh     # tear everything down"
