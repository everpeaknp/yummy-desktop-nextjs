"use client";

import { forwardRef } from "react";
import { CalendarDays, Gift } from "lucide-react";
import type { TemplateProps } from "./shared";
import { baseFont, headlineFont, textConstraints, clampedTextStyles, getSizeConfig } from "./shared";
import { playfairDisplay } from "./fonts";

export const WarmTemplate = forwardRef<HTMLDivElement, TemplateProps>(
  function WarmTemplate(props, ref) {
    const {
      restaurantName,
      logo,
      initials,
      primaryColor,
      palette,
      headline,
      offerLabel,
      expiresOn,
      terms,
      fixedSize
    } = props;

    const { sizeClasses, sizeStyles } = getSizeConfig(fixedSize);

    return (
      <div
        ref={ref}
        className={`${sizeClasses} ${playfairDisplay.variable}`}
        style={{
          ...sizeStyles,
          fontFamily: baseFont,
          background: `linear-gradient(150deg, ${primaryColor} 0%, ${primaryColor}f0 40%, ${palette.secondary}dd 100%)`,
          padding: "2rem"
        }}
        aria-label="Campaign poster preview"
      >
        {/* Warm glow */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/15 rounded-full blur-3xl" />

        {/* Content */}
        <div className="relative flex flex-col h-full">
          {/* Top Badge */}
          <div className="flex justify-center" style={{ marginBottom: "2rem" }}>
            <div 
              className="inline-flex items-center gap-2.5 rounded-full"
              style={{
                padding: "0.625rem 1.25rem",
                backgroundColor: "rgba(255, 255, 255, 0.25)"
              }}
            >
              {logo ? (
                <img src={logo} alt="" crossOrigin="anonymous" className="w-9 h-9 rounded-lg object-cover shadow-lg" />
              ) : (
                <div 
                  className="w-9 h-9 rounded-lg flex items-center justify-center font-black shadow-lg" 
                  style={{ 
                    backgroundColor: "rgba(255, 255, 255, 0.95)",
                    color: primaryColor,
                    fontSize: "0.875rem"
                  }}
                >
                  {initials || "Y"}
                </div>
              )}
              <span 
                className="font-bold"
                style={{
                  color: "#ffffff",
                  fontSize: "0.9375rem",
                  maxWidth: "100%",
                  ...textConstraints
                }}
              >
                {restaurantName}
              </span>
            </div>
          </div>

          {/* Center Content */}
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            {/* Icon */}
            <div 
              className="rounded-full flex items-center justify-center shadow-lg"
              style={{
                width: "4.5rem",
                height: "4.5rem",
                backgroundColor: "rgba(255, 255, 255, 0.3)",
                marginBottom: "1.5rem"
              }}
            >
              <Gift size={36} style={{ color: "#ffffff" }} strokeWidth={2.5} />
            </div>

            {/* Headline */}
            <h1
              className="font-black leading-tight"
              style={{
                fontFamily: headlineFont,
                color: "#ffffff",
                fontSize: "2.5rem",
                marginBottom: "1.5rem",
                maxWidth: "90%",
                textShadow: "0 2px 8px rgba(0,0,0,0.2)",
                lineHeight: "1.15",
                ...clampedTextStyles(3)
              }}
            >
              {headline}
            </h1>

            {/* Offer Card */}
            <div 
              className="inline-block rounded-2xl shadow-2xl"
              style={{
                padding: "1rem 2rem",
                backgroundColor: "rgba(255, 255, 255, 0.95)",
                marginBottom: "1.25rem"
              }}
            >
              <p 
                className="font-bold uppercase tracking-wider"
                style={{
                  color: "#6b7280",
                  fontSize: "0.6875rem",
                  marginBottom: "0.5rem"
                }}
              >
                GET
              </p>
              <h2
                className="font-black leading-none"
                style={{
                  fontFamily: headlineFont,
                  fontSize: "2.25rem",
                  color: primaryColor,
                  ...clampedTextStyles(2)
                }}
              >
                {offerLabel}
              </h2>
            </div>

            {/* Expiry */}
            <div 
              className="flex items-center gap-2 font-bold"
              style={{
                color: "#ffffff",
                fontSize: "0.8125rem"
              }}
            >
              <CalendarDays size={16} strokeWidth={2.5} />
              <span>Valid until {expiresOn}</span>
            </div>
          </div>

          {/* Terms */}
          <div 
            className="rounded-xl"
            style={{
              backgroundColor: "rgba(255, 255, 255, 0.9)",
              padding: "1rem",
              marginTop: "auto"
            }}
          >
            <p 
              className="text-center font-semibold"
              style={{
                color: "#1f2937",
                fontSize: "0.6875rem",
                lineHeight: "1.5",
                ...clampedTextStyles(3)
              }}
            >
              {terms}
            </p>
          </div>
        </div>
      </div>
    );
  }
);
