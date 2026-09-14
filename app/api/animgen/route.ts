import { NextRequest } from "next/server";

// Optional Animgen CGI proxy (Server mode). Prefer client-side Animgen in
// vhg2026z allcsa.js — UEA's animgenserver.pl has been returning 500.
// Kept so we can flip CWASA to animgenServer: "/api/animgen" if needed.
const UPSTREAM =
  "https://vhg.cmp.uea.ac.uk/cgi-bin/animgen/sigmlserver.pl";

export async function POST(req: NextRequest) {
  const avatar = req.nextUrl.searchParams.get("avatar") ?? "anna";
  const contentType = req.headers.get("content-type") ?? "application/octet-stream";
  const body = await req.arrayBuffer();

  const params = new URLSearchParams({ avatar });
  // HamNoSys SiGML needs H→G conversion on the server path.
  if (req.nextUrl.searchParams.get("htog") !== "false") {
    params.set("htog", "true");
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${UPSTREAM}?${params}`, {
      method: "POST",
      headers: { "Content-Type": contentType },
      body,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "upstream unreachable";
    return new Response(`Animgen proxy error: ${message}`, { status: 502 });
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "text/plain",
      "Cache-Control": "no-store",
    },
  });
}
