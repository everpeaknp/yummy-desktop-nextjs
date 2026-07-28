import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "content-length",
]);

function getAttendanceBaseUrl() {
  const configured = process.env.ATTENDANCE_API_URL;
  if (configured) return configured.replace(/\/+$/, "");
  if (process.env.NODE_ENV === "production") {
    throw new Error("ATTENDANCE_API_URL is required in production");
  }
  return "http://127.0.0.1:8002";
}

async function handler(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  const method = request.method.toUpperCase();
  try {
    const upstreamUrl = new URL(
      `${getAttendanceBaseUrl()}/${path.map(encodeURIComponent).join("/")}`,
    );
    upstreamUrl.search = request.nextUrl.search;

    const headers = new Headers(request.headers);
    headers.delete("host");
    headers.delete("origin");
    headers.delete("referer");
    headers.set("accept-encoding", "identity");
    HOP_BY_HOP_HEADERS.forEach((name) => headers.delete(name));

    const init: RequestInit = { method, headers, cache: "no-store" };
    if (method !== "GET" && method !== "HEAD") {
      const body = await request.arrayBuffer();
      if (body.byteLength > 0) init.body = body;
    }

    const upstream = await fetch(upstreamUrl, init);
    const responseHeaders = new Headers(upstream.headers);
    responseHeaders.delete("content-encoding");
    HOP_BY_HOP_HEADERS.forEach((name) => responseHeaders.delete(name));
    responseHeaders.set("x-attendance-upstream", getAttendanceBaseUrl());

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("[attendance-proxy] Upstream request failed", {
      method,
      error,
    });
    return Response.json(
      {
        status: "error",
        message: "Attendance service request failed",
        errors: [],
      },
      { status: 502 },
    );
  }
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
