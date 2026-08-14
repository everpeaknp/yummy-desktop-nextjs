/**
 * Utility functions for Fabric templates
 */

import type { CampaignPosterTemplate } from "@/lib/growth/campaign-studio";
import type { FabricTemplate, FabricTemplateConfig, TEMPLATE_COLORS } from "./types";
import { generateObjectId } from "@/types/fabric-poster";

/**
 * Get safe hex color or fallback
 */
export function safeHex(value?: string | null, fallback = "#000000"): string {
  if (!value) return fallback;
  return /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}

/**
 * Get restaurant initials for logo placeholder
 */
export function getRestaurantInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase() || "Y";
}

/**
 * FRESH TEMPLATE - Modern gradient with floating offer card
 */
export function createFreshTemplate(
  config: FabricTemplateConfig
): FabricTemplate {
  const {
    restaurantName,
    logoUrl,
    primaryColor,
    secondaryColor,
    headline,
    offerLabel,
    expiresOn,
    terms,
  } = config;

  const primary = safeHex(primaryColor, "#047857");
  const secondary = safeHex(secondaryColor, "#10b981");

  return {
    id: "fresh",
    name: "Fresh Template",
    description: "Vibrant gradient with decorative circles and floating offer card",
    fabricJSON: {
      version: "6.0.0",
      objects: [
        // Background gradient
        {
          id: generateObjectId("background"),
          type: "rect",
          version: "6.0.0",
          originX: "left",
          originY: "top",
          left: 0,
          top: 0,
          width: 2160,
          height: 2160,
          fill: {
            type: "linear",
            coords: { x1: 0, y1: 0, x2: 2160, y2: 2160 },
            colorStops: [
              { offset: 0, color: primary },
              { offset: 0.5, color: `${primary}ee` },
              { offset: 1, color: `${secondary}dd` },
            ],
          },
          selectable: false,
          evented: false,
        },
        // Decorative circle 1 (top-right blur)
        {
          id: generateObjectId("circle"),
          type: "circle",
          version: "6.0.0",
          originX: "left",
          originY: "top",
          left: 1500,
          top: -100,
          radius: 300,
          fill: "rgba(255, 255, 255, 0.1)",
          selectable: false,
          evented: false,
        },
        // Decorative circle 2 (border)
        {
          id: generateObjectId("circle"),
          type: "circle",
          version: "6.0.0",
          originX: "left",
          originY: "top",
          left: 1700,
          top: 100,
          radius: 250,
          fill: "transparent",
          stroke: "rgba(255, 255, 255, 0.2)",
          strokeWidth: 24,
          selectable: false,
          evented: false,
        },
        // Logo placeholder
        {
          id: generateObjectId("logo"),
          type: "rect",
          version: "6.0.0",
          originX: "left",
          originY: "top",
          left: 150,
          top: 150,
          width: 120,
          height: 120,
          fill: "rgba(255, 255, 255, 0.95)",
          rx: 30,
          ry: 30,
          shadow: {
            color: "rgba(0, 0, 0, 0.2)",
            blur: 20,
            offsetX: 0,
            offsetY: 8,
          },
        },
        // Restaurant name
        {
          id: "restaurant-name",
          type: "textbox",
          version: "6.0.0",
          originX: "left",
          originY: "top",
          left: 300,
          top: 175,
          width: 600,
          text: restaurantName,
          fontSize: 56,
          fontFamily: "Inter, system-ui, sans-serif",
          fontWeight: "bold",
          fill: "#ffffff",
          textAlign: "left",
          editable: true,
        },
        // Special badge background
        {
          id: generateObjectId("rect"),
          type: "rect",
          version: "6.0.0",
          originX: "left",
          originY: "top",
          left: 1800,
          top: 175,
          width: 230,
          height: 70,
          fill: "rgba(255, 255, 255, 0.2)",
          rx: 35,
          ry: 35,
        },
        // Special badge text
        {
          id: generateObjectId("text"),
          type: "textbox",
          version: "6.0.0",
          originX: "center",
          originY: "center",
          left: 1915,
          top: 210,
          width: 200,
          text: "SPECIAL",
          fontSize: 28,
          fontFamily: "Inter, system-ui, sans-serif",
          fontWeight: "bold",
          fill: "#ffffff",
          textAlign: "center",
        },
        // Headline
        {
          id: "poster-headline",
          type: "textbox",
          version: "6.0.0",
          originX: "left",
          originY: "top",
          left: 150,
          top: 700,
          width: 1300,
          text: headline || "Special Offer Available",
          fontSize: 140,
          fontFamily: "Inter, system-ui, sans-serif",
          fontWeight: "900",
          fill: "#ffffff",
          textAlign: "left",
          lineHeight: 1.1,
          editable: true,
        },
        // Offer card background
        {
          id: generateObjectId("rect"),
          type: "rect",
          version: "6.0.0",
          originX: "left",
          originY: "top",
          left: 150,
          top: 1450,
          width: 1860,
          height: 560,
          fill: "rgba(255, 255, 255, 0.95)",
          rx: 50,
          ry: 50,
          shadow: {
            color: "rgba(0, 0, 0, 0.25)",
            blur: 60,
            offsetX: 0,
            offsetY: 30,
          },
        },
        // "YOUR REWARD" label
        {
          id: generateObjectId("text"),
          type: "textbox",
          version: "6.0.0",
          originX: "center",
          originY: "top",
          left: 1080,
          top: 1550,
          width: 1600,
          text: "YOUR REWARD",
          fontSize: 32,
          fontFamily: "Inter, system-ui, sans-serif",
          fontWeight: "bold",
          fill: "#9ca3af",
          textAlign: "center",
        },
        // Offer amount
        {
          id: "offer-label",
          type: "textbox",
          version: "6.0.0",
          originX: "center",
          originY: "top",
          left: 1080,
          top: 1650,
          width: 1600,
          text: offerLabel || "20% OFF",
          fontSize: 110,
          fontFamily: "Inter, system-ui, sans-serif",
          fontWeight: "900",
          fill: "#1f2937",
          textAlign: "center",
          editable: true,
        },
        // Expiry badge background
        {
          id: generateObjectId("rect"),
          type: "rect",
          version: "6.0.0",
          originX: "center",
          originY: "top",
          left: 1080,
          top: 1820,
          width: 450,
          height: 65,
          fill: `${primary}15`,
          rx: 32,
          ry: 32,
        },
        // Expiry text
        {
          id: "expiry-date",
          type: "textbox",
          version: "6.0.0",
          originX: "center",
          originY: "center",
          left: 1080,
          top: 1853,
          width: 420,
          text: `ðŸ“… Valid until ${expiresOn}`,
          fontSize: 32,
          fontFamily: "Inter, system-ui, sans-serif",
          fontWeight: "bold",
          fill: "#1f2937",
          textAlign: "center",
          editable: true,
        },
        // Divider line
        {
          id: generateObjectId("rect"),
          type: "rect",
          version: "6.0.0",
          originX: "left",
          originY: "top",
          left: 300,
          top: 1920,
          width: 1560,
          height: 2,
          fill: `${primary}20`,
        },
        // Terms
        {
          id: "terms-text",
          type: "textbox",
          version: "6.0.0",
          originX: "center",
          originY: "top",
          left: 1080,
          top: 1970,
          width: 1560,
          text: terms || "Valid on orders above Rs.600. Cannot be combined with other offers.",
          fontSize: 26,
          fontFamily: "Inter, system-ui, sans-serif",
          fill: "#6b7280",
          textAlign: "center",
          lineHeight: 1.4,
          editable: true,
        },
      ],
    },
    variables: {
      restaurantName: {
        objectId: "restaurant-name",
        property: "text",
        defaultValue: restaurantName,
      },
      headline: {
        objectId: "poster-headline",
        property: "text",
        defaultValue: headline,
      },
      offerLabel: {
        objectId: "offer-label",
        property: "text",
        defaultValue: offerLabel,
      },
      expiresOn: {
        objectId: "expiry-date",
        property: "text",
        defaultValue: `ðŸ“… Valid until ${expiresOn}`,
      },
      terms: {
        objectId: "terms-text",
        property: "text",
        defaultValue: terms,
      },
    },
  };
}

/**
 * Legacy alias for backward compatibility
 */
export function createProofOfConceptTemplate(
  config: FabricTemplateConfig
): FabricTemplate {
  // Default to Fresh template for backward compatibility
  return createFreshTemplate(config);
}

/**
 * WARM TEMPLATE - Centered design with warm gradients
 */
export function createWarmTemplate(
  config: FabricTemplateConfig
): FabricTemplate {
  const {
    restaurantName,
    primaryColor,
    secondaryColor,
    headline,
    offerLabel,
    expiresOn,
    terms,
  } = config;

  const primary = safeHex(primaryColor, "#f59e0b");
  const secondary = safeHex(secondaryColor, "#f97316");

  return {
    id: "warm",
    name: "Warm Template",
    description: "Centered design with warm orange/amber gradients and glow effects",
    fabricJSON: {
      version: "6.0.0",
      objects: [
        // Background gradient
        {
          id: generateObjectId("background"),
          type: "rect",
          version: "6.0.0",
          originX: "left",
          originY: "top",
          left: 0,
          top: 0,
          width: 2160,
          height: 2160,
          fill: {
            type: "linear",
            coords: { x1: 0, y1: 0, x2: 2160, y2: 2160 },
            colorStops: [
              { offset: 0, color: primary },
              { offset: 0.4, color: `${primary}f0` },
              { offset: 1, color: `${secondary}dd` },
            ],
          },
          selectable: false,
          evented: false,
        },
        // Warm glow
        {
          id: generateObjectId("circle"),
          type: "circle",
          version: "6.0.0",
          originX: "left",
          originY: "top",
          left: 1500,
          top: -200,
          radius: 400,
          fill: "rgba(255, 255, 255, 0.15)",
          selectable: false,
          evented: false,
        },
        // Top badge background
        {
          id: generateObjectId("rect"),
          type: "rect",
          version: "6.0.0",
          originX: "center",
          originY: "top",
          left: 1080,
          top: 200,
          width: 700,
          height: 120,
          fill: "rgba(255, 255, 255, 0.15)",
          rx: 60,
          ry: 60,
        },
        // Logo placeholder
        {
          id: generateObjectId("logo"),
          type: "rect",
          version: "6.0.0",
          originX: "center",
          originY: "center",
          left: 850,
          top: 260,
          width: 100,
          height: 100,
          fill: "rgba(255, 255, 255, 0.95)",
          rx: 20,
          ry: 20,
          shadow: {
            color: "rgba(0, 0, 0, 0.2)",
            blur: 15,
            offsetX: 0,
            offsetY: 5,
          },
        },
        // Restaurant name
        {
          id: "restaurant-name",
          type: "textbox",
          version: "6.0.0",
          originX: "left",
          originY: "center",
          left: 920,
          top: 260,
          width: 500,
          text: restaurantName,
          fontSize: 52,
          fontFamily: "Inter, system-ui, sans-serif",
          fontWeight: "bold",
          fill: "#ffffff",
          textAlign: "left",
          editable: true,
        },
        // Gift circle
        {
          id: generateObjectId("circle"),
          type: "circle",
          version: "6.0.0",
          originX: "center",
          originY: "center",
          left: 1080,
          top: 650,
          radius: 125,
          fill: "rgba(255, 255, 255, 0.2)",
          shadow: {
            color: "rgba(0, 0, 0, 0.15)",
            blur: 25,
            offsetX: 0,
            offsetY: 10,
          },
        },
        // Gift icon
        {
          id: generateObjectId("text"),
          type: "textbox",
          version: "6.0.0",
          originX: "center",
          originY: "center",
          left: 1080,
          top: 650,
          width: 150,
          text: "ðŸŽ",
          fontSize: 100,
          textAlign: "center",
        },
        // Headline
        {
          id: "poster-headline",
          type: "textbox",
          version: "6.0.0",
          originX: "center",
          originY: "top",
          left: 1080,
          top: 850,
          width: 1800,
          text: headline || "Special Offer Available",
          fontSize: 120,
          fontFamily: "Inter, system-ui, sans-serif",
          fontWeight: "900",
          fill: "#ffffff",
          textAlign: "center",
          lineHeight: 1.1,
          editable: true,
          shadow: {
            color: "rgba(0, 0, 0, 0.2)",
            blur: 15,
            offsetX: 0,
            offsetY: 5,
          },
        },
        // Offer card
        {
          id: generateObjectId("rect"),
          type: "rect",
          version: "6.0.0",
          originX: "center",
          originY: "center",
          left: 1080,
          top: 1300,
          width: 850,
          height: 280,
          fill: "rgba(255, 255, 255, 0.95)",
          rx: 35,
          ry: 35,
          shadow: {
            color: "rgba(0, 0, 0, 0.3)",
            blur: 50,
            offsetX: 0,
            offsetY: 20,
          },
        },
        // "GET" label
        {
          id: generateObjectId("text"),
          type: "textbox",
          version: "6.0.0",
          originX: "center",
          originY: "top",
          left: 1080,
          top: 1200,
          width: 700,
          text: "GET",
          fontSize: 36,
          fontFamily: "Inter, system-ui, sans-serif",
          fontWeight: "bold",
          fill: "#6b7280",
          textAlign: "center",
        },
        // Offer amount
        {
          id: "offer-label",
          type: "textbox",
          version: "6.0.0",
          originX: "center",
          originY: "center",
          left: 1080,
          top: 1300,
          width: 800,
          text: offerLabel || "20% OFF",
          fontSize: 100,
          fontFamily: "Inter, system-ui, sans-serif",
          fontWeight: "900",
          fill: "#1f2937",
          textAlign: "center",
          editable: true,
        },
        // Expiry
        {
          id: "expiry-date",
          type: "textbox",
          version: "6.0.0",
          originX: "center",
          originY: "top",
          left: 1080,
          top: 1530,
          width: 900,
          text: `ðŸ“… Valid until ${expiresOn}`,
          fontSize: 40,
          fontFamily: "Inter, system-ui, sans-serif",
          fontWeight: "bold",
          fill: "#ffffff",
          textAlign: "center",
          editable: true,
        },
        // Terms card
        {
          id: generateObjectId("rect"),
          type: "rect",
          version: "6.0.0",
          originX: "left",
          originY: "top",
          left: 200,
          top: 1750,
          width: 1760,
          height: 260,
          fill: "rgba(255, 255, 255, 0.85)",
          rx: 30,
          ry: 30,
          shadow: {
            color: "rgba(0, 0, 0, 0.15)",
            blur: 30,
            offsetX: 0,
            offsetY: 10,
          },
        },
        // Terms
        {
          id: "terms-text",
          type: "textbox",
          version: "6.0.0",
          originX: "center",
          originY: "center",
          left: 1080,
          top: 1880,
          width: 1600,
          text: terms || "Valid on orders above Rs.600. Cannot be combined with other offers.",
          fontSize: 30,
          fontFamily: "Inter, system-ui, sans-serif",
          fontWeight: "600",
          fill: "#1f2937",
          textAlign: "center",
          lineHeight: 1.4,
          editable: true,
          shadow: {
            color: "rgba(255, 255, 255, 0.5)",
            blur: 8,
            offsetX: 0,
            offsetY: 1,
          },
        },
      ],
    },
    variables: {
      restaurantName: {
        objectId: "restaurant-name",
        property: "text",
        defaultValue: restaurantName,
      },
      headline: {
        objectId: "poster-headline",
        property: "text",
        defaultValue: headline,
      },
      offerLabel: {
        objectId: "offer-label",
        property: "text",
        defaultValue: offerLabel,
      },
      expiresOn: {
        objectId: "expiry-date",
        property: "text",
        defaultValue: `ðŸ“… Valid until ${expiresOn}`,
      },
      terms: {
        objectId: "terms-text",
        property: "text",
        defaultValue: terms,
      },
    },
  };
}

/**
 * MINIMAL TEMPLATE - Clean dark design with subtle accents
 */
export function createMinimalTemplate(
  config: FabricTemplateConfig
): FabricTemplate {
  const {
    restaurantName,
    primaryColor,
    secondaryColor,
    headline,
    offerLabel,
    expiresOn,
    terms,
  } = config;

  const primary = safeHex(primaryColor, "#8b5cf6");

  return {
    id: "minimal",
    name: "Minimal Template",
    description: "Clean, elegant dark design with subtle accent glows",
    fabricJSON: {
      version: "6.0.0",
      objects: [
        // Solid dark background
        {
          id: generateObjectId("background"),
          type: "rect",
          version: "6.0.0",
          originX: "left",
          originY: "top",
          left: 0,
          top: 0,
          width: 2160,
          height: 2160,
          fill: "#0a0a0a",
          selectable: false,
          evented: false,
        },
        // Accent glow
        {
          id: generateObjectId("circle"),
          type: "circle",
          version: "6.0.0",
          originX: "left",
          originY: "top",
          left: 1700,
          top: 200,
          radius: 350,
          fill: primary,
          opacity: 0.1,
          selectable: false,
          evented: false,
        },
        // Logo placeholder
        {
          id: generateObjectId("logo"),
          type: "rect",
          version: "6.0.0",
          originX: "left",
          originY: "top",
          left: 200,
          top: 200,
          width: 110,
          height: 110,
          fill: primary,
          rx: 20,
          ry: 20,
          shadow: {
            color: "rgba(0, 0, 0, 0.4)",
            blur: 20,
            offsetX: 0,
            offsetY: 8,
          },
        },
        // Restaurant name
        {
          id: "restaurant-name",
          type: "textbox",
          version: "6.0.0",
          originX: "left",
          originY: "center",
          left: 340,
          top: 255,
          width: 700,
          text: restaurantName,
          fontSize: 56,
          fontFamily: "Inter, system-ui, sans-serif",
          fontWeight: "bold",
          fill: "#ffffff",
          textAlign: "left",
          editable: true,
        },
        // Accent line
        {
          id: generateObjectId("rect"),
          type: "rect",
          version: "6.0.0",
          originX: "left",
          originY: "top",
          left: 1750,
          top: 245,
          width: 210,
          height: 12,
          fill: primary,
          rx: 6,
          ry: 6,
        },
        // Headline
        {
          id: "poster-headline",
          type: "textbox",
          version: "6.0.0",
          originX: "left",
          originY: "top",
          left: 200,
          top: 650,
          width: 1500,
          text: headline || "Special Offer Available",
          fontSize: 130,
          fontFamily: "Inter, system-ui, sans-serif",
          fontWeight: "900",
          fill: "#ffffff",
          textAlign: "left",
          lineHeight: 1.1,
          editable: true,
        },
        // Offer card background
        {
          id: generateObjectId("rect"),
          type: "rect",
          version: "6.0.0",
          originX: "left",
          originY: "top",
          left: 200,
          top: 1350,
          width: 1760,
          height: 300,
          fill: "rgba(255, 255, 255, 0.05)",
          stroke: "rgba(255, 255, 255, 0.1)",
          strokeWidth: 2,
          rx: 50,
          ry: 50,
          shadow: {
            color: "rgba(0, 0, 0, 0.5)",
            blur: 40,
            offsetX: 0,
            offsetY: 20,
          },
        },
        // "SPECIAL OFFER" label
        {
          id: generateObjectId("text"),
          type: "textbox",
          version: "6.0.0",
          originX: "left",
          originY: "top",
          left: 250,
          top: 1400,
          width: 500,
          text: "SPECIAL OFFER",
          fontSize: 34,
          fontFamily: "Inter, system-ui, sans-serif",
          fontWeight: "bold",
          fill: "#9ca3af",
          textAlign: "left",
        },
        // Offer amount
        {
          id: "offer-label",
          type: "textbox",
          version: "6.0.0",
          originX: "left",
          originY: "top",
          left: 250,
          top: 1480,
          width: 1000,
          text: offerLabel || "20% OFF",
          fontSize: 110,
          fontFamily: "Inter, system-ui, sans-serif",
          fontWeight: "900",
          fill: primary,
          textAlign: "left",
          editable: true,
        },
        // Expiry
        {
          id: "expiry-date",
          type: "textbox",
          version: "6.0.0",
          originX: "left",
          originY: "top",
          left: 250,
          top: 1600,
          width: 800,
          text: `ðŸ“… Valid until ${expiresOn}`,
          fontSize: 38,
          fontFamily: "Inter, system-ui, sans-serif",
          fontWeight: "600",
          fill: "#d1d5db",
          textAlign: "left",
          editable: true,
        },
        // Terms card
        {
          id: generateObjectId("rect"),
          type: "rect",
          version: "6.0.0",
          originX: "left",
          originY: "top",
          left: 200,
          top: 1750,
          width: 1760,
          height: 260,
          fill: "rgba(255, 255, 255, 0.12)",
          stroke: "rgba(255, 255, 255, 0.2)",
          strokeWidth: 2,
          rx: 30,
          ry: 30,
        },
        // Terms
        {
          id: "terms-text",
          type: "textbox",
          version: "6.0.0",
          originX: "center",
          originY: "center",
          left: 1080,
          top: 1880,
          width: 1600,
          text: terms || "Valid on orders above Rs.600. Cannot be combined with other offers.",
          fontSize: 30,
          fontFamily: "Inter, system-ui, sans-serif",
          fontWeight: "600",
          fill: "#e5e7eb",
          textAlign: "center",
          lineHeight: 1.4,
          editable: true,
        },
      ],
    },
    variables: {
      restaurantName: {
        objectId: "restaurant-name",
        property: "text",
        defaultValue: restaurantName,
      },
      headline: {
        objectId: "poster-headline",
        property: "text",
        defaultValue: headline,
      },
      offerLabel: {
        objectId: "offer-label",
        property: "text",
        defaultValue: offerLabel,
      },
      expiresOn: {
        objectId: "expiry-date",
        property: "text",
        defaultValue: `ðŸ“… Valid until ${expiresOn}`,
      },
      terms: {
        objectId: "terms-text",
        property: "text",
        defaultValue: terms,
      },
    },
  };
}

/**
 * TICKET TEMPLATE - Split panel design with ticket-style right side
 */
export function createTicketTemplate(
  config: FabricTemplateConfig
): FabricTemplate {
  const {
    restaurantName,
    primaryColor,
    secondaryColor,
    headline,
    offerLabel,
    expiresOn,
    terms,
  } = config;

  const primary = safeHex(primaryColor, "#3b82f6");

  return {
    id: "ticket",
    name: "Ticket Template",
    description: "Split design with dark left panel and white ticket-style right panel",
    fabricJSON: {
      version: "6.0.0",
      objects: [
        // Base background
        {
          id: generateObjectId("background"),
          type: "rect",
          version: "6.0.0",
          originX: "left",
          originY: "top",
          left: 0,
          top: 0,
          width: 2160,
          height: 2160,
          fill: {
            type: "linear",
            coords: { x1: 0, y1: 0, x2: 0, y2: 2160 },
            colorStops: [
              { offset: 0, color: "#1f2937" },
              { offset: 1, color: "#111827" },
            ],
          },
          selectable: false,
          evented: false,
        },
        // Left panel
        {
          id: generateObjectId("rect"),
          type: "rect",
          version: "6.0.0",
          originX: "left",
          originY: "top",
          left: 80,
          top: 80,
          width: 800,
          height: 2000,
          fill: {
            type: "linear",
            coords: { x1: 0, y1: 0, x2: 0, y2: 2000 },
            colorStops: [
              { offset: 0, color: "#374151" },
              { offset: 1, color: "#1f2937" },
            ],
          },
          rx: 40,
          ry: 40,
        },
        // Logo placeholder (left panel)
        {
          id: generateObjectId("logo"),
          type: "rect",
          version: "6.0.0",
          originX: "left",
          originY: "top",
          left: 180,
          top: 180,
          width: 120,
          height: 120,
          fill: primary,
          rx: 24,
          ry: 24,
          shadow: {
            color: "rgba(0, 0, 0, 0.4)",
            blur: 20,
            offsetX: 0,
            offsetY: 8,
          },
        },
        // Restaurant name (left panel)
        {
          id: "restaurant-name",
          type: "textbox",
          version: "6.0.0",
          originX: "left",
          originY: "center",
          left: 330,
          top: 240,
          width: 450,
          text: restaurantName,
          fontSize: 52,
          fontFamily: "Inter, system-ui, sans-serif",
          fontWeight: "bold",
          fill: "#ffffff",
          textAlign: "left",
          editable: true,
        },
        // Accent line (left panel)
        {
          id: generateObjectId("rect"),
          type: "rect",
          version: "6.0.0",
          originX: "left",
          originY: "top",
          left: 180,
          top: 380,
          width: 160,
          height: 12,
          fill: primary,
          rx: 6,
          ry: 6,
        },
        // Headline (left panel)
        {
          id: "poster-headline",
          type: "textbox",
          version: "6.0.0",
          originX: "left",
          originY: "top",
          left: 180,
          top: 800,
          width: 620,
          text: headline || "Special Offer Available",
          fontSize: 100,
          fontFamily: "Inter, system-ui, sans-serif",
          fontWeight: "900",
          fill: "#ffffff",
          textAlign: "left",
          lineHeight: 1.1,
          editable: true,
        },
        // Right panel (white ticket)
        {
          id: generateObjectId("rect"),
          type: "rect",
          version: "6.0.0",
          originX: "left",
          originY: "top",
          left: 990,
          top: 180,
          width: 1000,
          height: 1800,
          fill: "#ffffff",
          rx: 40,
          ry: 40,
          shadow: {
            color: "rgba(0, 0, 0, 0.3)",
            blur: 60,
            offsetX: -20,
            offsetY: 20,
          },
        },
        // Perforation circles (12 circles)
        ...Array.from({ length: 12 }, (_, i) => ({
          id: generateObjectId("circle"),
          type: "circle",
          version: "6.0.0",
          originX: "center",
          originY: "center",
          left: 990,
          top: 320 + i * 140,
          radius: 22,
          fill: "#1f2937",
          selectable: false,
          evented: false,
        })),
        // Gift circle
        {
          id: generateObjectId("circle"),
          type: "circle",
          version: "6.0.0",
          originX: "center",
          originY: "center",
          left: 1490,
          top: 550,
          radius: 100,
          fill: `${primary}15`,
        },
        // Gift icon
        {
          id: generateObjectId("text"),
          type: "textbox",
          version: "6.0.0",
          originX: "center",
          originY: "center",
          left: 1490,
          top: 550,
          width: 120,
          text: "ðŸŽ",
          fontSize: 90,
          textAlign: "center",
        },
        // "GET" label
        {
          id: generateObjectId("text"),
          type: "textbox",
          version: "6.0.0",
          originX: "center",
          originY: "top",
          left: 1490,
          top: 720,
          width: 700,
          text: "GET",
          fontSize: 28,
          fontFamily: "Inter, system-ui, sans-serif",
          fontWeight: "bold",
          fill: "#6b7280",
          textAlign: "center",
        },
        // Offer amount
        {
          id: "offer-label",
          type: "textbox",
          version: "6.0.0",
          originX: "center",
          originY: "top",
          left: 1490,
          top: 830,
          width: 800,
          text: offerLabel || "20% OFF",
          fontSize: 100,
          fontFamily: "Inter, system-ui, sans-serif",
          fontWeight: "900",
          fill: primary,
          textAlign: "center",
          editable: true,
        },
        // Minimum order badge
        {
          id: generateObjectId("rect"),
          type: "rect",
          version: "6.0.0",
          originX: "center",
          originY: "top",
          left: 1490,
          top: 1000,
          width: 650,
          height: 70,
          fill: primary,
          rx: 35,
          ry: 35,
        },
        // Minimum order text
        {
          id: generateObjectId("text"),
          type: "textbox",
          version: "6.0.0",
          originX: "center",
          originY: "center",
          left: 1490,
          top: 1035,
          width: 620,
          text: "on orders above Rs.600",
          fontSize: 28,
          fontFamily: "Inter, system-ui, sans-serif",
          fontWeight: "bold",
          fill: "#ffffff",
          textAlign: "center",
        },
        // Divider 1
        {
          id: generateObjectId("rect"),
          type: "rect",
          version: "6.0.0",
          originX: "left",
          originY: "top",
          left: 1140,
          top: 1140,
          width: 700,
          height: 3,
          fill: `${primary}30`,
        },
        // Expiry
        {
          id: "expiry-date",
          type: "textbox",
          version: "6.0.0",
          originX: "center",
          originY: "top",
          left: 1490,
          top: 1230,
          width: 700,
          text: `ðŸ“… Valid until ${expiresOn}`,
          fontSize: 34,
          fontFamily: "Inter, system-ui, sans-serif",
          fontWeight: "600",
          fill: "#374151",
          textAlign: "center",
          editable: true,
        },
        // Divider 2
        {
          id: generateObjectId("rect"),
          type: "rect",
          version: "6.0.0",
          originX: "left",
          originY: "top",
          left: 1140,
          top: 1330,
          width: 700,
          height: 3,
          fill: `${primary}30`,
        },
        // Terms
        {
          id: "terms-text",
          type: "textbox",
          version: "6.0.0",
          originX: "center",
          originY: "center",
          left: 1490,
          top: 1550,
          width: 750,
          text: terms || "Valid on orders above Rs.600. Cannot be combined with other offers.",
          fontSize: 26,
          fontFamily: "Inter, system-ui, sans-serif",
          fill: "#6b7280",
          textAlign: "center",
          lineHeight: 1.4,
          editable: true,
        },
      ],
    },
    variables: {
      restaurantName: {
        objectId: "restaurant-name",
        property: "text",
        defaultValue: restaurantName,
      },
      headline: {
        objectId: "poster-headline",
        property: "text",
        defaultValue: headline,
      },
      offerLabel: {
        objectId: "offer-label",
        property: "text",
        defaultValue: offerLabel,
      },
      expiresOn: {
        objectId: "expiry-date",
        property: "text",
        defaultValue: `ðŸ“… Valid until ${expiresOn}`,
      },
      terms: {
        objectId: "terms-text",
        property: "text",
        defaultValue: terms,
      },
    },
  };
}

/**
 * Get template colors by template ID
 */
export function getTemplateColors(
  templateId: CampaignPosterTemplate,
  colors: typeof TEMPLATE_COLORS
): { primary: string; secondary: string } {
  return colors[templateId] || colors.fresh;
}

/**
 * Apply variable updates to a template
 */
export function applyTemplateVariables(
  template: FabricTemplate,
  updates: Record<string, unknown>
): FabricTemplate {
  const updatedObjects = template.fabricJSON.objects.map((obj) => {
    // Find if this object has any variables
    const variableEntries = Object.entries(template.variables).filter(
      ([, variable]) => variable.objectId === obj.id
    );

    if (variableEntries.length === 0) return obj;

    // Apply updates for this object
    const updatedObj = { ...obj };
    variableEntries.forEach(([varKey, variable]) => {
      if (varKey in updates) {
        updatedObj[variable.property] = updates[varKey];
      }
    });

    return updatedObj;
  });

  return {
    ...template,
    fabricJSON: {
      ...template.fabricJSON,
      objects: updatedObjects,
    },
  };
}

