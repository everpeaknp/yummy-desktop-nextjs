"use client";

import { forwardRef } from "react";
import type { CampaignPosterTemplate } from "@/lib/growth/campaign-studio";
import { getImageUrl } from "@/lib/utils";
import {
  TicketTemplate,
  FreshTemplate,
  WarmTemplate,
  MinimalTemplate,
  DefaultTemplate,
  templateColors,
  safeHex,
  type TemplateProps
} from "./poster-templates";

// Re-export templateColors for backward compatibility
export { templateColors } from "./poster-templates";

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

    // Common props for all templates
    const commonProps: TemplateProps = {
      restaurantName: displayRestaurantName,
      logoUrl,
      primaryColor: primary,
      palette,
      headline: displayHeadline,
      offerLabel: displayOfferLabel,
      expiresOn: displayExpiresOn,
      terms: displayTerms,
      fixedSize,
      logo,
      initials,
    };

    // Template routing
    switch (template) {
      case "ticket":
        return <TicketTemplate ref={ref} {...commonProps} />;
      case "fresh":
        return <FreshTemplate ref={ref} {...commonProps} />;
      case "warm":
        return <WarmTemplate ref={ref} {...commonProps} />;
      case "minimal":
        return <MinimalTemplate ref={ref} {...commonProps} />;
      default:
        // All other templates use the default template for now
        // You can add more specific templates as needed
        return <DefaultTemplate ref={ref} {...commonProps} />;
    }
  }
);
