import { NextRequest, NextResponse } from "next/server";
import { authHeadersFrom, getUpstreamBaseUrl } from "@/lib/server/upstream";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ inventoryItemId: string }> },
) {
  const { inventoryItemId } = await ctx.params;
  const url = new URL(req.url);
  const upstream = `${getUpstreamBaseUrl()}/notifications/inventory/${inventoryItemId}?${url.searchParams.toString()}`;

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
}

