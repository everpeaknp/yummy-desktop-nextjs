"use client";

import { forwardRef } from "react";
import { CalendarDays, Gift } from "lucide-react";
import type { TemplateProps } from "./shared";
import { baseFont, headlineFont, textConstraints, clampedTextStyles, getSizeConfig } from "./shared";
import { playfairDisplay } from "./fonts";

export const DefaultTemplate = forwardRef<HTMLDivElement, TemplateProps>(
  function DefaultTemplate(props, ref) {
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
          background: `linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}ee 50%, ${palette.secondary}dd 100%)`,
          padding: "2rem"
        }}
        aria-label="Campaign poster preview"
      >
        {/* Decorative element */}
        <div className="absolute right-0 top-0 w-48 h-48 bg-white/10 rounded-full blur-3xl" />

        {/* Content */}
        <div className="relative flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between" style={{ marginBottom: "2rem" }}>
            <div className="flex items-center gap-2.5">
              {logo ? (
                <img src={logo} alt="" crossOrigin="anonymous" className="w-11 h-11 rounded-xl object-cover shadow-lg" />
              ) : (
                <div className="w-11 h-11 rounded-xl bg-white/95 flex items-center justify-center font-black shadow-lg" style={{ color: primaryColor, fontSize: "1.125rem" }}>
                  {initials || "Y"}
                </div>
              )}
              <span className="text-white font-bold" style={{ fontSize: "1.125rem", maxWidth: "100%", ...textConstraints }}>{restaurantName}</span>
            </div>
          </div>

          {/* Headline */}
          <div className="flex-1 flex items-center" style={{ marginBottom: "1.75rem" }}>
            <h1 className="text-white font-black leading-tight max-w-full" style={{
              fontFamily: headlineFont,
              fontSize: "2.75rem",
              lineHeight: "1.1",
              textShadow: "0 2px 8px rgba(0,0,0,0.6), 0 1px 3px rgba(0,0,0,0.8)",
              ...clampedTextStyles(3)
            }}>{headline}</h1>
          </div>

          {/* Offer Card */}
          <div className="bg-white/95 backdrop-blur-lg rounded-2xl shadow-2xl" style={{ padding: "1.75rem" }}>
            <div className="text-center">
              <p className="text-gray-500 font-bold uppercase tracking-wider" style={{ fontSize: "0.625rem", marginBottom: "0.75rem" }}>SPECIAL OFFER</p>
              <h2 className="font-black leading-none" style={{
                fontFamily: headlineFont,
                color: primaryColor,
                fontSize: "2.5rem",
                marginBottom: "1rem",
                ...clampedTextStyles(2)
              }}>{offerLabel}</h2>
              <div className="inline-flex items-center gap-2 px-3 py-2 rounded-full font-bold" style={{ background: `${primaryColor}15`, color: primaryColor, fontSize: "0.75rem", marginBottom: "1rem" }}>
                <CalendarDays size={14} strokeWidth={2.5} />
                <span>Valid until {expiresOn}</span>
              </div>
            </div>
            <div className="pt-3 mt-3" style={{ borderTop: `1px solid ${primaryColor}20` }}>
              <p className="text-gray-600 text-center" style={{ 
                fontSize: "0.6875rem", 
                lineHeight: "1.5",
                ...clampedTextStyles(3)
              }}>{terms}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }
);
