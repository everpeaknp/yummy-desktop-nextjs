import { NextRequest } from "next/server";

function getBackendBaseUrl() {
  const explicit = process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_API_URL;
  if (explicit) return explicit;
  if (process.env.NODE_ENV !== "production") {
    return "http://127.0.0.1:8001";
  }
  return "https://yummy-container-app.ambitiouspebble-f5ba67fe.southeastasia.azurecontainerapps.io";
}

function filterRequestHeaders(req: NextRequest): HeadersInit {
  const headers = new Headers();
  // Forward only what we need. Most importantly: Authorization.
  const allow = new Set([
    "authorization",
    "content-type",
    "accept",
    "accept-language",
    "x-requested-with",
  ]);
  req.headers.forEach((value, key) => {
    if (allow.has(key.toLowerCase())) headers.set(key, value);
  });
  return headers;
}

function filterResponseHeaders(upstream: Response): Headers {
  const headers = new Headers();
  const allow = new Set([
    "content-type",
    "content-disposition",
    "cache-control",
    "pragma",
    "expires",
  ]);
  upstream.headers.forEach((value, key) => {
    if (allow.has(key.toLowerCase())) headers.set(key, value);
  });
  return headers;
}

async function handler(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const backend = getBackendBaseUrl().replace(/\/+$/, "");
  const joined = path.join("/");
  // Backend has some collection endpoints defined with trailing slash (e.g. `/roles/`, `/orders/`).
  // Posting to the slashless variant can trigger redirects that break body replay in some runtimes.
  const normalizedPath =
    joined === "roles"
      ? "roles/"
      : joined === "orders"
        ? "orders/"
        : joined;
  const url = new URL(`${backend}/${normalizedPath}`);
  req.nextUrl.searchParams.forEach((v, k) => url.searchParams.append(k, v));

  const method = req.method.toUpperCase();
  const headers = filterRequestHeaders(req);

  // Only attach a body for methods that support it.
  const body =
    method === "GET" || method === "HEAD" ? undefined : await req.arrayBuffer();

  try {
    const upstream = await fetch(url.toString(), {
      method,
      headers,
      body,
      // Important: don't cache API responses on the Next server.
      cache: "no-store",
    });

    const resHeaders = filterResponseHeaders(upstream);
    const resBody = await upstream.arrayBuffer();
    // Helpful for debugging in devtools: see what the backend actually responded with.
    resHeaders.set("x-upstream-status", String(upstream.status));
    return new Response(resBody, { status: upstream.status, headers: resHeaders });
  } catch (err: any) {
    console.error("[api/proxy] Upstream fetch failed", {
      method,
      url: url.toString(),
      error: String(err?.message || err),
    });
    return new Response(
      JSON.stringify({
        status: "error",
        message: "Proxy upstream fetch failed",
        url: url.toString(),
        error: String(err?.message || err),
      }),
      {
        status: 502,
        headers: {
          "content-type": "application/json",
          "cache-control": "no-store",
        },
      }
    );
  }
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
