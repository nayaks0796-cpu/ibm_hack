import { NextRequest } from "next/server";

const JAS_BASE = "https://vhg.cmp.uea.ac.uk/tech/jas/vhg2026z/";

async function proxy(req: NextRequest, path: string[]) {
  const target = new URL(path.join("/"), JAS_BASE);
  const headers = new Headers();
  const contentType = req.headers.get("content-type");
  if (contentType && req.method !== "GET" && req.method !== "HEAD") {
    headers.set("Content-Type", contentType);
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: req.method,
      headers,
      body: req.method === "GET" || req.method === "HEAD" ? undefined : await req.arrayBuffer(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "upstream unreachable";
    return new Response(`JASigning proxy error: ${message}`, { status: 502 });
  }

  const out = new Headers();
  out.set(
    "Content-Type",
    upstream.headers.get("content-type") ?? "application/octet-stream"
  );
  out.set("Cache-Control", "public, max-age=86400");

  return new Response(upstream.body, {
    status: upstream.status,
    headers: out,
  });
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path } = await context.params;
  return proxy(req, path);
}

export async function HEAD(
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
