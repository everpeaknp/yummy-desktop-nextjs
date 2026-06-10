import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const DEFAULT_UPSTREAM =
  "https://yummy-container-app.ambitiouspebble-f5ba67fe.southeastasia.azurecontainerapps.io";

export function getUpstreamBaseUrl(): string {
  // We intentionally reuse NEXT_PUBLIC_API_URL so local dev/prod stay consistent.
  // (It is available on the server runtime too.)
  return process.env.NEXT_PUBLIC_API_URL || DEFAULT_UPSTREAM;
}

export function authHeadersFrom(req: NextRequest): Record<string, string> {
  const auth = req.headers.get("authorization");
  return auth ? { authorization: auth } : {};
}

export function upstreamFetchFailedResponse(
  route: string,
  upstream: string,
  err: unknown,
): NextResponse {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[${route}] Upstream fetch failed`, {
    url: upstream,
    error: message,
  });

  return NextResponse.json(
    {
      status: "error",
      message: "Proxy upstream fetch failed",
      error: message,
    },
    {
      status: 502,
      headers: {
        "cache-control": "no-store",
      },
    },
  );
}

