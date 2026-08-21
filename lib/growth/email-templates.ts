/**
 * Premium email template catalog for Grow campaign emails.
 *
 * Deliberately separate from `CampaignPosterTemplate` (37 WhatsApp poster
 * color themes in ./campaign-studio) — email needs a curated set of
 * genuinely different LAYOUTS, not a large set of same-layout color
 * variants. Each id here maps to one hand-built HTML email under
 * ./email-template-renderers/.
 */

export type EmailTemplateCategory =
  | "Clean & Minimal"
  | "Bold & Expressive"
  | "Elegant & Refined"
  | "Warm & Character"
  | "Conversion & Offers"
  | "Relationship & Content"
  | "Modern Trends (2026)"
  | "Nepali Cultural";

export type CampaignEmailTemplate =
  // Clean & Minimal
  | "minimalist"
  | "modern"
  | "flat-design"
  | "professional"
  | "corporate"
  | "monochromatic"
  | "ultra-minimal"
  // Bold & Expressive
  | "maximalist"
  | "bold"
  | "brutalist"
  | "futuristic"
  | "glassmorphism"
  | "neomorphism"
  | "dimensional"
  | "collage"
  | "asymmetric"
  | "bold-typography"
  // Elegant & Refined
  | "luxury"
  | "elegant"
  | "editorial"
  | "vintage"
  | "art-deco"
  | "dark-mode"
  // Warm & Character
  | "playful"
  | "organic"
  | "pastel"
  | "retro"
  | "seasonal"
  | "festival"
  // Conversion & Offers
  | "promotional"
  | "conversion-focused"
  | "flash-sale"
  | "product-showcase"
  | "announcement"
  | "countdown-urgency"
  // Relationship & Content
  | "newsletter"
  | "storytelling"
  | "personalized"
  | "restaurant-menu"
  | "invitation"
  | "thank-you"
  | "story-timeline"
  // Modern Trends (2026)
  | "gradient-hero"
  | "card-stack"
  | "split-screen"
  | "social-proof"
  | "photo-grid"
  | "reward-milestone"
  // Nepali Cultural
  | "dashain-red"
  | "tihar-lights"
  | "mandala-harmony"
  | "himalayan-peaks"
  | "rangoli-pattern";

export interface EmailTemplateDefinition {
  id: CampaignEmailTemplate;
  label: string;
  category: EmailTemplateCategory;
  tagline: string;
  description: string;
  /** Selector swatch — communicates the design identity at a glance. */
  swatch: {
    bg: string;
    accent: string;
    text: string;
    /** hints the swatch's sample glyph */
    font: "serif" | "sans" | "mono" | "display";
  };
}

export const EMAIL_TEMPLATE_DEFINITIONS: readonly EmailTemplateDefinition[] = [
  // ---------------------------------------------------------------------
  // Clean & Minimal
  // ---------------------------------------------------------------------
  {
    id: "minimalist",
    label: "Minimalist",
    category: "Clean & Minimal",
    tagline: "Clean & spacious",
    description: "Large whitespace, one hero image, a single quiet link. Apple / Stripe simplicity.",
    swatch: { bg: "#ffffff", accent: "#111111", text: "#111111", font: "sans" },
  },
  {
    id: "modern",
    label: "Modern",
    category: "Clean & Minimal",
    tagline: "SaaS-polished",
    description: "Clean cards, subtle shadows, balanced whitespace, a confident rounded CTA.",
    swatch: { bg: "#f8fafc", accent: "#6366f1", text: "#0f172a", font: "sans" },
  },
  {
    id: "flat-design",
    label: "Flat Design",
    category: "Clean & Minimal",
    tagline: "Graphic & simple",
    description: "Flat colors, simple shapes, no gradients or heavy shadows — modern graphic design.",
    swatch: { bg: "#ffffff", accent: "#ef4444", text: "#1f2937", font: "sans" },
  },
  {
    id: "professional",
    label: "Professional",
    category: "Clean & Minimal",
    tagline: "Structured & trustworthy",
    description: "Strong grid, clear sections, restrained color — built for business communication.",
    swatch: { bg: "#f8fafc", accent: "#1d4ed8", text: "#0f172a", font: "sans" },
  },
  {
    id: "corporate",
    label: "Corporate",
    category: "Clean & Minimal",
    tagline: "Formal & structured",
    description: "Conservative typography, clear information blocks — enterprise-grade communication.",
    swatch: { bg: "#ffffff", accent: "#334155", text: "#1e293b", font: "sans" },
  },
  {
    id: "monochromatic",
    label: "Monochromatic",
    category: "Clean & Minimal",
    tagline: "One color, many tones",
    description: "Built entirely from shades of your brand color, with strong tonal hierarchy.",
    swatch: { bg: "#f5f3ff", accent: "#6d28d9", text: "#2e1065", font: "sans" },
  },

  // ---------------------------------------------------------------------
  // Bold & Expressive
  // ---------------------------------------------------------------------
  {
    id: "maximalist",
    label: "Maximalist",
    category: "Bold & Expressive",
    tagline: "Rich & expressive",
    description: "Layered sections, bold color, multiple images — high-energy creative campaign.",
    swatch: { bg: "#fef08a", accent: "#db2777", text: "#1e1b4b", font: "display" },
  },
  {
    id: "bold",
    label: "Bold",
    category: "Bold & Expressive",
    tagline: "High-impact promotion",
    description: "Huge headline, strong contrast, one giant CTA — what, why, and what to do next.",
    swatch: { bg: "#000000", accent: "#facc15", text: "#ffffff", font: "display" },
  },
  {
    id: "brutalist",
    label: "Brutalist",
    category: "Bold & Expressive",
    tagline: "Raw & unconventional",
    description: "Huge type, sharp borders, unexpected alignment — intentionally raw, not broken.",
    swatch: { bg: "#ffffff", accent: "#ff0000", text: "#000000", font: "mono" },
  },
  {
    id: "futuristic",
    label: "Futuristic",
    category: "Bold & Expressive",
    tagline: "Premium & experimental",
    description: "Dark background, sparing neon accents, geometric layout — premium, not gaming.",
    swatch: { bg: "#05060a", accent: "#22d3ee", text: "#e2e8f0", font: "mono" },
  },
  {
    id: "glassmorphism",
    label: "Glassmorphism",
    category: "Bold & Expressive",
    tagline: "Layered & translucent",
    description: "Soft gradients and layered, translucent-looking cards — email-safe, no blur.",
    swatch: { bg: "#eef2ff", accent: "#818cf8", text: "#312e81", font: "sans" },
  },
  {
    id: "neomorphism",
    label: "Neomorphism",
    category: "Bold & Expressive",
    tagline: "Soft & dimensional",
    description: "Soft raised and recessed sections on a muted background — gentle contrast.",
    swatch: { bg: "#e8ecf1", accent: "#64748b", text: "#334155", font: "sans" },
  },
  {
    id: "dimensional",
    label: "3D / Dimensional",
    category: "Bold & Expressive",
    tagline: "Depth & layers",
    description: "Overlapping cards and strong shadows create real visual depth around the hero.",
    swatch: { bg: "#111827", accent: "#f59e0b", text: "#f9fafb", font: "sans" },
  },
  {
    id: "collage",
    label: "Collage",
    category: "Bold & Expressive",
    tagline: "Creative image mix",
    description: "Multiple images at different sizes with type layered around them — editorial energy.",
    swatch: { bg: "#fff7ed", accent: "#ea580c", text: "#431407", font: "sans" },
  },
  {
    id: "asymmetric",
    label: "Asymmetric",
    category: "Bold & Expressive",
    tagline: "Unconventional balance",
    description: "Unequal columns and offset imagery, intentional and balanced despite the tilt.",
    swatch: { bg: "#f8f7f4", accent: "#0f766e", text: "#134e4a", font: "sans" },
  },

  // ---------------------------------------------------------------------
  // Elegant & Refined
  // ---------------------------------------------------------------------
  {
    id: "luxury",
    label: "Luxury",
    category: "Elegant & Refined",
    tagline: "Editorial elegance",
    description: "Large hero image, serif type, minimal color — for a high-end restaurant feel.",
    swatch: { bg: "#faf8f4", accent: "#9a7b3f", text: "#1c1917", font: "serif" },
  },
  {
    id: "elegant",
    label: "Elegant",
    category: "Elegant & Refined",
    tagline: "Soft & boutique",
    description: "Softer than Luxury — thin borders, spacious layout, gentle neutral palette.",
    swatch: { bg: "#faf7f2", accent: "#b08968", text: "#3f3a34", font: "serif" },
  },
  {
    id: "editorial",
    label: "Editorial",
    category: "Elegant & Refined",
    tagline: "Magazine composition",
    description: "Asymmetric masthead, pull-quote offer, stacked sections — sophisticated.",
    swatch: { bg: "#fbfaf7", accent: "#b3452c", text: "#1a1a1a", font: "serif" },
  },
  {
    id: "vintage",
    label: "Vintage",
    category: "Elegant & Refined",
    tagline: "Classic & timeless",
    description: "Traditional type, muted colors, classic borders — a heritage restaurant feel.",
    swatch: { bg: "#f2ead9", accent: "#7c6a4f", text: "#3d3423", font: "serif" },
  },
  {
    id: "art-deco",
    label: "Art Deco",
    category: "Elegant & Refined",
    tagline: "Geometric luxury",
    description: "Symmetry, thin lines, gold accents — 1920s luxury meets modern email design.",
    swatch: { bg: "#0d1b1e", accent: "#c9a34e", text: "#f2e8cf", font: "serif" },
  },
  {
    id: "dark-mode",
    label: "Dark Mode",
    category: "Elegant & Refined",
    tagline: "Cinematic night-out",
    description: "Near-black background, image overlay, high contrast, jewel accent.",
    swatch: { bg: "#0a0a0b", accent: "#d4af37", text: "#f5f0e6", font: "serif" },
  },

  // ---------------------------------------------------------------------
  // Warm & Character
  // ---------------------------------------------------------------------
  {
    id: "playful",
    label: "Playful",
    category: "Warm & Character",
    tagline: "Fun & friendly",
    description: "Bright controlled color, rounded shapes, energetic CTA — cafes and casual spots.",
    swatch: { bg: "#fff1f5", accent: "#fb7185", text: "#831843", font: "sans" },
  },
  {
    id: "organic",
    label: "Organic",
    category: "Warm & Character",
    tagline: "Natural & fresh",
    description: "Earthy colors, soft curves, natural photography — farm-to-table, healthy food.",
    swatch: { bg: "#f5f1e6", accent: "#5b7553", text: "#2e3a26", font: "sans" },
  },
  {
    id: "pastel",
    label: "Pastel",
    category: "Warm & Character",
    tagline: "Soft & gentle",
    description: "Soft colors, gentle backgrounds, light typography — bakeries, brunch, dessert.",
    swatch: { bg: "#fdf4ff", accent: "#c4b5fd", text: "#581c87", font: "sans" },
  },
  {
    id: "retro",
    label: "Retro",
    category: "Warm & Character",
    tagline: "Nostalgic poster",
    description: "Vintage-inspired type and color combinations, poster-style headline treatment.",
    swatch: { bg: "#f4e9d8", accent: "#d9480f", text: "#3a2618", font: "display" },
  },
  {
    id: "seasonal",
    label: "Seasonal",
    category: "Warm & Character",
    tagline: "Adapts to the moment",
    description: "A flexible template that leans on imagery and accent color to set the season.",
    swatch: { bg: "#eef6ee", accent: "#16a34a", text: "#14532d", font: "sans" },
  },
  {
    id: "festival",
    label: "Festival",
    category: "Warm & Character",
    tagline: "Dashain · Tihar · New Year",
    description: "Warm maroon and gold, ornate dividers — festive without looking childish.",
    swatch: { bg: "#3a0d12", accent: "#e0a840", text: "#fbe9c6", font: "serif" },
  },

  // ---------------------------------------------------------------------
  // Conversion & Offers
  // ---------------------------------------------------------------------
  {
    id: "promotional",
    label: "Promotional",
    category: "Conversion & Offers",
    tagline: "Offer, immediately",
    description: "Strong headline, big offer card, bold CTA — built for straightforward promotions.",
    swatch: { bg: "#f1f5f9", accent: "#ea580c", text: "#0f172a", font: "sans" },
  },
  {
    id: "conversion-focused",
    label: "Conversion-Focused",
    category: "Conversion & Offers",
    tagline: "One path, one action",
    description: "Hero → value → offer → benefits → CTA. No distractions, strong CTA hierarchy.",
    swatch: { bg: "#ffffff", accent: "#16a34a", text: "#052e16", font: "sans" },
  },
  {
    id: "flash-sale",
    label: "Flash Sale",
    category: "Conversion & Offers",
    tagline: "Urgent, high-conversion",
    description: "Huge discount numeral, countdown-style expiry strip, no-nonsense CTA.",
    swatch: { bg: "#18120d", accent: "#ff4d29", text: "#fff4ec", font: "display" },
  },
  {
    id: "product-showcase",
    label: "Product Showcase",
    category: "Conversion & Offers",
    tagline: "Food as the hero",
    description: "Large product photography with name, price, and description — a launch template.",
    swatch: { bg: "#fafaf9", accent: "#a16207", text: "#292524", font: "sans" },
  },
  {
    id: "announcement",
    label: "Announcement",
    category: "Conversion & Offers",
    tagline: "News, clearly stated",
    description: "Huge headline, short message, one CTA — new menu, new branch, new hours.",
    swatch: { bg: "#eff6ff", accent: "#2563eb", text: "#1e3a8a", font: "sans" },
  },

  // ---------------------------------------------------------------------
  // Relationship & Content
  // ---------------------------------------------------------------------
  {
    id: "newsletter",
    label: "Newsletter",
    category: "Relationship & Content",
    tagline: "Multi-section update",
    description: "Featured story, featured offer, and secondary content blocks in one digest.",
    swatch: { bg: "#ffffff", accent: "#0f172a", text: "#1e293b", font: "sans" },
  },
  {
    id: "storytelling",
    label: "Storytelling",
    category: "Relationship & Content",
    tagline: "Visual narrative",
    description: "Introduction → story → offer → benefits → CTA, told as a progression, not one block.",
    swatch: { bg: "#fdf6ec", accent: "#b45309", text: "#451a03", font: "serif" },
  },
  {
    id: "personalized",
    label: "Personalized",
    category: "Relationship & Content",
    tagline: "A message, not an ad",
    description: "Warm, name-led copy that reads like it's from the owner, not a broadcast system.",
    swatch: { bg: "#fff9f5", accent: "#f97316", text: "#431407", font: "sans" },
  },
  {
    id: "restaurant-menu",
    label: "Restaurant Menu",
    category: "Relationship & Content",
    tagline: "Digital menu card",
    description: "Food cards with names, prices, and images — feels like a premium digital menu.",
    swatch: { bg: "#fffaf0", accent: "#b91c1c", text: "#292524", font: "serif" },
  },
  {
    id: "invitation",
    label: "Invitation",
    category: "Relationship & Content",
    tagline: "Elegant event card",
    description: "Centered composition, event details, and an RSVP CTA — openings, tastings, VIP nights.",
    swatch: { bg: "#101014", accent: "#d4af37", text: "#f5f0e6", font: "serif" },
  },
  {
    id: "thank-you",
    label: "Thank You",
    category: "Relationship & Content",
    tagline: "Warm appreciation",
    description: "A short, personal thank-you with a soft CTA — loyalty and post-visit follow-up.",
    swatch: { bg: "#fef2f2", accent: "#e11d48", text: "#4c0519", font: "serif" },
  },

  // ---------------------------------------------------------------------
  // Modern Trends (2026)
  // ---------------------------------------------------------------------
  {
    id: "gradient-hero",
    label: "Gradient Hero",
    category: "Modern Trends (2026)",
    tagline: "Modern vibrant gradient",
    description: "Email-safe gradient background with white card overlay — major 2026 trend for restaurants.",
    swatch: { bg: "#f59e0b", accent: "#ec4899", text: "#ffffff", font: "sans" },
  },
  {
    id: "card-stack",
    label: "Card Stack",
    category: "Modern Trends (2026)",
    tagline: "Mobile-first cards",
    description: "Stacked card layout optimized for mobile — digestible sections with smooth scrolling.",
    swatch: { bg: "#fafafa", accent: "#8b5cf6", text: "#18181b", font: "sans" },
  },
  {
    id: "split-screen",
    label: "Split Screen",
    category: "Modern Trends (2026)",
    tagline: "Dual-column hero",
    description: "50/50 image and content split — high-converting layout that showcases food photography.",
    swatch: { bg: "#ffffff", accent: "#0891b2", text: "#111827", font: "sans" },
  },
  {
    id: "countdown-urgency",
    label: "Countdown Urgency",
    category: "Modern Trends (2026)",
    tagline: "Time-sensitive timer",
    description: "Urgency-driven design with countdown visual — proven to boost immediate conversions.",
    swatch: { bg: "#fff1f2", accent: "#dc2626", text: "#991b1b", font: "display" },
  },
  {
    id: "social-proof",
    label: "Social Proof",
    category: "Modern Trends (2026)",
    tagline: "Testimonial-focused",
    description: "5-star reviews and customer testimonials front and center — builds trust instantly.",
    swatch: { bg: "#ffffff", accent: "#059669", text: "#111827", font: "sans" },
  },
  {
    id: "photo-grid",
    label: "Photo Grid",
    category: "Modern Trends (2026)",
    tagline: "Instagram-style showcase",
    description: "3-image grid layout perfect for food photography — engaging visual feast.",
    swatch: { bg: "#fafafa", accent: "#c026d3", text: "#18181b", font: "sans" },
  },
  {
    id: "reward-milestone",
    label: "Reward Milestone",
    category: "Modern Trends (2026)",
    tagline: "Gamification progress",
    description: "Progress bar and milestone visualization — loyalty program engagement driver.",
    swatch: { bg: "#faf5ff", accent: "#7c3aed", text: "#3b0764", font: "sans" },
  },
  {
    id: "ultra-minimal",
    label: "Ultra Minimal",
    category: "Modern Trends (2026)",
    tagline: "Maximum whitespace",
    description: "Premium minimalist with extreme whitespace — Apple-level sophistication.",
    swatch: { bg: "#ffffff", accent: "#171717", text: "#171717", font: "serif" },
  },
  {
    id: "bold-typography",
    label: "Bold Typography",
    category: "Modern Trends (2026)",
    tagline: "Type-driven impact",
    description: "Massive typography on dark background — arresting attention with pure type hierarchy.",
    swatch: { bg: "#0a0a0a", accent: "#eab308", text: "#ffffff", font: "display" },
  },
  {
    id: "story-timeline",
    label: "Story Timeline",
    category: "Modern Trends (2026)",
    tagline: "Progressive narrative",
    description: "Visual steps with timeline connectors — guides customers through their journey.",
    swatch: { bg: "#f8fafc", accent: "#0284c7", text: "#0c4a6e", font: "sans" },
  },

  // ---------------------------------------------------------------------
  // Nepali Cultural
  // ---------------------------------------------------------------------
  {
    id: "dashain-red",
    label: "Dashain Red",
    category: "Nepali Cultural",
    tagline: "Crimson tika tradition",
    description: "Nepal's biggest festival with crimson red and deep blue from the national flag. Traditional tika-inspired design.",
    swatch: { bg: "#fff8f0", accent: "#c41e3a", text: "#5c3317", font: "serif" },
  },
  {
    id: "tihar-lights",
    label: "Tihar Lights",
    category: "Nepali Cultural",
    tagline: "Festival of lights",
    description: "Marigold orange with diyo (oil lamp) patterns. Celebrates Nepal's festival of lights with warm glowing colors.",
    swatch: { bg: "#2d1810", accent: "#ff9933", text: "#ffd700", font: "sans" },
  },
  {
    id: "mandala-harmony",
    label: "Mandala Harmony",
    category: "Nepali Cultural",
    tagline: "Sacred geometry",
    description: "Circular mandala patterns inspired by Nepali thangka art. Blue for wisdom, red for transformation, gold accents.",
    swatch: { bg: "#fefbf3", accent: "#1e40af", text: "#78350f", font: "serif" },
  },
  {
    id: "himalayan-peaks",
    label: "Himalayan Peaks",
    category: "Nepali Cultural",
    tagline: "Mountain majesty",
    description: "Mountain peak silhouettes with Nepal flag colors (crimson and deep blue). Represents permanence and strength.",
    swatch: { bg: "#f8fafc", accent: "#003893", text: "#c41e3a", font: "sans" },
  },
  {
    id: "rangoli-pattern",
    label: "Rangoli Pattern",
    category: "Nepali Cultural",
    tagline: "Colorful floor art",
    description: "Vibrant dots and patterns inspired by rangoli decorations during Tihar. Multiple sacred colors in harmony.",
    swatch: { bg: "#ffffff", accent: "#ec4899", text: "#1f2937", font: "sans" },
  },
] as const;

export const EMAIL_TEMPLATE_CATEGORIES: readonly EmailTemplateCategory[] = [
  "Clean & Minimal",
  "Bold & Expressive",
  "Elegant & Refined",
  "Warm & Character",
  "Conversion & Offers",
  "Relationship & Content",
  "Modern Trends (2026)",
  "Nepali Cultural",
];

export const DEFAULT_EMAIL_TEMPLATE: CampaignEmailTemplate = "modern";

export function getEmailTemplateDefinition(
  id: CampaignEmailTemplate | undefined,
): EmailTemplateDefinition {
  return (
    EMAIL_TEMPLATE_DEFINITIONS.find((definition) => definition.id === id) ??
    EMAIL_TEMPLATE_DEFINITIONS.find((definition) => definition.id === DEFAULT_EMAIL_TEMPLATE)!
  );
}
