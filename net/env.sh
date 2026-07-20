#!/usr/bin/env bash
# Shared topology settings. Sourced by the other scripts; not run directly.

BR="br0"                 # OVS bridge = the in-car switch
VLAN="10"                # both ECUs sit on this one VLAN
MON="mon0"               # SPAN mirror port (copy of all switch traffic)

# LIDAR ECU
LIDAR_NS="lidar"
LIDAR_IP="192.168.10.11/24"
LIDAR_VETH="veth-lidar"  # device end (inside the netns)
LIDAR_OVS="ovs-lidar"    # switch end (attached to br0)

# STEERING ("volant") ECU
STEER_NS="steering"
STEER_IP="192.168.10.12/24"
STEER_VETH="veth-steer"
STEER_OVS="ovs-steer"
