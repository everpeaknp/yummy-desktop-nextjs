import { afterEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

it("forwards attendance requests to the core backend with authorization", async () => {
  vi.stubEnv("BACKEND_API_URL", "https://api.example.test/");
  const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);

  const request = new NextRequest("https://dashboard.example.test/api/attendance-proxy/attendance/settings?view=full", {
    headers: { authorization: "Bearer test-token" },
  });
  const response = await GET(request, { params: Promise.resolve({ path: ["attendance", "settings"] }) });

  expect(response.status).toBe(200);
  expect(fetchMock).toHaveBeenCalledOnce();
  const [url, init] = fetchMock.mock.calls[0];
  expect(url.toString()).toBe("https://api.example.test/attendance/settings?view=full");
  expect(init.headers.get("authorization")).toBe("Bearer test-token");
});
