# Automotive Ethernet + SOME/IP rig (LIDAR → steering)

A single-PC bench rig that behaves like a real in-car Ethernet segment — **no cables
or ECUs required**. Two automotive nodes talk over **SOME/IP (COVESA vsomeip)**:

- **LIDAR** — a SOME/IP *service* that publishes an obstacle-distance **event** every second.
- **Steering ("volant")** — a SOME/IP *client* that **subscribes** to that event and reacts
  (a one-way ADAS flow: closer obstacle → stronger reaction).

Both nodes have **real, distinct IPs** on the **same subnet and VLAN**, and they can reach
each other **only through a switch** — never directly. An **Open vSwitch** bridge is that
switch; a **SPAN mirror** copies *every* frame (both directions) so an engineer can open the
traffic in **Wireshark** for diagnostics.

> **Want a UI instead of the terminal?** There's a web console (`ui/`) that draws the two
> ECUs and the switch, gives each a power button, animates the traffic, and opens a live
> Wireshark-style packet view when you click the switch. You start **one** thing — the dev
> server — and run everything else from the browser. See **[Web console](#web-console)** below.

```
 netns: lidar (192.168.10.11)              netns: steering (192.168.10.12)
   [ lidar_service ]  --veth-\                        /-veth--  [ steering_client ]
                              ovs-lidar          ovs-steer
                          (VLAN 10 access)   (VLAN 10 access)
                               \____ br0  (Open vSwitch = the SWITCH) ____/
                                             |  mirror span0 (select-all)
                                             v
                                           mon0  --> tcpdump/dumpcap --> captures/*.pcapng --> Wireshark
```

Everything runs inside **WSL2 (Ubuntu)** on Windows — real Linux L2 networking (network
namespaces, veth, VLAN, Open vSwitch) does not exist natively on Windows.

## Why it is built this way

- **Two network namespaces = two ECUs.** Each has its own network stack and real IP. Their
  only link is a `veth` into `br0`, so the switch is genuinely in the path of every frame.
- **Open vSwitch on the kernel datapath.** `net/01-up.sh` uses the kernel datapath
  (`datapath_type=system`) whenever the `openvswitch` module is available — which it is on
  current WSL2 kernels (6.6.x ships it). This matters: the userspace (`netdev`) datapath **does
  not deliver IP multicast** on this stack, and SOME/IP Service Discovery *is* multicast — so on
  netdev the two nodes never discover each other. If the module is truly absent the script falls
  back to `netdev` and warns that discovery will likely fail.
- **`rp_filter` off in each namespace.** Reverse-path filtering silently drops the inbound SD
  multicast at the IP layer (the frame reaches the veth but never the joined socket). The bring-up
  script disables it per namespace.
- **Per-node `network` key in the vsomeip config.** A namespace isolates the network stack but
  **not** the filesystem — both nodes share `/tmp` and `/dev/shm`. Each vsomeip app is its own
  routing manager, so `"network": "lidar"` vs `"network": "steering"` keeps their local sockets
  from colliding.
- **Multicast snooping off.** SOME/IP Service Discovery uses UDP multicast
  (`224.244.224.245:30490`). With no IGMP querier on this virtual segment, snooping stays off so
  SD floods within the VLAN.

## Prerequisites

- Windows 11 with **WSL2 + Ubuntu** (`wsl --install -d Ubuntu` if not present).
- Run all commands **inside the Ubuntu shell**.
- **Wireshark on Windows** to open the captures (built-in SOME/IP + SOME/IP-SD dissectors).

## Layout

```
net/     01-up.sh / 99-down.sh / env.sh   — build & tear down the switched segment
vsomeip/ 00-build.sh / 10-build-apps.sh   — build vsomeip, then the two apps
         src/    lidar_service.cpp, steering_client.cpp, sample-ids.hpp, CMakeLists.txt
         config/ lidar.json, steering.json  — per-node IP, identity, SOME/IP-SD
run/     lidar.sh / steering.sh / capture.sh — launch each node in its namespace; capture
```

## Run order

```bash
# one-time build
sudo bash vsomeip/00-build.sh        # deps + vsomeip -> /usr/local
bash      vsomeip/10-build-apps.sh   # build lidar_service + steering_client

# bring the segment up
sudo bash net/01-up.sh

# start the capture FIRST (own terminal) so you catch the discovery handshake
sudo bash run/capture.sh

# then the two ECUs (each in its own terminal)
sudo bash run/lidar.sh
sudo bash run/steering.sh

# open captures/rig.pcapng in Wireshark on Windows

# tear down when done
sudo bash net/99-down.sh
```

The LIDAR terminal prints the distance it publishes; the steering terminal prints the reaction
it takes for each received event.

## SOME/IP identity (for the Wireshark filter)

| Field       | Value    |
|-------------|----------|
| Service     | `0x1234` |
| Instance    | `0x5678` |
| Event       | `0x8778` |
| Eventgroup  | `0x4465` |
| SD multicast| `224.244.224.245:30490` (UDP) |
| Event port  | `30509` (UDP, unicast `.11 → .12`) |

In Wireshark, `someip || someip_sd` isolates the rig traffic. If the event stream on UDP 30509
isn't auto-recognized, right-click a packet → **Decode As… → SOME/IP**.

## Web console

`ui/` is a Next.js + React + Tailwind app (styled to match the zelos site — Mulish type, light
mode) that turns the whole rig into a point-and-click console:

- a drawing of the **LIDAR**, the **switch (OVS)**, and the **steering wheel**, each with a
  **power button** underneath;
- **live traffic** animated along the wires, coloured by protocol (SOME/IP-SD, SOME/IP event, ARP);
- **hover / "Actions"** on a device to watch what it's doing in real time (the LIDAR's published
  distances, the steering's `REACT` decisions);
- **click the switch → a live Wireshark-style capture** off the SPAN mirror (`mon0`): number,
  time, source/destination IP (+ friendly name), protocol, length and a decoded info column —
  filterable, follow-scroll, click a row for detail.

The backend is a set of Next.js API routes that run **inside WSL2 as root** and drive the real
rig — the same `net/01-up.sh` / `net/99-down.sh` scripts, the vsomeip binaries, and `tshark` on
`mon0`. Nothing is faked: the packets in the table are the packets on the wire.

### Run it (one command)

From the repo root, inside WSL2:

```bash
npm run dev
```

That's it. The first run **bootstraps everything itself** — it elevates to root (you may be
asked for your password), installs the UI deps and `tshark`, builds vsomeip and the two rig
apps, then starts the console. Later runs skip straight to the server.

Open **http://localhost:3000** on Windows. Power on the switch, start LIDAR and steering, and
click the switch to watch the capture. Every other action (bring-up, teardown, start/stop)
happens from the page.

Notes:
- Prefer not to be prompted? `sudo npm run dev` works the same way.
- First run compiles vsomeip, so it takes a few minutes; subsequent runs are instant.
- Editing the code from Windows? The server polls for changes (`WATCHPACK_POLLING`), because
  inotify doesn't fire on the `/mnt/c` mount.

## Verify it end-to-end

1. **Switch is the only path**
   ```bash
   sudo ip netns exec lidar ping -c2 192.168.10.12   # succeeds
   sudo ovs-appctl fdb/show br0                       # both MACs learned on ovs-lidar/ovs-steer
   sudo ovs-vsctl del-port br0 ovs-steer              # now ping fails -> the path WAS the switch
   sudo bash net/01-up.sh                             # re-add to continue
   ```
2. **Mirror works** — with `run/capture.sh` running, the ping's ARP + ICMP show up on `mon0`.
3. **Discovery** — Wireshark shows `OfferService (0x1234/0x5678)` from `.11`, then
   `SubscribeEventgroup (0x4465)` from `.12`, then `SubscribeEventgroupAck`.
4. **Events flow** — periodic notifications for event `0x8778`, unicast `.11 → .12` (UDP 30509);
   the steering console logs each obstacle distance and its reaction.

## Troubleshooting

- **No discovery / service "NOT available"** — almost always the datapath. Confirm `net/01-up.sh`
  printed `datapath: system`. The userspace `netdev` datapath drops multicast, so SD never arrives.
  Load the module (`sudo modprobe openvswitch`) and re-run. Also confirm `rp_filter` is `0` in the
  namespaces and `mcast_snooping_enable=false` on `br0` (all set by `net/01-up.sh`).
- **Second app won't offer/subscribe** — check the two configs have *different* `"network"` values.
- **`libvsomeip3.so` not found** — re-run `sudo ldconfig` (00-build.sh installs to `/usr/local`).
- **Capture drops frames** under heavy load on `/mnt/c` (9p). Capture to ext4 instead:
  `sudo CAP_DIR=~/captures bash run/capture.sh`, then open via
  `\\wsl.localhost\Ubuntu\home\<you>\captures\`.

## Live capture straight into Wireshark (optional)

From a Windows PowerShell/cmd prompt:

```
wsl -u root tcpdump -i mon0 -U -s0 -w - | "C:\Program Files\Wireshark\Wireshark.exe" -k -i -
```

## Attribution

`vsomeip/src/lidar_service.cpp` and `steering_client.cpp` are adapted from the
[COVESA/vsomeip](https://github.com/COVESA/vsomeip) `notify-sample` / `subscribe-sample`
examples (MPL-2.0).
