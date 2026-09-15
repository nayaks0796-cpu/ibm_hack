// HTTP fallback for clerk ↔ user sync when the WebSocket custom server is not running.
import { NextRequest, NextResponse } from "next/server";
import {
  dropPresence,
  publish,
  pull,
  snapshotPeers,
} from "@/lib/transport/roomHub";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const room = req.nextUrl.searchParams.get("room") || "demo-room";
  const role = req.nextUrl.searchParams.get("role") || "unknown";
  const after = Number(req.nextUrl.searchParams.get("after") || "0");

  const payload = await pull(room, role, Number.isFinite(after) ? after : 0, req.signal);
  return NextResponse.json(payload);
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    room?: string;
    role?: string;
    data?: unknown;
    bye?: boolean;
  };
  const room = body.room || "demo-room";
  const role = body.role || "unknown";

  if (!body.data || typeof body.data !== "object") {
    if (body.bye) {
      dropPresence(room, role);
      return NextResponse.json({ ok: true, peers: snapshotPeers(room) });
    }
    return NextResponse.json({ error: "missing data" }, { status: 400 });
  }

  publish(room, role, body.data);
  if (body.bye || (body.data as { type?: string }).type === "bye") {
    dropPresence(room, role);
  }
  return NextResponse.json({ ok: true, peers: snapshotPeers(room) });
}
