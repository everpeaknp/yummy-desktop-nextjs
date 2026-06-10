import { NextRequest, NextResponse } from "next/server";
import { authHeadersFrom, getUpstreamBaseUrl, upstreamFetchFailedResponse } from "@/lib/server/upstream";

export async function GET(req: NextRequest, ctx: { params: { kotId: string } }) {
  const { kotId } = ctx.params;
  const url = new URL(req.url);
  const upstream = `${getUpstreamBaseUrl()}/notifications/kots/${kotId}?${url.searchParams.toString()}`;

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
    return upstreamFetchFailedResponse("api/notifications/kots", upstream, err);
  }

  const contentType = res.headers.get("content-type") || "application/json";
  const buf = await res.arrayBuffer();
  return new NextResponse(buf, { status: res.status, headers: { "content-type": contentType } });
}

