import type { CampaignPosterTemplate } from "@/lib/growth/campaign-studio";

export const templateColors: Record<CampaignPosterTemplate, { primary: string; secondary: string }> = {
  fresh: { primary: "#047857", secondary: "#10b981" },
  warm: { primary: "#f59e0b", secondary: "#fb923c" },
  minimal: { primary: "#8b5cf6", secondary: "#a78bfa" },
  ticket: { primary: "#3b82f6", secondary: "#60a5fa" },
  premium: { primary: "#c9a227", secondary: "#f2d98c" },
  grid: { primary: "#4338ca", secondary: "#6366f1" },
  bold: { primary: "#dc2626", secondary: "#f87171" },
  elegant: { primary: "#6366f1", secondary: "#818cf8" },
  modern: { primary: "#0891b2", secondary: "#22d3ee" },
  luxury: { primary: "#a855f7", secondary: "#d946ef" },
  vibrant: { primary: "#f97316", secondary: "#fbbf24" },
  sunset: { primary: "#ec4899", secondary: "#f97316" },
  ocean: { primary: "#0ea5e9", secondary: "#06b6d4" },
  forest: { primary: "#059669", secondary: "#10b981" },
  royal: { primary: "#7c3aed", secondary: "#a78bfa" },
  neon: { primary: "#22c55e", secondary: "#84cc16" },
  pastel: { primary: "#f472b6", secondary: "#fb923c" },
  midnight: { primary: "#1e293b", secondary: "#475569" },
  coral: { primary: "#fb7185", secondary: "#fda4af" },
  mint: { primary: "#34d399", secondary: "#6ee7b7" },
  crimson: { primary: "#be123c", secondary: "#e11d48" },
  slate: { primary: "#64748b", secondary: "#94a3b8" },
  amber: { primary: "#d97706", secondary: "#f59e0b" },
  teal: { primary: "#0d9488", secondary: "#14b8a6" },
  lavender: { primary: "#c084fc", secondary: "#e9d5ff" },
  rose: { primary: "#f43f5e", secondary: "#fb7185" },
  emerald: { primary: "#10b981", secondary: "#34d399" },
  sapphire: { primary: "#2563eb", secondary: "#3b82f6" },
  bronze: { primary: "#92400e", secondary: "#b45309" },
  ruby: { primary: "#9f1239", secondary: "#be123c" },
  platinum: { primary: "#71717a", secondary: "#a1a1aa" },
  gold: { primary: "#ca8a04", secondary: "#eab308" },
  minimalist: { primary: "#000000", secondary: "#333333" },
  geometric: { primary: "#2563eb", secondary: "#7c3aed" },
  artistic: { primary: "#ec4899", secondary: "#8b5cf6" },
  expressive: { primary: "#dc2626", secondary: "#ea580c" },
  maximalist: { primary: "#7c3aed", secondary: "#ec4899" },
};

export function safeHex(value?: string | null): string | null {
  return value && /^#[0-9a-f]{6}$/i.test(value) ? value : null;
}

// Shared styles for all templates.
// baseFont: clean sans body copy — reuses the Inter face already loaded
// app-wide (see app/layout.tsx, --font-inter on <body>), so no extra font
// load is needed here.
// headlineFont: elegant serif for the poster's emphasis text (restaurant
// name, headline, offer amount) — Playfair Display, loaded locally via
// poster-templates/fonts.ts since it isn't used anywhere else in the app.
// Matches the "premium" font treatment used in the campaign email templates
// (frontend/lib/growth/email-poster-html.ts).
export const baseFont = "var(--font-inter), -apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif";
export const headlineFont = "var(--font-playfair), Georgia, 'Times New Roman', serif";

// Strong text shadow for white text visibility on any background
export const whiteTextShadow = {
  textShadow: "0 2px 8px rgba(0,0,0,0.6), 0 1px 3px rgba(0,0,0,0.8)"
};

// Shared text constraint styles for ensuring content fits within poster bounds
export const textConstraints = {
  wordBreak: "break-word" as const,
  overflowWrap: "break-word" as const,
  hyphens: "auto" as const,
  maxWidth: "100%" as const,
};

export const clampedTextStyles = (lines: number) => ({
  ...textConstraints,
  // Removed line-clamp to allow all text to be visible
  // Text will wrap naturally based on font size and container width
});

// Common props interface for all template components
export interface TemplateProps {
  restaurantName: string;
  logoUrl?: string | null;
  primaryColor: string;
  palette: { primary: string; secondary: string };
  headline: string;
  offerLabel: string;
  expiresOn: string;
  terms: string;
  fixedSize: boolean;
  logo: string;
  initials: string;
}

// Helper to get size classes and styles
export function getSizeConfig(fixedSize: boolean) {
  const sizeClasses = fixedSize 
    ? "relative rounded-3xl overflow-hidden" 
    : "relative rounded-3xl overflow-hidden w-full aspect-square";
  const sizeStyles = fixedSize
    ? { width: "600px", height: "600px" }
    : { maxWidth: "600px" };
  
  return { sizeClasses, sizeStyles };
}
