import { describe, expect, it } from "vitest";

import { supportHref, youtubeVideoId } from "@/lib/help-center";

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
});
