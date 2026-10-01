"use client";

import { forwardRef } from "react";
import { CalendarDays, Crown } from "lucide-react";
import type { TemplateProps } from "./shared";
import { baseFont, headlineFont, textConstraints, clampedTextStyles, getSizeConfig } from "./shared";
import { playfairDisplay } from "./fonts";

// Luxury certificate-style corner bracket
function CornerBracket({ corner, color }: { corner: "tl" | "tr" | "bl" | "br"; color: string }) {
  const size = "1.75rem";
  const thickness = "2px";
  const position: Record<string, React.CSSProperties> = {
    tl: { top: "1.25rem", left: "1.25rem", borderTop: `${thickness} solid ${color}`, borderLeft: `${thickness} solid ${color}` },
    tr: { top: "1.25rem", right: "1.25rem", borderTop: `${thickness} solid ${color}`, borderRight: `${thickness} solid ${color}` },
    bl: { bottom: "1.25rem", left: "1.25rem", borderBottom: `${thickness} solid ${color}`, borderLeft: `${thickness} solid ${color}` },
    br: { bottom: "1.25rem", right: "1.25rem", borderBottom: `${thickness} solid ${color}`, borderRight: `${thickness} solid ${color}` },
  };
  return (
    <div
      className="absolute pointer-events-none"
      style={{ width: size, height: size, opacity: 0.65, ...position[corner] }}
    />
  );
}

export const PremiumTemplate = forwardRef<HTMLDivElement, TemplateProps>(
  function PremiumTemplate(props, ref) {
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
    const gold = primaryColor;
    const goldLight = palette.secondary;

    return (
      <div
        ref={ref}
        className={`${sizeClasses} ${playfairDisplay.variable}`}
        style={{
          ...sizeStyles,
          fontFamily: baseFont,
          background: "radial-gradient(120% 100% at 85% 0%, #232019 0%, #131211 45%, #0a0a0b 100%)",
          padding: "2.25rem",
          border: `1px solid ${gold}40`
        }}
        aria-label="Campaign poster preview"
      >
        {/* Subtle gold glow */}
        <div
          className="absolute right-0 top-0 w-56 h-56 rounded-full blur-3xl"
          style={{ background: `${gold}22` }}
        />

        {/* Certificate-style corner brackets */}
        <CornerBracket corner="tl" color={gold} />
        <CornerBracket corner="tr" color={gold} />
        <CornerBracket corner="bl" color={gold} />
        <CornerBracket corner="br" color={gold} />

        {/* Content */}
        <div className="relative flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-center" style={{ marginTop: "0.5rem", marginBottom: "1.75rem" }}>
            <div className="flex items-center gap-2.5">
              {logo ? (
                <img
                  src={logo}
                  alt=""
                  crossOrigin="anonymous"
                  className="w-11 h-11 rounded-full object-cover"
                  style={{ border: `1.5px solid ${gold}` }}
                />
              ) : (
                <div
                  className="w-11 h-11 rounded-full flex items-center justify-center font-black"
                  style={{
                    background: `linear-gradient(135deg, ${gold} 0%, ${goldLight} 100%)`,
                    color: "#141414",
                    fontSize: "1.0625rem",
                    border: `1.5px solid ${gold}`
                  }}
                >
                  {initials || "Y"}
                </div>
              )}
              <span
                className="font-bold uppercase"
                style={{
                  color: "#f5f0e6",
                  fontSize: "0.9375rem",
                  letterSpacing: "0.08em",
                  maxWidth: "100%",
                  ...textConstraints
                }}
              >
                {restaurantName}
              </span>
            </div>
          </div>

          {/* Center: crown + headline */}
          <div className="flex-1 flex flex-col items-center justify-center text-center" style={{ marginBottom: "1.75rem" }}>
            <div
              className="rounded-full flex items-center justify-center"
              style={{
                width: "3.5rem",
                height: "3.5rem",
                border: `1px solid ${gold}80`,
                marginBottom: "1.25rem"
              }}
            >
              <Crown size={22} style={{ color: gold }} strokeWidth={1.75} />
            </div>

            <h1
              className="font-black leading-tight"
              style={{
                fontFamily: headlineFont,
                color: "#faf7ef",
                fontSize: "2.5rem",
                lineHeight: "1.15",
                letterSpacing: "-0.01em",
                maxWidth: "92%",
                ...clampedTextStyles(3)
              }}
            >
              {headline}
            </h1>

            <div
              className="rounded-full"
              style={{
                width: "3.5rem",
                height: "2px",
                background: `linear-gradient(90deg, transparent 0%, ${gold} 50%, transparent 100%)`,
                marginTop: "1.25rem"
              }}
            />
          </div>

          {/* Offer Card - gold-foil glass panel */}
          <div
            className="rounded-2xl"
            style={{
              padding: "1.75rem",
              background: "rgba(255, 255, 255, 0.04)",
              border: `1px solid ${gold}55`,
              boxShadow: `0 20px 40px -12px rgba(0,0,0,0.6), inset 0 1px 0 ${gold}20`
            }}
          >
            <div className="text-center">
              <p
                className="font-bold uppercase"
                style={{ color: `${gold}cc`, fontSize: "0.625rem", letterSpacing: "0.22em", marginBottom: "0.75rem" }}
              >
                Your Reward
              </p>
              <h2
                className="font-black leading-none"
                style={{
                  fontFamily: headlineFont,
                  fontSize: "2.375rem",
                  backgroundImage: `linear-gradient(135deg, ${goldLight} 0%, ${gold} 60%, ${goldLight} 100%)`,
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                  marginBottom: "1rem",
                  ...clampedTextStyles(2)
                }}
              >
                {offerLabel}
              </h2>
              <div
                className="inline-flex items-center gap-2 rounded-full font-semibold"
                style={{
                  padding: "0.5rem 1rem",
                  border: `1px solid ${gold}50`,
                  color: "#e8dfc8",
                  fontSize: "0.75rem",
                  marginBottom: "1rem"
                }}
              >
                <CalendarDays size={14} style={{ color: gold }} strokeWidth={2} />
                <span>Valid until {expiresOn}</span>
              </div>
            </div>
            <div className="pt-3 mt-3" style={{ borderTop: `1px dashed ${gold}35` }}>
              <p
                className="text-center"
                style={{
                  color: "#b8b0a0",
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
      </div>
    );
  }
);
