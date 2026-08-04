"use client";

import { forwardRef } from "react";
import { CalendarDays, Sparkles } from "lucide-react";

import type { CampaignPosterTemplate } from "@/lib/growth/campaign-studio";
import { cn, getImageUrl } from "@/lib/utils";

const templateColors: Record<CampaignPosterTemplate, { primary: string; secondary: string }> = {
  fresh: { primary: "#047857", secondary: "#10b981" },
  warm: { primary: "#c2410c", secondary: "#fb923c" },
  minimal: { primary: "#111827", secondary: "#4b5563" },
};

function safeHex(value?: string | null): string | null {
  return value && /^#[0-9a-f]{6}$/i.test(value) ? value : null;
}

export interface CampaignPosterPreviewProps {
  template: CampaignPosterTemplate;
  restaurantName: string;
  logoUrl?: string | null;
  primaryColor?: string | null;
  headline: string;
  offerLabel: string;
  expiresOn: string;
  terms: string;
}

export const CampaignPosterPreview = forwardRef<HTMLDivElement, CampaignPosterPreviewProps>(
  function CampaignPosterPreview(
    {
      template,
      restaurantName,
      logoUrl,
      primaryColor,
      headline,
      offerLabel,
      expiresOn,
      terms,
    },
    ref,
  ) {
    const palette = templateColors[template];
    const primary = safeHex(primaryColor) || palette.primary;
    const logo = getImageUrl(logoUrl || "");
    const initials = restaurantName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0])
      .join("")
      .toUpperCase();

    return (
      <div
        ref={ref}
        className={cn(
          "relative aspect-square w-full overflow-hidden rounded-[2rem] border bg-white text-slate-950 shadow-xl",
          template === "minimal" && "border-slate-800",
        )}
        style={{ fontFamily: "Inter, Arial, sans-serif" }}
        aria-label="Campaign poster preview"
      >
        <div
          className="absolute inset-x-0 top-0 h-[42%]"
          style={{
            background:
              template === "minimal"
                ? `linear-gradient(145deg, ${primary}, #020617)`
                : `linear-gradient(145deg, ${primary}, ${palette.secondary})`,
          }}
        />
        <div className="absolute -right-[12%] -top-[15%] h-[55%] w-[55%] rounded-full border-[28px] border-white/10" />
        <div className="absolute left-[7%] top-[8%] h-[18%] w-[18%] rounded-full bg-white/10 blur-xl" />

        <div className="relative flex h-full flex-col p-[7%]">
          <div className="flex items-center justify-between gap-4 text-white">
            <div className="flex min-w-0 items-center gap-3">
              {logo ? (
                // html2canvas uses CORS for approved restaurant-hosted assets.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logo}
                  alt=""
                  crossOrigin="anonymous"
                  className="h-14 w-14 rounded-2xl border border-white/30 bg-white object-contain p-1 shadow-md"
                />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/30 bg-white/15 text-lg font-black shadow-md">
                  {initials || "Y"}
                </div>
              )}
              <p className="truncate text-[clamp(0.8rem,2.4vw,1.15rem)] font-black">{restaurantName}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1 rounded-full border border-white/25 bg-white/15 px-3 py-1 text-[clamp(0.55rem,1.5vw,0.72rem)] font-bold uppercase tracking-wider">
              <Sparkles className="h-3 w-3" />
              Special
            </div>
          </div>

          <div className="mt-[8%] max-w-[82%] text-white">
            <h2 className="text-[clamp(1.45rem,5vw,3.3rem)] font-black leading-[0.98] tracking-tight">
              {headline || "A special reason to visit"}
            </h2>
          </div>

          <div className="mt-auto">
            <div className="inline-flex max-w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-lg">
              <p
                className="text-[clamp(1.05rem,3.4vw,2rem)] font-black leading-tight"
                style={{ color: primary }}
              >
                {offerLabel}
              </p>
            </div>
            <div className="mt-5 flex items-center gap-2 text-[clamp(0.65rem,1.8vw,0.9rem)] font-bold text-slate-700">
              <CalendarDays className="h-4 w-4" style={{ color: primary }} />
              Valid until {expiresOn || "the campaign expiry"}
            </div>
            <div className="mt-4 border-t border-slate-200 pt-3 text-[clamp(0.5rem,1.45vw,0.68rem)] leading-relaxed text-slate-500">
              {terms || "One use per eligible customer. Minimum order and campaign terms apply."}
            </div>
          </div>
        </div>
      </div>
    );
  },
);
