import { NextResponse } from "next/server";
import { startDevice, stopDevice, getStatus, DEVICES, type DeviceId } from "@/lib/rig";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let device = "";
  let action = "";
  try {
    ({ device, action } = await req.json());
  } catch {
    return NextResponse.json({ error: "bad body" }, { status: 400 });
  }
  if (!(device in DEVICES)) return NextResponse.json({ error: "bad device" }, { status: 400 });
  try {
    if (action === "start") await startDevice(device as DeviceId);
    else if (action === "stop") await stopDevice(device as DeviceId);
    else return NextResponse.json({ error: "bad action" }, { status: 400 });
    await new Promise((r) => setTimeout(r, 250));
    return NextResponse.json(await getStatus());
  } catch (e: unknown) {
    return NextResponse.json({ error: String((e as Error)?.message ?? e) }, { status: 500 });
  }
}
