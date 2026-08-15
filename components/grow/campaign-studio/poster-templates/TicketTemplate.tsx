"use client";

import { forwardRef } from "react";
import { CalendarDays, Gift } from "lucide-react";
import type { TemplateProps } from "./shared";
import { baseFont, headlineFont, textConstraints, clampedTextStyles, getSizeConfig } from "./shared";
import { playfairDisplay } from "./fonts";

export const TicketTemplate = forwardRef<HTMLDivElement, TemplateProps>(
  function TicketTemplate(props, ref) {
    const {
      restaurantName,
      logo,
      initials,
      primaryColor,
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
                    backgroundColor: primaryColor,
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
                  fontSize: "1.125rem",
                  maxWidth: "100%",
                  ...textConstraints
                }}
              >
                {restaurantName}
              </span>
            </div>

            {/* Accent line */}
            <div 
              className="rounded-full"
              style={{ 
                width: "4rem",
                height: "0.25rem",
                backgroundColor: primaryColor,
                marginBottom: "1.5rem"
              }} 
            />

            {/* Headline */}
            <div className="flex-1 flex items-center">
              <h1
                className="font-black leading-tight"
                style={{
                  fontFamily: headlineFont,
                  color: "#ffffff",
                  fontSize: "1.875rem",
                  lineHeight: "1.2",
                  ...clampedTextStyles(3)
                }}
              >
                {headline}
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
                    backgroundColor: `${primaryColor}15` 
                  }}
                >
                  <Gift size={32} style={{ color: primaryColor }} strokeWidth={2.5} />
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
                  className="font-black leading-none"
                  style={{
                    fontFamily: headlineFont,
                    fontSize: "2rem",
                    color: primaryColor,
                    marginBottom: "0.75rem",
                    ...clampedTextStyles(2)
                  }}
                >
                  {offerLabel}
                </h2>
                <div 
                  className="inline-block rounded-full font-bold"
                  style={{
                    padding: "0.5rem 1rem",
                    backgroundColor: primaryColor,
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
                  borderColor: `${primaryColor}30`,
                  marginBottom: "0.75rem"
                }} 
              />

              {/* Expiry */}
              <div 
                className="flex items-center justify-center gap-2"
                style={{ marginBottom: "0.75rem" }}
              >
                <CalendarDays size={16} style={{ color: primaryColor }} />
                <span 
                  className="font-semibold"
                  style={{
                    color: "#374151",
                    fontSize: "0.75rem"
                  }}
                >
                  Valid until {expiresOn}
                </span>
              </div>

              {/* Divider */}
              <div 
                className="border-t border-dashed"
                style={{ 
                  borderColor: `${primaryColor}30`,
                  marginBottom: "0.75rem"
                }} 
              />

              {/* Terms */}
              <p 
                className="text-xs leading-relaxed text-center"
                style={{
                  color: "#6b7280",
                  fontSize: "0.625rem",
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
