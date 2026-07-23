"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Status, DeviceId, Packet, IVI_IP, HPC_IP, SD_MCAST } from "./types";
import CaptureModal from "./CaptureModal";
import { LidarArt, SteeringArt, SwitchArt } from "./art";

type Dot = { id: number; x0: number; x1: number; color: string };

const X = { ivi: 17, sw: 50, hpc: 83 } as const;
const WIRE_Y = 40;

async function postJSON(url: string, body: unknown): Promise<Status | null> {
  try {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return (await r.json()) as Status;
  } catch {
    return null;
  }
}

export default function Console() {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [logs, setLogs] = useState<Record<DeviceId, string[]>>({ ivi: [], hpc: [] });
  const [selected, setSelected] = useState<DeviceId | null>(null);
  const [hovered, setHovered] = useState<DeviceId | "switch" | null>(null);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [packets, setPackets] = useState<Packet[]>([]);
  const [dots, setDots] = useState<Dot[]>([]);

  const dotSeq = useRef(0);
  const capES = useRef<EventSource | null>(null);
  const logES = useRef<Partial<Record<DeviceId, EventSource>>>({});

  // ---- status polling -------------------------------------------------------
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const r = await fetch("/api/status", { cache: "no-store" });
        const s = (await r.json()) as Status;
        if (alive) setStatus(s);
      } catch {
        /* server not ready */
      }
    };
    tick();
    const id = setInterval(tick, 1500);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  // ---- traffic animation from a packet -------------------------------------
  const animate = useCallback((p: Packet) => {
    const color = p.proto.includes("SOME/IP-SD")
      ? "var(--yellow)"
      : p.proto.includes("SOME/IP")
      ? "var(--blue)"
      : p.proto.includes("ARP")
      ? "var(--orange)"
      : "var(--neutral-300)";
    const add: Dot[] = [];
    const mk = (x0: number, x1: number) => add.push({ id: ++dotSeq.current, x0, x1, color });
    if (p.src === IVI_IP) mk(X.ivi, X.sw);
    if (p.src === HPC_IP) mk(X.hpc, X.sw);
    if (p.dst === IVI_IP) mk(X.sw, X.ivi);
    if (p.dst === HPC_IP) mk(X.sw, X.hpc);
    if (p.dst === SD_MCAST) {
      if (p.src === IVI_IP) mk(X.sw, X.hpc);
      if (p.src === HPC_IP) mk(X.sw, X.ivi);
    }
    if (add.length) setDots((d) => [...d, ...add].slice(-48));
  }, []);

  // ---- capture stream (only while the switch is up) ------------------------
  useEffect(() => {
    const up = status?.switch;
    if (up && !capES.current) {
      const es = new EventSource("/api/capture");
      es.onmessage = (ev) => {
        let p: Packet;
        try {
          p = JSON.parse(ev.data);
        } catch {
          return;
        }
        if (p.error) return;
        setPackets((prev) => (prev.length > 1200 ? [...prev.slice(-900), p] : [...prev, p]));
        animate(p);
      };
      es.onerror = () => {};
      capES.current = es;
    }
    if (!up && capES.current) {
      capES.current.close();
      capES.current = null;
      setPackets([]);
      setDots([]);
    }
  }, [status?.switch, animate]);

  // ---- per-device log streams (open while running) -------------------------
  useEffect(() => {
    (["ivi", "hpc"] as DeviceId[]).forEach((d) => {
      const running = status?.[d];
      if (running && !logES.current[d]) {
        const es = new EventSource(`/api/logs?device=${d}`);
        es.onmessage = (ev) => {
          let line = "";
          try {
            line = JSON.parse(ev.data);
          } catch {
            return;
          }
          setLogs((prev) => ({ ...prev, [d]: [...prev[d], line].slice(-250) }));
        };
        es.onerror = () => {};
        logES.current[d] = es;
      }
      if (!running && logES.current[d]) {
        logES.current[d]!.close();
        delete logES.current[d];
      }
    });
  }, [status?.ivi, status?.hpc]);

  // ---- controls -------------------------------------------------------------
  const applyStatus = (s: Status | null) => {
    if (s) setStatus(s);
  };
  const toggleSwitch = async () => {
    if (!status) return;
    setBusy((b) => ({ ...b, switch: true }));
    applyStatus(await postJSON("/api/switch", { action: status.switch ? "down" : "up" }));
    setBusy((b) => ({ ...b, switch: false }));
  };
  const toggleDevice = async (d: DeviceId) => {
    if (!status) return;
    setBusy((b) => ({ ...b, [d]: true }));
    applyStatus(await postJSON("/api/device", { device: d, action: status[d] ? "stop" : "start" }));
    if (status[d]) setLogs((prev) => ({ ...prev, [d]: [] }));
    setBusy((b) => ({ ...b, [d]: false }));
  };

  const s = status ?? { switch: false, ivi: false, hpc: false };
  const wireActive = (d: DeviceId) => s.switch && s[d];

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-[1180px] px-5 py-8 md:py-12">
        <Header status={status} onOpenCapture={() => s.switch && setCaptureOpen(true)} />

        {/* Topology */}
        <div className="card mt-8 p-4 md:p-8 animate-fade-up">
          <div className="relative w-full" style={{ aspectRatio: "1000 / 500" }}>
            {/* wires + nodes */}
            <svg viewBox="0 0 1000 500" className="absolute inset-0 h-full w-full" aria-hidden>
              <Wire x1={170} x2={500} active={wireActive("ivi")} />
              <Wire x1={500} x2={830} active={wireActive("hpc")} />
              <g transform="translate(170,200)">
                <LidarArt active={s.ivi} />
              </g>
              <g
                transform="translate(500,200)"
                style={{ cursor: s.switch ? "pointer" : "default" }}
                onClick={() => s.switch && setCaptureOpen(true)}
              >
                <SwitchArt active={s.switch} />
              </g>
              <g transform="translate(830,200)">
                <SteeringArt active={s.hpc} />
              </g>
            </svg>

            {/* HTML overlay: hit-areas, dots, buttons, popovers */}
            <div className="absolute inset-0">
              {/* hover hit-areas over each node */}
              {(["ivi", "switch", "hpc"] as const).map((k) => (
                <div
                  key={k}
                  className="absolute -translate-x-1/2 -translate-y-1/2"
                  style={{ left: `${X[k === "switch" ? "sw" : k]}%`, top: `${WIRE_Y}%`, width: "18%", height: "44%" }}
                  onMouseEnter={() => setHovered(k)}
                  onMouseLeave={() => setHovered((h) => (h === k ? null : h))}
                  onClick={() => {
                    if (k === "switch") s.switch && setCaptureOpen(true);
                    else setSelected(k as DeviceId);
                  }}
                />
              ))}

              {/* flying packets */}
              {dots.map((d) => (
                <span
                  key={d.id}
                  className="packet"
                  style={
                    {
                      top: `${WIRE_Y}%`,
                      left: `${d.x0}%`,
                      background: d.color,
                      ["--x0" as string]: `${d.x0}%`,
                      ["--x1" as string]: `${d.x1}%`,
                      ["--dur" as string]: "0.85s",
                    } as React.CSSProperties
                  }
                  onAnimationEnd={() => setDots((arr) => arr.filter((x) => x.id !== d.id))}
                />
              ))}

              {/* popover: live actions on hover */}
              {hovered && hovered !== "switch" && (
                <Popover x={X[hovered]} title={hovered === "ivi" ? "IVI" : "HPC"} lines={logs[hovered].slice(-4)} running={s[hovered]} />
              )}
              {hovered === "switch" && <SwitchPopover x={X.sw} up={s.switch} count={packets.length} />}

              {/* control buttons under each node */}
              <NodeControls
                x={X.ivi}
                label="IVI"
                ip={IVI_IP}
                on={s.ivi}
                disabled={!s.switch}
                busy={!!busy.ivi}
                onToggle={() => toggleDevice("ivi")}
                onInspect={() => setSelected("ivi")}
              />
              <NodeControls
                x={X.sw}
                label="Switch (OVS)"
                ip="VLAN 10"
                on={s.switch}
                busy={!!busy.switch}
                onToggle={toggleSwitch}
                onInspect={() => s.switch && setCaptureOpen(true)}
                inspectLabel="Open capture"
                isSwitch
              />
              <NodeControls
                x={X.hpc}
                label="HPC"
                ip={HPC_IP}
                on={s.hpc}
                disabled={!s.switch}
                busy={!!busy.hpc}
                onToggle={() => toggleDevice("hpc")}
                onInspect={() => setSelected("hpc")}
              />
            </div>
          </div>

          <Legend />
        </div>

        {/* Selected device actions panel */}
        {selected && (
          <ActionsPanel device={selected} running={s[selected]} lines={logs[selected]} onClose={() => setSelected(null)} />
        )}

        <p className="mt-6 text-center text-sm font-semibold text-ink-soft">
          {!s.switch
            ? "Power on the switch first — the two ECUs can only reach each other through it."
            : "Click the switch to open the live capture. Hover a device to watch its actions."}
        </p>
      </div>

      {captureOpen && (
        <CaptureModal packets={packets} onClose={() => setCaptureOpen(false)} onClear={() => setPackets([])} />
      )}
    </main>
  );
}

/* ------------------------------------------------------------------ pieces */

function Header({ status, onOpenCapture }: { status: Status | null; onOpenCapture: () => void }) {
  const s = status ?? { switch: false, ivi: false, hpc: false };
  return (
    <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <div className="pill" style={{ background: "var(--ink)", color: "#fff" }}>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: status ? "var(--green)" : "var(--neutral-300)" }} />
          {status ? "console online" : "connecting…"}
        </div>
        <h1 className="display mt-3 text-4xl md:text-6xl">
          In-car <span style={{ color: "var(--blue)" }}>SOME/IP</span> rig
        </h1>
        <p className="mt-2 max-w-xl font-semibold text-ink-soft">
          IVI and HPC, two ECUs on one VLAN, talking only through the switch. Drive it all from here.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <StatePill label="Switch" on={s.switch} />
        <StatePill label="IVI" on={s.ivi} />
        <StatePill label="HPC" on={s.hpc} />
      </div>
    </header>
  );
}

function StatePill({ label, on }: { label: string; on: boolean }) {
  return (
    <span className="pill" style={{ background: on ? "var(--green)" : "var(--neutral-100)", color: on ? "#fff" : "var(--ink-soft)" }}>
      <span style={{ width: 8, height: 8, borderRadius: 999, background: on ? "#fff" : "var(--neutral-300)" }} />
      {label} {on ? "on" : "off"}
    </span>
  );
}

function Wire({ x1, x2, active }: { x1: number; x2: number; active: boolean }) {
  return (
    <g>
      <line x1={x1} y1={200} x2={x2} y2={200} stroke="#DDE3EC" strokeWidth={10} strokeLinecap="round" />
      <line
        x1={x1}
        y1={200}
        x2={x2}
        y2={200}
        stroke={active ? "var(--green)" : "#EEF1F6"}
        strokeWidth={4}
        strokeLinecap="round"
        strokeDasharray="2 14"
        opacity={active ? 0.9 : 0.5}
      />
    </g>
  );
}

function NodeControls({
  x,
  label,
  ip,
  on,
  disabled,
  busy,
  onToggle,
  onInspect,
  inspectLabel = "Inspect",
  isSwitch,
}: {
  x: number;
  label: string;
  ip: string;
  on: boolean;
  disabled?: boolean;
  busy?: boolean;
  onToggle: () => void;
  onInspect: () => void;
  inspectLabel?: string;
  isSwitch?: boolean;
}) {
  return (
    <div className="absolute flex -translate-x-1/2 flex-col items-center gap-2" style={{ left: `${x}%`, top: "70%", width: "26%" }}>
      <div className="text-center">
        <div className="font-extrabold leading-tight">{label}</div>
        <div className="font-mono text-xs text-ink-soft">{ip}</div>
      </div>
      <button
        className={`btn btn-sm ${on ? "btn-danger" : isSwitch ? "btn-blue" : "btn-green"}`}
        disabled={busy || disabled}
        onClick={onToggle}
        title={disabled ? "Power on the switch first" : ""}
      >
        {busy ? "…" : on ? "Power off" : isSwitch ? "Power on" : "Start"}
      </button>
      <button className="btn btn-sm btn-ghost" disabled={disabled} onClick={onInspect}>
        {isSwitch ? inspectLabel : "Actions"}
      </button>
    </div>
  );
}

function Popover({ x, title, lines, running }: { x: number; title: string; lines: string[]; running: boolean }) {
  return (
    <div
      className="card pointer-events-none absolute z-20 -translate-x-1/2 p-3 text-left"
      style={{ left: `${x}%`, top: "2%", width: 300, borderRadius: 16 }}
    >
      <div className="mb-1 flex items-center justify-between">
        <span className="font-extrabold">{title}</span>
        <span className="pill" style={{ background: running ? "var(--green)" : "var(--neutral-100)", color: running ? "#fff" : "var(--ink-soft)" }}>
          {running ? "live" : "idle"}
        </span>
      </div>
      <div className="wshark space-y-0.5 text-[11px] leading-snug text-ink-soft">
        {lines.length ? lines.map((l, i) => <div key={i} className="truncate">{l}</div>) : <div>no actions yet</div>}
      </div>
    </div>
  );
}

function SwitchPopover({ x, up, count }: { x: number; up: boolean; count: number }) {
  return (
    <div className="card pointer-events-none absolute z-20 -translate-x-1/2 p-3" style={{ left: `${x}%`, top: "2%", width: 260, borderRadius: 16 }}>
      <div className="font-extrabold">Open vSwitch · br0</div>
      <div className="mt-1 text-[12px] font-semibold text-ink-soft">
        {up ? (
          <>
            VLAN 10 · SPAN mirror on <span className="font-mono">mon0</span>
            <br />
            {count} packets captured · click to open
          </>
        ) : (
          "powered off"
        )}
      </div>
    </div>
  );
}

function Legend() {
  const items = [
    ["SOME/IP-SD", "var(--yellow)", "Service Discovery — Offer / Subscribe / Ack (the ECUs finding each other)"],
    ["SOME/IP event", "var(--blue)", "IVI / HPC communication notifications — the actual payload"],
    ["ARP", "var(--orange)", "MAC-address lookups (who-has)"],
    ["other", "var(--neutral-300)", "IGMP joins, plain UDP, anything else"],
  ] as const;
  return (
    <div className="mt-6">
      <div className="mb-2 text-center text-[11px] font-extrabold uppercase tracking-wide text-ink-soft">
        Traffic legend — a dot's colour is its protocol
      </div>
      <div className="flex flex-wrap items-stretch justify-center gap-2">
        {items.map(([label, c, desc]) => (
          <div key={label} className="flex max-w-[260px] items-center gap-2.5 rounded-2xl border border-neutral-200 bg-white px-3 py-2">
            <span style={{ width: 14, height: 14, borderRadius: 999, background: c, flexShrink: 0, boxShadow: "0 0 0 3px rgba(255,255,255,0.9), 0 1px 4px rgba(14,31,58,0.25)" }} />
            <span className="text-left">
              <span className="block text-xs font-extrabold leading-tight">{label}</span>
              <span className="block text-[11px] font-semibold leading-snug text-ink-soft">{desc}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ActionsPanel({ device, running, lines, onClose }: { device: DeviceId; running: boolean; lines: string[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight });
  }, [lines]);
  return (
    <div className="card mt-6 p-5 animate-fade-up">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-extrabold">{device === "ivi" ? "IVI" : "HPC"} — actions</h2>
          <span className="pill" style={{ background: running ? "var(--green)" : "var(--neutral-100)", color: running ? "#fff" : "var(--ink-soft)" }}>
            {running ? "live" : "idle"}
          </span>
        </div>
        <button className="btn btn-sm btn-ghost" onClick={onClose}>
          Close
        </button>
      </div>
      <div ref={ref} className="scroll-thin wshark max-h-64 overflow-auto rounded-2xl bg-neutral-50 p-3 text-[12px] leading-relaxed">
        {lines.length ? (
          lines.map((l, i) => (
            <div key={i} className={l.includes("REACT") ? "text-ink" : "text-ink-soft"}>
              {l}
            </div>
          ))
        ) : (
          <div className="text-ink-soft">No actions yet{running ? "…" : " — start the device."}</div>
        )}
      </div>
    </div>
  );
}
