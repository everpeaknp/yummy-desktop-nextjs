"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Play } from "lucide-react";
import { fetchDashboardTutorialVideos, youtubeVideoId, type HelpVideo } from "@/lib/help-center";

const FALLBACK_POSTER = "/assets/yummy-tutorial-poster.svg?v=2";
const FALLBACK_VIDEO = "https://www.yummyever.com/videos/Yummylanding.mp4";

export function DashboardTutorialVideo() {
  const [video, setVideo] = useState<HelpVideo | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isYoutubePlayerInteractive, setIsYoutubePlayerInteractive] = useState(true);
  const youtubePlayerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;
    const loadVideo = async () => {
      const videos = await fetchDashboardTutorialVideos();
      if (!mounted) return;
      setVideo(videos.find((item) => item.is_main) ?? videos[0] ?? null);
    };

    void loadVideo();
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void loadVideo();
    };
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      mounted = false;
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, []);

  useEffect(() => {
    setIsPlaying(false);
    setIsYoutubePlayerInteractive(true);
  }, [video?.id]);

  useEffect(() => {
    if (!isPlaying) return;

    const hidePlayerToolbarWhenOutside = (event: PointerEvent) => {
      if (!youtubePlayerRef.current?.contains(event.target as Node)) {
        setIsYoutubePlayerInteractive(false);
      }
    };
    const hidePlayerToolbarOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsYoutubePlayerInteractive(false);
    };

    document.addEventListener("pointerdown", hidePlayerToolbarWhenOutside);
    document.addEventListener("keydown", hidePlayerToolbarOnEscape);
    return () => {
      document.removeEventListener("pointerdown", hidePlayerToolbarWhenOutside);
      document.removeEventListener("keydown", hidePlayerToolbarOnEscape);
    };
  }, [isPlaying]);

  const videoId = video ? youtubeVideoId(video.youtube_url) : null;
  const thumbnail = video?.thumbnail_url?.trim() || (videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : FALLBACK_POSTER);

  if (!video) {
    return (
      <video
        controls
        playsInline
        preload="metadata"
        poster={FALLBACK_POSTER}
        aria-label="Yummy product introduction video"
        className="block h-full w-full"
        style={{ objectFit: "fill" }}
      >
        <source src={FALLBACK_VIDEO} type="video/mp4" />
      </video>
    );
  }

  if (videoId && isPlaying) {
    return (
      <div
        ref={youtubePlayerRef}
        onPointerDown={() => setIsYoutubePlayerInteractive(true)}
        className="relative h-full w-full overflow-hidden bg-black"
      >
        <iframe
          className="block h-full w-full border-0"
          style={{ pointerEvents: isYoutubePlayerInteractive ? "auto" : "none" }}
          src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?rel=0&modestbranding=1&controls=1&autoplay=1`}
          title={video.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      </div>
    );
  }

  if (videoId) {
    return (
      <button
        type="button"
        aria-label={`Play ${video.title}`}
        onClick={() => setIsPlaying(true)}
        className="group relative block h-full w-full overflow-hidden bg-muted text-left"
      >
        <Image src={thumbnail} alt="" fill unoptimized sizes="100vw" className="object-cover" />
        <span className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/5 to-transparent" />
        <span className="absolute left-4 top-4 max-w-[75%] rounded-lg bg-black/55 px-3 py-2 text-sm font-semibold text-white shadow-sm backdrop-blur-sm">
          {video.title}
        </span>
        <span aria-hidden="true" className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform group-hover:scale-105">
          <Play className="ml-0.5 h-6 w-6 fill-current" />
        </span>
      </button>
    );
  }

  if (/\.(mp4|webm|ogg)(?:[?#].*)?$/i.test(video.youtube_url)) {
    return (
      <video
        controls
        playsInline
        preload="metadata"
        poster={video.thumbnail_url || undefined}
        aria-label={video.title}
        className="block h-full w-full"
        style={{ objectFit: "fill" }}
      >
        <source src={video.youtube_url} />
      </video>
    );
  }

  return (
    <a
      href={video.youtube_url}
      target="_blank"
      rel="noreferrer"
      aria-label={`Open ${video.title}`}
      className="group relative flex h-full w-full items-end overflow-hidden bg-muted p-4 text-left"
    >
      <Image src={thumbnail} alt="" fill unoptimized sizes="100vw" className="object-cover" />
      <span className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
      <span className="relative inline-flex items-center gap-2 rounded-lg bg-black/55 px-3 py-2 text-sm font-semibold text-white backdrop-blur-sm">
        <Play className="h-4 w-4 fill-current" /> {video.title}
      </span>
    </a>
  );
}
