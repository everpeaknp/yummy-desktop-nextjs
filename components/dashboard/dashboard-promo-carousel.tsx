"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import apiClient from "@/lib/api-client";

type DashboardBanner = {
  id: number;
  image_url: string;
  mobile_image_url?: string;
  desktop_image_url?: string;
  alt_text: string;
  action_type?: "none" | "external_url" | "internal_path";
  action_value?: string | null;
  open_in_new_tab?: boolean;
};

export function DashboardPromoCarousel({ variant = "mobile" }: { variant?: "mobile" | "desktop" }) {
  const router = useRouter();
  const [banners, setBanners] = useState<DashboardBanner[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    let mounted = true;
    apiClient.get<{ status: string; message: string; data: DashboardBanner[] }>("/dashboard/banners")
      .then(({ data }) => {
        if (!mounted) return;
        setBanners(data.data || []);
        setActiveIndex(0);
      })
      .catch(() => {
        // Promotional content is platform-managed. Do not display an old local
        // campaign when the platform cannot provide the current banner list.
        if (mounted) setBanners([]);
      });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (banners.length < 2) return;
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % banners.length);
    }, 3000);

    return () => window.clearInterval(timer);
  }, [banners.length]);

  if (!banners.length) return null;

  const activeBanner = banners[activeIndex] || banners[0];
  const activeImage = variant === "desktop"
    ? activeBanner.desktop_image_url || activeBanner.image_url
    : activeBanner.mobile_image_url || activeBanner.image_url;
  const actionType = activeBanner.action_type || "none";
  const actionValue = activeBanner.action_value?.trim() || "";
  const canOpen = actionType !== "none" && Boolean(actionValue);
  const frameClassName = `relative isolate w-full overflow-hidden border border-border/80 bg-muted ${variant === "desktop" ? "h-40 rounded-2xl xl:h-44" : "aspect-[3.2/1] max-h-44 min-h-28 rounded-xl"}`;
  const bannerArtwork = (
    <>
      <Image
        src={activeImage}
        alt=""
        aria-hidden="true"
        fill
        sizes="100vw"
        className="-z-10 scale-110 object-cover opacity-60 blur-xl"
      />
      <Image
        key={activeBanner.id}
        src={activeImage}
        alt={activeBanner.alt_text}
        fill
        sizes="(max-width: 768px) 100vw, 1600px"
        className="object-contain p-1 drop-shadow-md"
        priority={activeIndex === 0}
      />
    </>
  );

  const openBanner = () => {
    if (!canOpen) return;
    if (actionType === "internal_path") {
      router.push(actionValue);
      return;
    }
    if (activeBanner.open_in_new_tab) {
      window.open(actionValue, "_blank", "noopener,noreferrer");
      return;
    }
    window.location.assign(actionValue);
  };

  return (
    <div
      aria-label="Featured promotions"
      aria-roledescription="carousel"
      className="w-full min-w-0 space-y-2"
    >
      {canOpen ? (
        <button
          type="button"
          onClick={openBanner}
          className={`${frameClassName} cursor-pointer text-left outline-none transition focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2`}
          aria-label={`Open ${activeBanner.alt_text || "promotion"}`}
        >
          {bannerArtwork}
        </button>
      ) : (
        <div className={frameClassName}>{bannerArtwork}</div>
      )}
      <div className="flex items-center justify-center gap-1.5">
        {banners.map((banner, index) => (
          <button
            key={banner.id}
            type="button"
            aria-label={`Show promotional banner ${index + 1}`}
            aria-current={index === activeIndex ? "true" : undefined}
            onClick={() => setActiveIndex(index)}
            className={`h-2 rounded-full transition-all ${
              index === activeIndex ? "w-6 bg-primary" : "w-2 bg-muted-foreground/30"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
