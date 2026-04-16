import { NextRequest, NextResponse } from "next/server";
import { authHeadersFrom, getUpstreamBaseUrl } from "@/lib/server/upstream";

export async function PATCH(req: NextRequest) {
  const url = new URL(req.url);
  const upstream = `${getUpstreamBaseUrl()}/notifications/read${url.search ? `?${url.searchParams.toString()}` : ""}`;

  const body = await req.text();

  const res = await fetch(upstream, {
    method: "PATCH",
    headers: {
      ...authHeadersFrom(req),
      "content-type": req.headers.get("content-type") || "application/json",
      accept: "application/json",
    },
    body,
    cache: "no-store",
  });

  const contentType = res.headers.get("content-type") || "application/json";
  const buf = await res.arrayBuffer();
  return new NextResponse(buf, { status: res.status, headers: { "content-type": contentType } });
}

