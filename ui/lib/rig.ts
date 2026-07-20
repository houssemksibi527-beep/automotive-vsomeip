// Server-only helpers. These run inside WSL2 as root and drive the real rig:
// the OVS switch, the two network namespaces, and the vsomeip processes.
import { exec, spawn } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import fs from "node:fs";

const pexec = promisify(exec);

// `next dev` runs with cwd = ui/, so the repo root is one level up.
export const ROOT = path.resolve(process.cwd(), "..");
export const STATE_DIR = "/tmp/rig-ui";

export const DEVICES = {
  lidar: {
    ns: "lidar",
    ip: "192.168.10.11",
    proc: "lidar_service",
    // Bracketed regex so pgrep/pkill don't match the very shell running them.
    match: "[l]idar_service",
    bin: path.join(ROOT, "vsomeip/build/lidar_service"),
    cfg: path.join(ROOT, "vsomeip/config/lidar.json"),
    appName: "lidar_service",
    args: ["--cycle", "500"],
  },
  steering: {
    ns: "steering",
    ip: "192.168.10.12",
    proc: "steering_client",
    match: "[s]teering_client",
    bin: path.join(ROOT, "vsomeip/build/steering_client"),
    cfg: path.join(ROOT, "vsomeip/config/steering.json"),
    appName: "steering_client",
    args: [] as string[],
  },
} as const;

export type DeviceId = keyof typeof DEVICES;

export function logPath(d: DeviceId) {
  return path.join(STATE_DIR, `${d}.log`);
}

export function sseHeaders(): HeadersInit {
  return {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  };
}

async function sh(cmd: string): Promise<string> {
  try {
    const { stdout } = await pexec(cmd, { shell: "/bin/bash" });
    return stdout.trim();
  } catch {
    return "";
  }
}

async function isRunning(proc: string): Promise<boolean> {
  return (await sh(`pgrep -f ${proc} || true`)).length > 0;
}

export async function getStatus() {
  const brExists = await sh(`ovs-vsctl br-exists br0 && echo yes || echo no`);
  const nsList = await sh(`ip netns list 2>/dev/null | awk '{print $1}'`);
  const switchUp = brExists === "yes" && nsList.includes("lidar") && nsList.includes("steering");
  return {
    switch: switchUp,
    lidar: await isRunning(DEVICES.lidar.match),
    steering: await isRunning(DEVICES.steering.match),
  };
}

export async function switchUp() {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  await pexec(`bash ${path.join(ROOT, "net/01-up.sh")}`, { shell: "/bin/bash" });
}

export async function switchDown() {
  await sh(`pkill -TERM -f '${DEVICES.lidar.match}'; pkill -TERM -f '${DEVICES.steering.match}'; true`);
  await pexec(`bash ${path.join(ROOT, "net/99-down.sh")}`, { shell: "/bin/bash" });
}

export async function startDevice(d: DeviceId) {
  const dev = DEVICES[d];
  fs.mkdirSync(STATE_DIR, { recursive: true });
  await sh(`pkill -TERM -f '${dev.match}'; true`);
  await new Promise((r) => setTimeout(r, 300));
  const lp = logPath(d);
  fs.writeFileSync(lp, "");
  const cmd =
    `ip netns exec ${dev.ns} env ` +
    `VSOMEIP_CONFIGURATION=${dev.cfg} VSOMEIP_APPLICATION_NAME=${dev.appName} ` +
    `${dev.bin} ${dev.args.join(" ")} >> ${lp} 2>&1`;
  const child = spawn("bash", ["-c", cmd], { detached: true, stdio: "ignore" });
  child.unref();
}

export async function stopDevice(d: DeviceId) {
  await sh(`pkill -TERM -f '${DEVICES[d].match}'; true`);
}
