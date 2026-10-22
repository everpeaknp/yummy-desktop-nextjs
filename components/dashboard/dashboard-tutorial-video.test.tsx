import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { fetchDashboardTutorialVideos } = vi.hoisted(() => ({ fetchDashboardTutorialVideos: vi.fn() }));

vi.mock("@/lib/help-center", () => ({
  fetchDashboardTutorialVideos,
  youtubeVideoId: (url: string) => {
    try {
      const parsed = new URL(url);
      if (parsed.hostname === "youtu.be") return parsed.pathname.split("/").filter(Boolean)[0] ?? null;
      if (parsed.hostname.includes("youtube.com")) return parsed.searchParams.get("v") ?? null;
    } catch {
      return null;
    }
    return null;
  },
}));

import { DashboardTutorialVideo } from "./dashboard-tutorial-video";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("dashboard tutorial video", () => {
  it("uses the published main tutorial URL and thumbnail from the admin video collection", async () => {
    fetchDashboardTutorialVideos.mockResolvedValue([
      {
        id: 2,
        title: "Other tutorial",
        youtube_url: "https://youtu.be/other-video-456",
        category: "Getting started",
        is_main: false,
      },
      {
        id: 3,
        title: "Yummy tutorial",
        youtube_url: "https://www.youtube.com/watch?v=admin-video-123",
        thumbnail_url: "https://cdn.example.com/yummy-tutorial.jpg",
        category: "Getting started",
        is_main: true,
      },
    ]);

    render(<DashboardTutorialVideo />);

    const playButton = await screen.findByRole("button", { name: "Play Yummy tutorial" });
    expect(playButton.querySelector("img")).toHaveAttribute(
      "src",
      "https://cdn.example.com/yummy-tutorial.jpg",
    );

    fireEvent.click(playButton);

    const embeddedPlayer = await screen.findByTitle("Yummy tutorial");
    expect(embeddedPlayer).toHaveClass("h-full", "w-full");
    expect(embeddedPlayer).not.toHaveStyle({ aspectRatio: "16 / 9" });
    expect(embeddedPlayer).toHaveAttribute(
      "src",
      "https://www.youtube-nocookie.com/embed/admin-video-123?rel=0&modestbranding=1&controls=1&autoplay=1",
    );
  });

  it("hides iframe interaction after an outside click without stopping playback", async () => {
    fetchDashboardTutorialVideos.mockResolvedValue([
      {
        id: 8,
        title: "Yummy tutorial",
        youtube_url: "https://www.youtube.com/watch?v=admin-video-123",
        category: "Getting started",
        is_main: true,
      },
    ]);

    render(<DashboardTutorialVideo />);

    fireEvent.click(await screen.findByRole("button", { name: "Play Yummy tutorial" }));
    const embeddedPlayer = await screen.findByTitle("Yummy tutorial");

    fireEvent.pointerDown(document.body);

    expect(screen.getByTitle("Yummy tutorial")).toBe(embeddedPlayer);
    expect(embeddedPlayer).toHaveStyle({ pointerEvents: "none" });

    fireEvent.pointerDown(embeddedPlayer.parentElement!);
    expect(embeddedPlayer).toHaveStyle({ pointerEvents: "auto" });
  });

  it("keeps the existing Yummy introduction available if no published admin video is returned", async () => {
    fetchDashboardTutorialVideos.mockResolvedValue([]);

    render(<DashboardTutorialVideo />);

    expect(await screen.findByLabelText("Yummy product introduction video")).toHaveAttribute(
      "poster",
      "/assets/yummy-tutorial-poster.svg?v=2",
    );
  });

  it("fills the dashboard video panel for direct video URLs", async () => {
    fetchDashboardTutorialVideos.mockResolvedValue([
      {
        id: 4,
        title: "Operations tutorial",
        youtube_url: "https://cdn.example.com/operations.mp4",
        category: "Getting started",
        is_main: true,
      },
    ]);

    render(<DashboardTutorialVideo />);

    expect(await screen.findByLabelText("Operations tutorial")).toHaveStyle({ objectFit: "fill" });
  });
});
