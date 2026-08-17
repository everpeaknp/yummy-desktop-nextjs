/**
 * Premium campaign email design system.
 *
 * 38 genuinely different layouts (see ./email-templates.ts for the full
 * catalog + selector metadata), organized into four family files under
 * ./email-template-renderers/ so no single file becomes unmanageable:
 *   - foundational.ts   minimalist, maximalist, modern, luxury, editorial,
 *                       bold, elegant, playful
 *   - business.ts        professional, corporate, brutalist, organic,
 *                       futuristic, retro, vintage, art-deco
 *   - visual-style.ts    monochromatic, pastel, dark-mode, glassmorphism,
 *                       neomorphism, flat-design, dimensional, collage,
 *                       asymmetric
 *   - purpose.ts         promotional, conversion-focused, product-showcase,
 *                       announcement, newsletter, storytelling, festival,
 *                       seasonal, flash-sale, personalized, restaurant-menu,
 *                       invitation, thank-you
 *
 * Every renderer in those files is built from the shared primitives exported
 * below (document shell, CTA button, footer, hero image, divider, badge,
 * price block, two-column table) — the "same content system, different
 * visual personality" principle: shared plumbing, bespoke structure.
 *
 * Mirrors backend/app/utils/grow_email_template.py for the original 8
 * identities (luxury, modern->promotional, minimal->minimalist,
 * dark->dark-mode, fresh->organic, flash->flash-sale, editorial, festival).
 * The 30 newly added templates exist only in this frontend preview for now
 * — the real send path does not yet forward which template was chosen at
 * all (see growth_campaign_delivery_service.py), so porting 30 more designs
 * into Python ahead of that plumbing being built would be speculative work.
 */

import type { CampaignEmailTemplate } from "./email-templates";
import * as foundational from "./email-template-renderers/foundational";
import * as business from "./email-template-renderers/business";
import * as visualStyle from "./email-template-renderers/visual-style";
import * as purpose from "./email-template-renderers/purpose";

export interface EmailPosterOptions {
  template?: CampaignEmailTemplate;
  restaurantName: string;
  logoUrl?: string;
  primaryColor?: string;
  // Shown as the big headline text. Mirrors the backend's real send
  // (growth_campaign_delivery_service.py passes the campaign's resolved
  // email subject as `headline`) — wiring the studio's Email subject field
  // in here keeps this preview honest about what the headline actually is.
  headline?: string;
  // Secondary body copy — sourced from the Studio's "Email body (HTML)"
  // field. Optional; templates that use it render it as plain text.
  description?: string;
  discountType: "percentage" | "flat_amount";
  value: number;
  percentageCap?: number | null;
  minimumOrderValue?: number | null;
  validUntil?: string | null;
  couponCode?: string;
  terms?: string;
  // Real menu/food photography for the hero. Optional — every template
  // that wants a hero degrades to a designed placeholder panel when absent
  // rather than an empty gap.
  heroImageUrl?: string;
  // From the restaurant's brand profile (approved_contact_text /
  // approved_footer_text). Optional — footer degrades to a generic line.
  contactText?: string;
  footerText?: string;
  // Optional strike-through pricing for Promotional/Product Showcase style
  // templates. No campaign data source captures menu-item pricing today —
  // when absent, those templates fall back to the standard discount summary.
  originalPrice?: number;
  offerPrice?: number;
  // Optional footer social links. No data source captures these yet;
  // templates that render them simply omit the row when the array is empty.
  socialLinks?: { label: string; url: string }[];
  // Freeform event details for the Invitation template (date/time/location
  // as one block — there's no structured event field in the campaign model).
  eventDetails?: string;
}

export const HEADLINE_FONT = "'Playfair Display', Georgia, 'Times New Roman', serif";
export const BODY_FONT = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif";
export const GOOGLE_FONTS_LINK =
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;1,600&family=Inter:wght@400;500;600;700;800&family=Bebas+Neue&family=Space+Mono:wght@400;700&display=swap">';

// Shared responsive rules, included in every layout's <head>. Real media
// queries are required for stacking columns on mobile — inline styles
// alone can't do it. Supported by Apple Mail, iOS/Android Gmail app,
// Outlook.com/mobile, Yahoo; ignored by Outlook desktop, which falls back
// to the desktop layout (same tradeoff every gradient/shadow here makes).
export const RESPONSIVE_STYLE = `<style>
  @media only screen and (max-width: 600px) {
    .yg-container { width: 100% !important; }
    .yg-stack { display: block !important; width: 100% !important; box-sizing: border-box !important; }
    .yg-stack-gap { padding-top: 20px !important; }
    .yg-h1 { font-size: 26px !important; line-height: 1.25 !important; }
    .yg-h2 { font-size: 30px !important; }
    .yg-h3 { font-size: 22px !important; }
    .yg-hero { height: 200px !important; }
    .yg-pad { padding: 20px !important; }
    .yg-pad-sm { padding: 16px !important; }
    .yg-col3 { display: block !important; width: 100% !important; box-sizing: border-box !important; padding-bottom: 12px !important; }
  }
</style>`;

// ---------------------------------------------------------------------------
// Shared primitives — every layout in every family file is built from these.
// ---------------------------------------------------------------------------

export function esc(value: string | undefined | null): string {
  if (!value) return "";
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function escAttr(value: string | undefined | null): string {
  return esc(value).replace(/'/g, "&#39;");
}

export function nl2br(value: string | undefined | null): string {
  if (!value) return "";
  return esc(value).replace(/\n/g, "<br>");
}

export function formatAmount(amount: number): string {
  return `Rs. ${amount.toLocaleString("en-NP", { maximumFractionDigits: 0 })}`;
}

export function formatOfferSummary(options: EmailPosterOptions): string {
  const { discountType, value, percentageCap, minimumOrderValue } = options;
  let summary = discountType === "percentage" ? `${value}% off` : `${formatAmount(value)} off`;
  if (discountType === "percentage" && percentageCap) {
    summary += ` (max ${formatAmount(percentageCap)})`;
  }
  if (minimumOrderValue) {
    summary += ` on orders above ${formatAmount(minimumOrderValue)}`;
  }
  return summary;
}

/** Just the numeral/percentage part, for templates that want it huge and standalone. */
export function formatOfferHeadline(options: EmailPosterOptions): string {
  return options.discountType === "percentage" ? `${options.value}%` : formatAmount(options.value);
}

export function formatValidUntil(validUntil: string | null | undefined): string {
  if (!validUntil) return "";
  try {
    return new Date(validUntil).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return validUntil;
  }
}

/** Full HTML document shell — every layout renders its body content into this. */
export function shell(opts: { title: string; bg: string; bodyStyle?: string; content: string }): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(opts.title)}</title>
  ${GOOGLE_FONTS_LINK}
  ${RESPONSIVE_STYLE}
</head>
<body style="margin: 0; padding: 0; font-family: ${BODY_FONT}; background: ${opts.bg};${opts.bodyStyle ? ` ${opts.bodyStyle}` : ""}">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: ${opts.bg}; padding: 8px 0;">
    <tr>
      <td align="center">
${opts.content}
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** A shared footer row — appended via wrapFooterRow() into a template's outer table. */
export function footerBlock(opts: {
  restaurantName: string;
  contactText?: string;
  footerText?: string;
  socialLinks?: { label: string; url: string }[];
  textColor: string;
  linkColor: string;
  padding?: string;
}): string {
  const line =
    opts.footerText ||
    `You're receiving this because you opted in to offers from ${esc(opts.restaurantName)} on Yummy.`;
  const social =
    opts.socialLinks && opts.socialLinks.length > 0
      ? `<p style="margin: 0 0 6px 0; font-size: 12px;">${opts.socialLinks
          .map((s) => `<a href="${escAttr(s.url)}" style="color: ${opts.linkColor}; text-decoration: underline; margin: 0 6px;">${esc(s.label)}</a>`)
          .join(" · ")}</p>`
      : "";
  return `<tr>
  <td style="padding: ${opts.padding ?? "18px 12px 4px"}; text-align: center;">
    <p style="margin: 0 0 6px 0; font-size: 12px; line-height: 1.6; color: ${opts.textColor};">${opts.footerText ? esc(opts.footerText) : line}</p>
    ${opts.contactText ? `<p style="margin: 0 0 6px 0; font-size: 12px; color: ${opts.textColor};">${esc(opts.contactText)}</p>` : ""}
    ${social}
    <p style="margin: 0; font-size: 11px;"><a href="{{unsubscribe_url}}" style="color: ${opts.linkColor}; text-decoration: underline;">Unsubscribe</a></p>
  </td>
</tr>`;
}

/**
 * Appends the shared footer row into a template's outer <table>…</table>
 * string right before its closing tag, so each layout doesn't hand-roll
 * table nesting for it.
 */
export function wrapFooterRow(
  tableHtml: string,
  restaurantName: string,
  contactText: string | undefined,
  footerText: string | undefined,
  textColor: string,
  linkColor: string,
  socialLinks?: { label: string; url: string }[],
): string {
  const row = footerBlock({ restaurantName, contactText, footerText, socialLinks, textColor, linkColor });
  const closeIdx = tableHtml.lastIndexOf("</table>");
  if (closeIdx === -1) return tableHtml;
  return `${tableHtml.slice(0, closeIdx)}${row}${tableHtml.slice(closeIdx)}`;
}

/** A hero image, or a designed placeholder panel when no real photo is available. */
export function heroImage(opts: {
  url?: string;
  height?: number;
  radius?: string;
  fallbackBg: string;
  fallbackContent?: string;
}): string {
  const height = opts.height ?? 260;
  if (opts.url) {
    return `<img src="${escAttr(opts.url)}" alt="" class="yg-hero" style="display: block; width: 100%; height: ${height}px; object-fit: cover;${opts.radius ? ` border-radius: ${opts.radius};` : ""}">`;
  }
  return `<div class="yg-hero" style="height: ${height}px;${opts.radius ? ` border-radius: ${opts.radius};` : ""} background: ${opts.fallbackBg}; display: flex; align-items: center; justify-content: center;">${opts.fallbackContent ?? ""}</div>`;
}

/** A thin horizontal rule in one of a few email-safe styles. */
export function divider(opts: { color: string; style?: "solid" | "dashed" | "dotted"; margin?: string; width?: string }): string {
  return `<div style="width: ${opts.width ?? "100%"}; border-top: 1px ${opts.style ?? "solid"} ${opts.color}; margin: ${opts.margin ?? "20px auto"};"></div>`;
}

/** A small rounded/pill label — used for eyebrows, urgency tags, category chips. */
export function badge(opts: { label: string; bg: string; color: string; radius?: string; border?: string }): string {
  return `<span style="display: inline-block; padding: 5px 14px; background: ${opts.bg}; color: ${opts.color}; border-radius: ${opts.radius ?? "999px"}; font-family: ${BODY_FONT}; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;${opts.border ? ` border: ${opts.border};` : ""}">${esc(opts.label)}</span>`;
}

/** Original (strikethrough) + offer price. Falls back to nothing if neither price is given by the caller. */
export function priceBlock(opts: { original?: number; offer?: number; accent: string; size?: number }): string {
  const size = opts.size ?? 34;
  if (opts.original == null || opts.offer == null) return "";
  return `<p style="margin: 0; font-family: ${BODY_FONT};">
    <span style="font-size: ${Math.round(size * 0.55)}px; color: #94a3b8; text-decoration: line-through; margin-right: 10px;">${formatAmount(opts.original)}</span>
    <span style="font-size: ${size}px; font-weight: 800; color: ${opts.accent};">${formatAmount(opts.offer)}</span>
  </p>`;
}

/** Responsive two-column table (stacks on mobile via .yg-stack). */
export function twoColumn(opts: {
  left: string;
  right: string;
  leftWidth?: string;
  rightWidth?: string;
  valign?: string;
}): string {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>
    <td width="${opts.leftWidth ?? "50%"}" class="yg-stack" style="vertical-align: ${opts.valign ?? "top"};">${opts.left}</td>
    <td width="${opts.rightWidth ?? "50%"}" class="yg-stack yg-stack-gap" style="vertical-align: ${opts.valign ?? "top"};">${opts.right}</td>
  </tr></table>`;
}

/** Three-across card row (menu items, collage tiles) — stacks to one column on mobile. */
export function threeColumn(cells: string[]): string {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>
    ${cells.map((cell) => `<td width="${Math.floor(100 / cells.length)}%" class="yg-col3" style="vertical-align: top; padding: 0 6px;">${cell}</td>`).join("")}
  </tr></table>`;
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

const RENDERERS: Record<CampaignEmailTemplate, (options: EmailPosterOptions) => string> = {
  // Foundational
  minimalist: foundational.renderMinimalist,
  maximalist: foundational.renderMaximalist,
  modern: foundational.renderModern,
  luxury: foundational.renderLuxury,
  editorial: foundational.renderEditorial,
  bold: foundational.renderBold,
  elegant: foundational.renderElegant,
  playful: foundational.renderPlayful,
  // Business & character
  professional: business.renderProfessional,
  corporate: business.renderCorporate,
  brutalist: business.renderBrutalist,
  organic: business.renderOrganic,
  futuristic: business.renderFuturistic,
  retro: business.renderRetro,
  vintage: business.renderVintage,
  "art-deco": business.renderArtDeco,
  // Visual style / interface-inspired
  monochromatic: visualStyle.renderMonochromatic,
  pastel: visualStyle.renderPastel,
  "dark-mode": visualStyle.renderDarkMode,
  glassmorphism: visualStyle.renderGlassmorphism,
  neomorphism: visualStyle.renderNeomorphism,
  "flat-design": visualStyle.renderFlatDesign,
  dimensional: visualStyle.renderDimensional,
  collage: visualStyle.renderCollage,
  asymmetric: visualStyle.renderAsymmetric,
  // Purpose-driven
  promotional: purpose.renderPromotional,
  "conversion-focused": purpose.renderConversionFocused,
  "product-showcase": purpose.renderProductShowcase,
  announcement: purpose.renderAnnouncement,
  newsletter: purpose.renderNewsletter,
  storytelling: purpose.renderStorytelling,
  festival: purpose.renderFestival,
  seasonal: purpose.renderSeasonal,
  "flash-sale": purpose.renderFlashSale,
  personalized: purpose.renderPersonalized,
  "restaurant-menu": purpose.renderRestaurantMenu,
  invitation: purpose.renderInvitation,
  "thank-you": purpose.renderThankYou,
};

export function renderPosterStyleEmailHtml(options: EmailPosterOptions): string {
  const template = options.template ?? "modern";
  const render = RENDERERS[template] ?? RENDERERS.modern;
  return render(options);
}
