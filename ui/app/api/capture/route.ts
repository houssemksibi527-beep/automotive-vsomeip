import { spawn } from "node:child_process";
import { sseHeaders } from "@/lib/rig";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SEP = "\x1f";

// Live packet capture off the switch's SPAN mirror (mon0), dissected by tshark.
// Each packet is streamed as one SSE `data:` line of JSON — this is what feeds
// the Wireshark-style table and the traffic animation.
export async function GET() {
  const args = [
    "-i", "mon0", "-l", "-n", "-Q",
    "-d", "udp.port==30509,someip",
    "-d", "udp.port==30490,someip",
    "-T", "fields", "-E", `separator=${SEP}`,
    "-e", "frame.number",
    "-e", "frame.time_relative",
    "-e", "ip.src",
    "-e", "ip.dst",
    "-e", "eth.src",
    "-e", "eth.dst",
    "-e", "_ws.col.Protocol",
    "-e", "frame.len",
    "-e", "_ws.col.Info",
  ];
  const child = spawn("tshark", args);
  const enc = new TextEncoder();
  let buf = "";

  const stream = new ReadableStream({
    start(controller) {
      const send = (obj: unknown) => {
        try { controller.enqueue(enc.encode(`data: ${JSON.stringify(obj)}\n\n`)); } catch {}
      };
      child.stdout.on("data", (d: Buffer) => {
        buf += d.toString();
        let idx: number;
        while ((idx = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, idx);
          buf = buf.slice(idx + 1);
          if (!line.trim()) continue;
          const f = line.split(SEP);
          send({
            no: Number(f[0] || 0),
            t: Number(f[1] || 0),
            src: f[2] || f[4] || "",
            dst: f[3] || f[5] || "",
            proto: f[6] || "",
            len: Number(f[7] || 0),
            info: f[8] || "",
          });
        }
      });
      let err = "";
      child.stderr.on("data", (d: Buffer) => { err += d.toString(); });
      child.on("close", () => {
        if (err.trim()) send({ error: err.trim().split("\n").slice(-1)[0] });
        try { controller.close(); } catch {}
      });
    },
    cancel() {
      child.kill("SIGTERM");
    },
  });

  return new Response(stream, { headers: sseHeaders() });
}
