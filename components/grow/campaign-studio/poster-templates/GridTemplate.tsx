"use client";

import { forwardRef } from "react";
import { CalendarDays } from "lucide-react";
import type { TemplateProps } from "./shared";
import { baseFont, headlineFont, textConstraints, clampedTextStyles, whiteTextShadow, getSizeConfig } from "./shared";
import { playfairDisplay } from "./fonts";

// Blueprint/graph-paper look: thin grid lines cover the whole poster as a
// backdrop texture, with a bolder major line every 4th cell. Content floats
// on top of the grid — it is not boxed into cells.
export const GridTemplate = forwardRef<HTMLDivElement, TemplateProps>(
  function GridTemplate(props, ref) {
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
    const minorLine = "rgba(255,255,255,0.16)";
    const majorLine = "rgba(255,255,255,0.32)";
    const cell = "2.5rem";

    return (
      <div
        ref={ref}
        className={`${sizeClasses} ${playfairDisplay.variable}`}
        style={{
          ...sizeStyles,
          fontFamily: baseFont,
          background: `linear-gradient(160deg, ${primaryColor} 0%, ${palette.secondary} 100%)`,
          padding: "2rem"
        }}
        aria-label="Campaign poster preview"
      >
        {/* Grid-line texture */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(${majorLine} 1px, transparent 1px),
              linear-gradient(90deg, ${majorLine} 1px, transparent 1px),
              linear-gradient(${minorLine} 1px, transparent 1px),
              linear-gradient(90deg, ${minorLine} 1px, transparent 1px)
            `,
            backgroundSize: `${cell} ${cell}, ${cell} ${cell}, calc(${cell} / 4) calc(${cell} / 4), calc(${cell} / 4) calc(${cell} / 4)`
          }}
        />

        {/* Content — floats on top of the grid, not boxed into cells */}
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
            <div className="px-3 py-1.5 bg-white/20 backdrop-blur-sm rounded-full text-white font-bold uppercase tracking-wider" style={{ fontSize: "0.625rem" }}>
              SPECIAL
            </div>
          </div>

          {/* Headline */}
          <div className="flex-1 flex items-center" style={{ marginBottom: "1.75rem" }}>
            <h1
              className="font-black leading-tight max-w-full"
              style={{
                fontFamily: headlineFont,
                color: "#ffffff",
                fontSize: "2.75rem",
                lineHeight: "1.1",
                ...whiteTextShadow,
                ...clampedTextStyles(3)
              }}
            >
              {headline}
            </h1>
          </div>

          {/* Offer amount — no card, sits directly on the grid */}
          <div style={{ marginBottom: "1.5rem" }}>
            <p className="text-white/80 font-bold uppercase tracking-wider" style={{ fontSize: "0.625rem", marginBottom: "0.5rem" }}>
              YOUR REWARD
            </p>
            <h2
              className="font-black leading-none"
              style={{
                fontFamily: headlineFont,
                color: "#ffffff",
                fontSize: "2.75rem",
                ...whiteTextShadow,
                ...clampedTextStyles(2)
              }}
            >
              {offerLabel}
            </h2>
            <div className="inline-flex items-center gap-2 font-bold" style={{ color: "rgba(255,255,255,0.9)", fontSize: "0.75rem", marginTop: "0.75rem" }}>
              <CalendarDays size={14} strokeWidth={2.5} />
              <span>Valid until {expiresOn}</span>
            </div>
          </div>

          {/* Terms — a thin rule (grid-native), not a card */}
          <div className="pt-3" style={{ borderTop: `1px solid ${majorLine}` }}>
            <p
              className="text-white/80"
              style={{
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
