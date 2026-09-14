import { NextRequest } from "next/server";

const JAS_BASE = "https://vhg.cmp.uea.ac.uk/tech/jas/vhg2026z/";

async function proxy(req: NextRequest, path: string[]) {
  const target = new URL(path.join("/"), JAS_BASE);
  const upstream = await fetch(target, {
    method: req.method,
    headers: {
      "Content-Type": req.headers.get("content-type") ?? "application/octet-stream",
    },
    body: req.method === "GET" || req.method === "HEAD" ? undefined : await req.arrayBuffer(),
  });

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "Content-Type":
        upstream.headers.get("content-type") ?? "application/octet-stream",
    },
  });
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path } = await context.params;
  return proxy(req, path);
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path } = await context.params;
  return proxy(req, path);
}
