import { NextRequest, NextResponse } from "next/server";
import { authHeadersFrom, getUpstreamBaseUrl, upstreamFetchFailedResponse } from "@/lib/server/upstream";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const upstream = `${getUpstreamBaseUrl()}/notifications?${url.searchParams.toString()}`;

  let res: Response;
  try {
    res = await fetch(upstream, {
      method: "GET",
      headers: {
        ...authHeadersFrom(req),
        accept: "application/json",
      },
      cache: "no-store",
    });
  } catch (err) {
    return upstreamFetchFailedResponse("api/notifications", upstream, err);
  }

  const contentType = res.headers.get("content-type") || "application/json";
  const buf = await res.arrayBuffer();
  return new NextResponse(buf, { status: res.status, headers: { "content-type": contentType } });
}

