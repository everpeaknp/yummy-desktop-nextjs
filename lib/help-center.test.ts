import { beforeEach, describe, expect, it, vi } from "vitest";

const { get } = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("@/lib/api-client", () => ({ default: { get } }));

import { fetchDashboardTutorialVideos, supportHref, youtubeVideoId } from "@/lib/help-center";

beforeEach(() => vi.clearAllMocks());

describe("help center links", () => {
  it("extracts supported YouTube video ids", () => {
    expect(youtubeVideoId("https://youtu.be/abc123")).toBe("abc123");
    expect(youtubeVideoId("https://www.youtube.com/watch?v=xyz789")).toBe("xyz789");
    expect(youtubeVideoId("https://www.youtube.com/embed/embed123")).toBe("embed123");
  });

  it("normalizes WhatsApp numbers and pre-fills a support message", () => {
    expect(supportHref("whatsapp", "+977 980-000-0000")).toContain(
      "https://wa.me/9779800000000?text=",
    );
  });

  it("loads published dashboard videos from the same collection used by Admin", async () => {
    const videos = [{ id: 42, title: "Yummy tutorial", youtube_url: "https://youtu.be/demo", is_main: true }];
    get.mockResolvedValueOnce({ data: { data: { items: videos } } });

    await expect(fetchDashboardTutorialVideos()).resolves.toEqual(videos);
    expect(get).toHaveBeenCalledWith("/tutorial-videos");
  });

  it("falls back to the Help Center aggregate when the tutorial collection is empty", async () => {
    const videos = [{ id: 7, title: "Help video", youtube_url: "https://youtu.be/help", is_main: true }];
    get
      .mockResolvedValueOnce({ data: { data: { items: [] } } })
      .mockResolvedValueOnce({ data: { data: { settings: {}, guides: [], videos } } });

    await expect(fetchDashboardTutorialVideos()).resolves.toEqual(videos);
    expect(get).toHaveBeenNthCalledWith(2, "/help-center");
  });
});
