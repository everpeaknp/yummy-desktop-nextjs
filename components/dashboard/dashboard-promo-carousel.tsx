"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import apiClient from "@/lib/api-client";

type DashboardBanner = {
  id: number;
  image_url: string;
  mobile_image_url?: string;
  desktop_image_url?: string;
  alt_text: string;
};

const fallbackBanners: DashboardBanner[] = [
  { id: 1, image_url: "/mobile-promos/burger.png", mobile_image_url: "/mobile-promos/burger.png", desktop_image_url: "/mobile-promos/burger.png", alt_text: "New burger promotion" },
  { id: 2, image_url: "/mobile-promos/king-banner.png", mobile_image_url: "/mobile-promos/king-banner.png", desktop_image_url: "/mobile-promos/king-banner.png", alt_text: "Today's featured food promotion" },
  { id: 3, image_url: "/mobile-promos/plant-banner.png", mobile_image_url: "/mobile-promos/plant-banner.png", desktop_image_url: "/mobile-promos/plant-banner.png", alt_text: "Delivery promotion" },
];

export function DashboardPromoCarousel({ variant = "mobile" }: { variant?: "mobile" | "desktop" }) {
  const [banners, setBanners] = useState(fallbackBanners);
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
        // Keep the checked-in starter banners available if the admin API is offline.
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

  return (
    <div
      aria-label="Featured promotions"
      aria-roledescription="carousel"
      className="w-full min-w-0 space-y-2"
    >
      <div className={`relative isolate w-full overflow-hidden border border-border/80 bg-muted ${variant === "desktop" ? "h-40 rounded-2xl xl:h-44" : "aspect-[3.2/1] max-h-44 min-h-28 rounded-xl"}`}>
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
      </div>
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
