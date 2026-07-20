import { spawn } from "node:child_process";
import { logPath, DEVICES, sseHeaders, type DeviceId } from "@/lib/rig";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// SSE stream of a device's console output (the "actions being done").
export async function GET(req: Request) {
  const device = new URL(req.url).searchParams.get("device") ?? "";
  if (!(device in DEVICES)) return new Response("bad device", { status: 400 });

  const lp = logPath(device as DeviceId);
  const child = spawn("bash", ["-c", `touch ${lp}; tail -n 80 -F ${lp}`]);
  const enc = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const onData = (buf: Buffer) => {
        for (const line of buf.toString().split("\n")) {
          if (line.trim()) controller.enqueue(enc.encode(`data: ${JSON.stringify(line)}\n\n`));
        }
      };
      child.stdout.on("data", onData);
      child.on("close", () => {
        try { controller.close(); } catch {}
      });
    },
    cancel() {
      child.kill("SIGTERM");
    },
  });

  return new Response(stream, { headers: sseHeaders() });
}
