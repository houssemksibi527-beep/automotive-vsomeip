import { NextResponse } from "next/server";
import { switchUp, switchDown, getStatus } from "@/lib/rig";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let action = "";
  try {
    ({ action } = await req.json());
  } catch {
    return NextResponse.json({ error: "bad body" }, { status: 400 });
  }
  try {
    if (action === "up") await switchUp();
    else if (action === "down") await switchDown();
    else return NextResponse.json({ error: "bad action" }, { status: 400 });
    return NextResponse.json(await getStatus());
  } catch (e: unknown) {
    return NextResponse.json({ error: String((e as Error)?.message ?? e) }, { status: 500 });
  }
}
