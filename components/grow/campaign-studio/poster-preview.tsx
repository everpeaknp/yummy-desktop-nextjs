"use client";

import { forwardRef } from "react";
import { CalendarDays, Gift } from "lucide-react";

import type { CampaignPosterTemplate } from "@/lib/growth/campaign-studio";
import { cn, getImageUrl } from "@/lib/utils";

const templateColors: Record<CampaignPosterTemplate, { primary: string; secondary: string }> = {
  fresh: { primary: "#047857", secondary: "#10b981" },
  warm: { primary: "#c2410c", secondary: "#fb923c" },
  minimal: { primary: "#111827", secondary: "#4b5563" },
  ticket: { primary: "#f97316", secondary: "#fb923c" },
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
  fixedSize?: boolean; // For export: use fixed 600x600px instead of responsive
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
      fixedSize = false,
    },
    ref,
  ) {
    // Debug logging
    console.log("CampaignPosterPreview props:", {
      template,
      restaurantName,
      headline,
      offerLabel,
      expiresOn,
      terms,
      hasLogo: !!logoUrl,
      primaryColor
    });

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

    // Ensure we have fallback content for testing
    const displayRestaurantName = restaurantName || "Restaurant Name";
    const displayHeadline = headline || "Special Offer Available";
    const displayOfferLabel = offerLabel || "20% OFF";
    const displayExpiresOn = expiresOn || "Dec 31, 2024";
    const displayTerms = terms || "Valid on orders above Rs.600. Cannot be combined with other offers.";

    // Shared styles for all templates
    const baseFont = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif";


    // TICKET TEMPLATE
    if (template === "ticket") {
      const sizeClasses = fixedSize 
        ? "relative rounded-3xl overflow-hidden" 
        : "relative rounded-3xl overflow-hidden w-full aspect-square";
      const sizeStyles = fixedSize
        ? { width: "600px", height: "600px" }
        : { maxWidth: "600px" };
      
      return (
        <div
          ref={ref}
          className={sizeClasses}
          style={{ 
            ...sizeStyles,
            fontFamily: baseFont,
            background: "linear-gradient(135deg, #1f2937 0%, #111827 100%)",
            padding: "0.75rem"
          }}
          aria-label="Campaign poster preview"
        >
          <div className="flex h-full gap-2">
            {/* Left Panel - Dark */}
            <div 
              className="flex flex-col rounded-2xl"
              style={{
                width: "40%",
                background: "linear-gradient(135deg, #374151 0%, #1f2937 100%)",
                padding: "1.5rem"
              }}
            >
              {/* Logo & Name */}
              <div className="flex items-center gap-3" style={{ marginBottom: "1.5rem" }}>
                {logo ? (
                  <img src={logo} alt="" crossOrigin="anonymous" className="w-12 h-12 rounded-xl object-cover shadow-lg" />
                ) : (
                  <div 
                    className="w-12 h-12 rounded-xl flex items-center justify-center font-black shadow-lg" 
                    style={{ 
                      backgroundColor: primary,
                      color: "#ffffff",
                      fontSize: "1.125rem"
                    }}
                  >
                    {initials || "Y"}
                  </div>
                )}
                <span 
                  className="font-bold leading-tight"
                  style={{
                    color: "#ffffff",
                    fontSize: "1.125rem"
                  }}
                >
                  {displayRestaurantName}
                </span>
              </div>

              {/* Accent line */}
              <div 
                className="rounded-full"
                style={{ 
                  width: "4rem",
                  height: "0.25rem",
                  backgroundColor: primary,
                  marginBottom: "1.5rem"
                }} 
              />

              {/* Headline */}
              <div className="flex-1 flex items-center">
                <h1 
                  className="font-black leading-tight break-words"
                  style={{
                    color: "#ffffff",
                    fontSize: "1.875rem",
                    lineHeight: "1.2"
                  }}
                >
                  {displayHeadline}
                </h1>
              </div>
            </div>

            {/* Right Panel - White Ticket */}
            <div className="flex-1 flex items-center" style={{ padding: "0.5rem 0" }}>
              <div 
                className="relative w-full h-full rounded-2xl shadow-2xl flex flex-col justify-center"
                style={{
                  backgroundColor: "#ffffff",
                  padding: "1.5rem"
                }}
              >
                {/* Perforations */}
                {[...Array(12)].map((_, i) => (
                  <div 
                    key={i} 
                    className="absolute rounded-full" 
                    style={{ 
                      width: "1rem",
                      height: "1rem",
                      backgroundColor: "#1f2937",
                      left: "-0.5rem",
                      top: `${8 + i * 7}%`
                    }} 
                  />
                ))}

                {/* Gift Icon */}
                <div className="flex justify-center" style={{ marginBottom: "1rem" }}>
                  <div 
                    className="rounded-full flex items-center justify-center" 
                    style={{ 
                      width: "4rem",
                      height: "4rem",
                      backgroundColor: `${primary}15` 
                    }}
                  >
                    <Gift size={32} style={{ color: primary }} strokeWidth={2.5} />
                  </div>
                </div>

                {/* Offer */}
                <div className="text-center" style={{ marginBottom: "1rem" }}>
                  <p 
                    className="font-bold uppercase tracking-wider"
                    style={{
                      color: "#6b7280",
                      fontSize: "0.625rem",
                      marginBottom: "0.5rem"
                    }}
                  >
                    GET
                  </p>
                  <h2 
                    className="font-black leading-none break-words"
                    style={{ 
                      fontSize: "2rem",
                      color: primary,
                      marginBottom: "0.75rem"
                    }}
                  >
                    {displayOfferLabel}
                  </h2>
                  <div 
                    className="inline-block rounded-full font-bold"
                    style={{
                      padding: "0.5rem 1rem",
                      backgroundColor: primary,
                      color: "#ffffff",
                      fontSize: "0.625rem"
                    }}
                  >
                    on orders above Rs.600
                  </div>
                </div>

                {/* Divider */}
                <div 
                  className="border-t border-dashed"
                  style={{ 
                    borderColor: `${primary}30`,
                    marginBottom: "0.75rem"
                  }} 
                />

                {/* Expiry */}
                <div 
                  className="flex items-center justify-center gap-2"
                  style={{ marginBottom: "0.75rem" }}
                >
                  <CalendarDays size={16} style={{ color: primary }} />
                  <span 
                    className="font-semibold"
                    style={{
                      color: "#374151",
                      fontSize: "0.75rem"
                    }}
                  >
                    Valid until {displayExpiresOn}
                  </span>
                </div>

                {/* Divider */}
                <div 
                  className="border-t border-dashed"
                  style={{ 
                    borderColor: `${primary}30`,
                    marginBottom: "0.75rem"
                  }} 
                />

                {/* Terms */}
                <p 
                  className="text-xs leading-relaxed text-center break-words"
                  style={{
                    color: "#6b7280",
                    fontSize: "0.625rem",
                    lineHeight: "1.5"
                  }}
                >
                  {displayTerms}
                </p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // FRESH TEMPLATE
    if (template === "fresh") {
      const sizeClasses = fixedSize 
        ? "relative rounded-3xl overflow-hidden p-8" 
        : "relative rounded-3xl overflow-hidden p-8 w-full aspect-square";
      const sizeStyles = fixedSize
        ? { width: "600px", height: "600px" }
        : { maxWidth: "600px" };
      
      return (
        <div
          ref={ref}
          className={sizeClasses}
          style={{ 
            ...sizeStyles,
            fontFamily: baseFont,
            background: `linear-gradient(135deg, ${primary} 0%, ${primary}ee 50%, ${palette.secondary}dd 100%)`
          }}
          aria-label="Campaign poster preview"
        >
          {/* Decorative circles */}
          <div className="absolute right-0 top-0 w-48 h-48 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute right-8 top-8 w-40 h-40 border-[16px] border-white/20 rounded-full" />

          {/* Content */}
          <div className="relative flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                {logo ? (
                  <img src={logo} alt="" crossOrigin="anonymous" className="w-12 h-12 rounded-2xl object-cover shadow-lg" />
                ) : (
                  <div className="w-12 h-12 rounded-2xl bg-white/95 flex items-center justify-center font-black text-lg shadow-lg" style={{ color: primary }}>
                    {initials || "Y"}
                  </div>
                )}
                <span className="text-white font-bold text-lg">{displayRestaurantName}</span>
              </div>
              <div className="px-4 py-2 bg-white/20 backdrop-blur-sm rounded-full text-white text-xs font-bold uppercase tracking-wider">
                SPECIAL
              </div>
            </div>

            {/* Headline */}
            <div className="flex-1 flex items-center mb-6">
              <h1 className="text-white font-black text-4xl leading-tight max-w-full break-words">{displayHeadline}</h1>
            </div>

            {/* Offer Card */}
            <div className="bg-white/95 backdrop-blur-lg rounded-3xl p-6 shadow-2xl">
              <div className="text-center mb-4">
                <p className="text-gray-500 font-bold text-xs uppercase tracking-wider mb-2">YOUR REWARD</p>
                <h2 className="font-black text-3xl mb-3 leading-none" style={{ color: primary }}>{displayOfferLabel}</h2>
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full font-bold text-xs" style={{ background: `${primary}15`, color: primary }}>
                  <CalendarDays size={14} />
                  <span>Valid until {displayExpiresOn}</span>
                </div>
              </div>
              <div className="border-t pt-3" style={{ borderColor: `${primary}20` }}>
                <p className="text-gray-600 text-xs leading-relaxed text-center break-words">{displayTerms}</p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // WARM TEMPLATE
    if (template === "warm") {
      const sizeClasses = fixedSize 
        ? "relative rounded-3xl overflow-hidden" 
        : "relative rounded-3xl overflow-hidden w-full aspect-square";
      const sizeStyles = fixedSize
        ? { width: "600px", height: "600px" }
        : { maxWidth: "600px" };
      
      return (
        <div
          ref={ref}
          className={sizeClasses}
          style={{
            ...sizeStyles,
            fontFamily: baseFont,
            background: `linear-gradient(150deg, ${primary} 0%, ${primary}f0 40%, ${palette.secondary}dd 100%)`,
            padding: "2rem"
          }}
          aria-label="Campaign poster preview"
        >
          {/* Warm glow */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/15 rounded-full blur-3xl" />

          {/* Content */}
          <div className="relative flex flex-col h-full">
            {/* Top Badge */}
            <div className="flex justify-center mb-6">
              <div 
                className="inline-flex items-center gap-3 rounded-full"
                style={{
                  padding: "0.75rem 1.5rem",
                  backgroundColor: "rgba(255, 255, 255, 0.15)",
                  backdropFilter: "blur(12px)"
                }}
              >
                {logo ? (
                  <img src={logo} alt="" crossOrigin="anonymous" className="w-10 h-10 rounded-xl object-cover shadow-lg" />
                ) : (
                  <div 
                    className="w-10 h-10 rounded-xl flex items-center justify-center font-black shadow-lg" 
                    style={{ 
                      backgroundColor: "rgba(255, 255, 255, 0.95)",
                      color: primary,
                      fontSize: "1rem"
                    }}
                  >
                    {initials || "Y"}
                  </div>
                )}
                <span 
                  className="font-bold"
                  style={{
                    color: "#ffffff",
                    fontSize: "1rem"
                  }}
                >
                  {displayRestaurantName}
                </span>
              </div>
            </div>

            {/* Center Content */}
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              {/* Icon */}
              <div 
                className="rounded-full flex items-center justify-center shadow-lg"
                style={{
                  width: "5rem",
                  height: "5rem",
                  backgroundColor: "rgba(255, 255, 255, 0.2)",
                  backdropFilter: "blur(8px)",
                  marginBottom: "1.5rem"
                }}
              >
                <Gift size={40} style={{ color: "#ffffff" }} strokeWidth={2.5} />
              </div>

              {/* Headline */}
              <h1 
                className="font-black leading-tight break-words"
                style={{
                  color: "#ffffff",
                  fontSize: "2.25rem",
                  marginBottom: "1.25rem",
                  maxWidth: "100%",
                  textShadow: "0 2px 8px rgba(0,0,0,0.2)"
                }}
              >
                {displayHeadline}
              </h1>

              {/* Offer */}
              <div 
                className="inline-block rounded-2xl shadow-2xl"
                style={{
                  padding: "0.75rem 1.75rem",
                  backgroundColor: "rgba(255, 255, 255, 0.95)",
                  marginBottom: "1rem"
                }}
              >
                <p 
                  className="font-bold uppercase tracking-wider"
                  style={{
                    color: "#6b7280",
                    fontSize: "0.75rem",
                    marginBottom: "0.5rem"
                  }}
                >
                  GET
                </p>
                <h2 
                  className="font-black leading-none"
                  style={{ 
                    fontSize: "1.875rem",
                    color: primary 
                  }}
                >
                  {displayOfferLabel}
                </h2>
              </div>

              {/* Expiry */}
              <div 
                className="flex items-center gap-2 font-bold"
                style={{
                  color: "#ffffff",
                  fontSize: "0.875rem"
                }}
              >
                <CalendarDays size={18} />
                <span>Valid until {displayExpiresOn}</span>
              </div>
            </div>

            {/* Terms */}
            <div 
              className="rounded-2xl"
              style={{
                backgroundColor: "rgba(255, 255, 255, 0.1)",
                backdropFilter: "blur(12px)",
                padding: "1.25rem",
                marginTop: "auto"
              }}
            >
              <p 
                className="text-xs leading-relaxed text-center"
                style={{
                  color: "rgba(255, 255, 255, 0.9)"
                }}
              >
                {displayTerms}
              </p>
            </div>
          </div>
        </div>
      );
    }

    // MINIMAL TEMPLATE
    const sizeClasses = fixedSize 
      ? "relative rounded-3xl overflow-hidden" 
      : "relative rounded-3xl overflow-hidden w-full aspect-square";
    const sizeStyles = fixedSize
      ? { width: "600px", height: "600px" }
      : { maxWidth: "600px" };
    
    return (
      <div
        ref={ref}
        className={sizeClasses}
        style={{ 
          ...sizeStyles,
          fontFamily: baseFont,
          backgroundColor: "#0a0a0a",
          padding: "2rem"
        }}
        aria-label="Campaign poster preview"
      >
        {/* Subtle grid */}
        <div 
          className="absolute inset-0"
          style={{
            opacity: 0.02,
            backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
            backgroundSize: "50px 50px"
          }} 
        />

        {/* Accent glow */}
        <div 
          className="absolute top-0 right-0"
          style={{
            width: "16rem",
            height: "12rem",
            opacity: 0.1,
            background: `radial-gradient(circle, ${primary} 0%, transparent 70%)`,
            filter: "blur(60px)"
          }}
        />

        {/* Content */}
        <div className="relative flex flex-col h-full">
          {/* Header */}
          <div 
            className="flex items-center justify-between"
            style={{ marginBottom: "2.5rem" }}
          >
            <div className="flex items-center gap-3">
              {logo ? (
                <img src={logo} alt="" crossOrigin="anonymous" className="w-11 h-11 rounded-xl object-cover shadow-lg" />
              ) : (
                <div 
                  className="w-11 h-11 rounded-xl flex items-center justify-center font-black shadow-lg" 
                  style={{ 
                    backgroundColor: primary,
                    color: "#ffffff",
                    fontSize: "1rem"
                  }}
                >
                  {initials || "Y"}
                </div>
              )}
              <span 
                className="font-bold"
                style={{
                  color: "#ffffff",
                  fontSize: "1.125rem"
                }}
              >
                {displayRestaurantName}
              </span>
            </div>
            <div 
              className="rounded-full"
              style={{
                width: "3rem",
                height: "0.25rem",
                backgroundColor: primary
              }}
            />
          </div>

          {/* Headline */}
          <div className="flex-1" style={{ marginBottom: "1.5rem" }}>
            <h1 
              className="font-black leading-tight break-words"
              style={{
                color: "#ffffff",
                fontSize: "2.25rem",
                maxWidth: "100%"
              }}
            >
              {displayHeadline}
            </h1>
          </div>

          {/* Offer Card */}
          <div 
            className="rounded-3xl shadow-2xl"
            style={{
              backgroundColor: "rgba(255, 255, 255, 0.05)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              padding: "1.5rem",
              marginBottom: "1.25rem"
            }}
          >
            <p 
              className="font-bold uppercase tracking-wider"
              style={{
                color: "#9ca3af",
                fontSize: "0.75rem",
                marginBottom: "0.5rem"
              }}
            >
              SPECIAL OFFER
            </p>
            <h2 
              className="font-black leading-none"
              style={{ 
                fontSize: "2.25rem",
                color: primary,
                marginBottom: "0.75rem"
              }}
            >
              {displayOfferLabel}
            </h2>
            <div 
              className="flex items-center gap-2 font-semibold"
              style={{
                color: "#d1d5db",
                fontSize: "0.875rem"
              }}
            >
              <CalendarDays size={16} style={{ color: primary }} />
              <span>Valid until {displayExpiresOn}</span>
            </div>
          </div>

          {/* Terms */}
          <div 
            className="rounded-2xl"
            style={{
              backgroundColor: "rgba(255, 255, 255, 0.03)",
              border: "1px solid rgba(255, 255, 255, 0.05)",
              padding: "1.25rem"
            }}
          >
            <p 
              className="text-xs leading-relaxed"
              style={{
                color: "#9ca3af"
              }}
            >
              {displayTerms}
            </p>
          </div>
        </div>
      </div>
    );
  },
);
