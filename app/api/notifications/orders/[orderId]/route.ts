import { NextRequest, NextResponse } from "next/server";
import { authHeadersFrom, getUpstreamBaseUrl } from "@/lib/server/upstream";

export async function GET(req: NextRequest, ctx: { params: { orderId: string } }) {
  const { orderId } = ctx.params;
  const url = new URL(req.url);
  const upstream = `${getUpstreamBaseUrl()}/notifications/orders/${orderId}?${url.searchParams.toString()}`;

  try {
    const res = await fetch(upstream, {
      method: "GET",
      headers: {
        ...authHeadersFrom(req),
        accept: "application/json",
      },
      cache: "no-store",
    });

    const contentType = res.headers.get("content-type") || "application/json";
    const buf = await res.arrayBuffer();
    return new NextResponse(buf, { status: res.status, headers: { "content-type": contentType } });
  } catch (err: any) {
    console.error("[api/notifications/orders] Upstream fetch failed", {
      url: upstream,
      error: String(err?.message || err),
    });
    return new NextResponse(
      JSON.stringify({
        status: "error",
        message: "Proxy upstream fetch failed",
        error: String(err?.message || err),
      }),
      {
        status: 502,
        headers: { "content-type": "application/json" },
      }
    );
  }
}

