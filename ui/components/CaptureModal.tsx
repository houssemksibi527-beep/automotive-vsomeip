"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Packet, IVI_IP, HPC_IP } from "./types";

function rowClass(proto: string) {
  if (proto.includes("SOME/IP-SD")) return "row-sd";
  if (proto.includes("SOME/IP")) return "row-someip";
  return "";
}

function nameFor(ip: string) {
  if (ip === IVI_IP) return "IVI";
  if (ip === HPC_IP) return "HPC";
  if (ip.startsWith("224.")) return "multicast";
  return "";
}

export default function CaptureModal({
  packets,
  onClose,
  onClear,
}: {
  packets: Packet[];
  onClose: () => void;
  onClear: () => void;
}) {
  const [filter, setFilter] = useState("");
  const [follow, setFollow] = useState(true);
  const [sel, setSel] = useState<number | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);

  const rows = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return packets;
    return packets.filter((p) =>
      `${p.no} ${p.src} ${p.dst} ${p.proto} ${p.len} ${p.info}`.toLowerCase().includes(q)
    );
  }, [packets, filter]);

  useEffect(() => {
    if (follow && bodyRef.current) bodyRef.current.scrollTo({ top: bodyRef.current.scrollHeight });
  }, [rows.length, follow]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const selected = sel != null ? packets.find((p) => p.no === sel) ?? null : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-3 md:p-6" onClick={onClose}>
      <div
        className="card flex h-full max-h-[90vh] w-full max-w-[1120px] flex-col overflow-hidden"
        style={{ borderRadius: 24 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="flex flex-wrap items-center gap-3 border-b border-neutral-200 p-4">
          <div className="flex items-center gap-2">
            <span className="pill" style={{ background: "var(--blue)", color: "#fff" }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: "#fff" }} className="animate-pulse" />
              capturing
            </span>
            <h2 className="text-lg font-extrabold">
              Switch mirror — <span className="font-mono text-base">mon0</span>
            </h2>
          </div>
          <span className="text-sm font-bold text-ink-soft">
            {rows.length}/{packets.length} pkts
          </span>
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="filter: someip, 192.168.10.11, subscribe…"
            className="wshark ml-auto w-64 rounded-full border border-neutral-200 bg-neutral-50 px-4 py-2 text-[12px] outline-none focus:border-blue"
          />
          <label className="flex cursor-pointer items-center gap-2 text-sm font-bold text-ink-soft">
            <input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} />
            follow
          </label>
          <button className="btn btn-sm btn-ghost" onClick={onClear}>
            Clear
          </button>
          <button className="btn btn-sm btn-danger" onClick={onClose}>
            Close
          </button>
        </div>

        {/* table */}
        <div ref={bodyRef} className="scroll-thin wshark flex-1 overflow-auto text-[12px]">
          <table className="w-full border-collapse text-left">
            <thead className="sticky top-0 z-10 bg-white text-[11px] uppercase tracking-wide text-ink-soft shadow-[0_1px_0_#DDE3EC]">
              <tr>
                <th className="w-16">No.</th>
                <th className="w-24">Time</th>
                <th>Source</th>
                <th>Destination</th>
                <th className="w-32">Protocol</th>
                <th className="w-16">Len</th>
                <th>Info</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-ink-soft">
                    Waiting for packets… start IVI and HPC to see SOME/IP traffic cross the switch.
                  </td>
                </tr>
              )}
              {rows.map((p) => (
                <tr
                  key={p.no}
                  className={`${rowClass(p.proto)} ${selected?.no === p.no ? "row-selected" : ""} cursor-pointer`}
                  onClick={() => setSel(p.no)}
                >
                  <td className="text-ink-soft">{p.no}</td>
                  <td className="text-ink-soft">{p.t.toFixed(3)}</td>
                  <td>
                    <Endpoint ip={p.src} />
                  </td>
                  <td>
                    <Endpoint ip={p.dst} />
                  </td>
                  <td className="font-bold">{p.proto}</td>
                  <td className="text-ink-soft">{p.len}</td>
                  <td className="max-w-[420px] truncate">{p.info}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* detail */}
        {selected && (
          <div className="border-t border-neutral-200 bg-neutral-50 p-4">
            <div className="mb-1 flex items-center justify-between">
              <span className="font-extrabold">Frame {selected.no}</span>
              <button className="text-sm font-bold text-ink-soft hover:text-ink" onClick={() => setSel(null)}>
                dismiss
              </button>
            </div>
            <div className="wshark grid grid-cols-2 gap-x-8 gap-y-1 text-[12px] md:grid-cols-3">
              <Field k="Time (rel)" v={`${selected.t.toFixed(6)} s`} />
              <Field k="Protocol" v={selected.proto} />
              <Field k="Length" v={`${selected.len} bytes`} />
              <Field k="Source" v={`${selected.src}${nameFor(selected.src) ? ` (${nameFor(selected.src)})` : ""}`} />
              <Field k="Destination" v={`${selected.dst}${nameFor(selected.dst) ? ` (${nameFor(selected.dst)})` : ""}`} />
              <Field k="Info" v={selected.info} full />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Endpoint({ ip }: { ip: string }) {
  const name = nameFor(ip);
  return (
    <span>
      <span className={ip === IVI_IP ? "text-green-deep" : ip === HPC_IP ? "text-blue" : "text-ink-soft"}>{ip || "—"}</span>
      {name && <span className="ml-1 text-[10px] font-bold text-ink-soft">{name}</span>}
    </span>
  );
}

function Field({ k, v, full }: { k: string; v: string; full?: boolean }) {
  return (
    <div className={full ? "col-span-2 md:col-span-3" : ""}>
      <span className="font-bold text-ink-soft">{k}: </span>
      <span className="break-all">{v}</span>
    </div>
  );
}
