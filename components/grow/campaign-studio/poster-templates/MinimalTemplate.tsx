"use client";

import { forwardRef } from "react";
import { CalendarDays } from "lucide-react";
import type { TemplateProps } from "./shared";
import { baseFont, headlineFont, textConstraints, clampedTextStyles, getSizeConfig } from "./shared";
import { playfairDisplay } from "./fonts";

export const MinimalTemplate = forwardRef<HTMLDivElement, TemplateProps>(
  function MinimalTemplate(props, ref) {
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
            opacity: 0.12,
            background: `radial-gradient(circle, ${primaryColor} 0%, transparent 70%)`,
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
            <div className="flex items-center gap-2.5">
              {logo ? (
                <img src={logo} alt="" crossOrigin="anonymous" className="w-10 h-10 rounded-lg object-cover shadow-lg" />
              ) : (
                <div 
                  className="w-10 h-10 rounded-lg flex items-center justify-center font-black shadow-lg" 
                  style={{ 
                    backgroundColor: primaryColor,
                    color: "#ffffff",
                    fontSize: "0.9375rem"
                  }}
                >
                  {initials || "Y"}
                </div>
              )}
              <span 
                className="font-bold"
                style={{
                  color: "#ffffff",
                  fontSize: "1.0625rem",
                  maxWidth: "100%",
                  ...textConstraints
                }}
              >
                {restaurantName}
              </span>
            </div>
            <div 
              className="rounded-full"
              style={{
                width: "2.75rem",
                height: "0.25rem",
                backgroundColor: primaryColor
              }}
            />
          </div>

          {/* Headline */}
          <div className="flex-1" style={{ marginBottom: "1.75rem" }}>
            <h1
              className="font-black leading-tight"
              style={{
                fontFamily: headlineFont,
                color: "#ffffff",
                fontSize: "2.5rem",
                maxWidth: "100%",
                lineHeight: "1.15",
                ...clampedTextStyles(3)
              }}
            >
              {headline}
            </h1>
          </div>

          {/* Offer Card */}
          <div 
            className="rounded-2xl shadow-2xl"
            style={{
              backgroundColor: "rgba(255, 255, 255, 0.05)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              padding: "1.5rem",
              marginBottom: "1rem"
            }}
          >
            <p 
              className="font-bold uppercase tracking-wider"
              style={{
                color: "#9ca3af",
                fontSize: "0.6875rem",
                marginBottom: "0.75rem"
              }}
            >
              SPECIAL OFFER
            </p>
            <h2
              className="font-black leading-none"
              style={{
                fontFamily: headlineFont,
                fontSize: "2.5rem",
                color: primaryColor,
                marginBottom: "0.875rem",
                ...clampedTextStyles(2)
              }}
            >
              {offerLabel}
            </h2>
            <div 
              className="flex items-center gap-2 font-semibold"
              style={{
                color: "#d1d5db",
                fontSize: "0.8125rem"
              }}
            >
              <CalendarDays size={15} style={{ color: primaryColor }} strokeWidth={2.5} />
              <span>Valid until {expiresOn}</span>
            </div>
          </div>

          {/* Terms */}
          <div 
            className="rounded-xl"
            style={{
              backgroundColor: "rgba(255, 255, 255, 0.12)",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              padding: "1rem"
            }}
          >
            <p 
              className="font-semibold"
              style={{
                color: "#e5e7eb",
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
