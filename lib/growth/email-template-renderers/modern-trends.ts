/**
 * Modern email template renderers (2026 trends) — gradient backgrounds,
 * mobile-first layouts, food photography focus, and high-conversion patterns
 * optimized specifically for restaurant marketing.
 *
 * Based on 2026 research:
 * - Gradient backgrounds (major trend)
 * - Dark mode optimization (default on iOS/Gmail)
 * - Mobile-first (320px mobile, 600px desktop)
 * - Bold hero banners with food photography
 * - Card-based stacked layouts
 * - Countdown/urgency elements
 * - Social proof integration
 * - Gamification/reward progress
 *
 * Content rephrased for compliance with licensing restrictions.
 * Sources: Klaviyo, Designmodo, Mailmodo, GetResponse (2025-2026)
 */

import type { EmailPosterOptions } from "../email-poster-html";
import {
  BODY_FONT,
  HEADLINE_FONT,
  esc,
  escAttr,
  nl2br,
  formatAmount,
  formatOfferSummary,
  formatOfferHeadline,
  formatValidUntil,
  shell,
  wrapFooterRow,
  heroImage,
  divider,
  badge,
} from "../email-poster-html";

// ---------------------------------------------------------------------------
// Gradient Hero — Modern vibrant gradient background (2026 major trend)
// ---------------------------------------------------------------------------
export function renderGradientHero(options: EmailPosterOptions): string {
  const { restaurantName, logoUrl, headline, description, couponCode, terms, heroImageUrl, contactText, footerText } = options;
  const accent = options.primaryColor || "#f59e0b";
  const offerSummary = formatOfferSummary(options);
  const expiry = formatValidUntil(options.validUntil);
  // Email-safe gradient: solid fallback for Outlook
  const gradient = `linear-gradient(135deg, ${accent} 0%, #ec4899 100%)`;

  let table = `        <table role="presentation" width="600" class="yg-container" cellspacing="0" cellpadding="0" style="width: 600px; max-width: 600px; background: ${accent}; background: ${gradient};">
          <tr><td class="yg-pad" style="padding: 40px 36px 0; text-align: center;">
            ${logoUrl ? `<img src="${escAttr(logoUrl)}" alt="" style="display: block; margin: 0 auto 16px; width: 40px; height: 40px; border-radius: 50%; object-fit: cover; border: 3px solid rgba(255,255,255,0.3);">` : ""}
            <p style="margin: 0 0 20px; font-family: ${BODY_FONT}; font-size: 12px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; color: rgba(255,255,255,0.9);">${esc(restaurantName)}</p>
            <h1 class="yg-h1" style="margin: 0; font-family: ${HEADLINE_FONT}; font-size: 40px; font-weight: 700; line-height: 1.2; color: #ffffff; text-shadow: 0 2px 8px rgba(0,0,0,0.2);">${esc(headline) || "Something special awaits"}</h1>
            ${description ? `<p style="margin: 16px 0 0; font-family: ${BODY_FONT}; font-size: 15px; line-height: 1.7; color: rgba(255,255,255,0.95);">${nl2br(description)}</p>` : ""}
          </td></tr>
          ${heroImageUrl ? `<tr><td style="padding: 30px 36px 0;">${heroImage({ url: heroImageUrl, height: 280, radius: "16px", fallbackBg: "" })}</td></tr>` : ""}
          <tr><td style="padding: 30px 36px 0;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #ffffff; border-radius: 16px; box-shadow: 0 8px 20px rgba(0,0,0,0.15);"><tr><td class="yg-pad" style="padding: 28px 30px; text-align: center;">
              <p style="margin: 0 0 14px; font-family: ${BODY_FONT}; font-size: 18px; font-weight: 700; color: #1f2937;">${esc(offerSummary)}</p>
              ${expiry ? `<p style="margin: 0 0 16px; font-family: ${BODY_FONT}; font-size: 12px; color: #6b7280;">Valid until ${esc(expiry)}</p>` : ""}
              <div style="display: inline-block; background: #fef3c7; border: 2px dashed ${accent}; border-radius: 10px; padding: 14px 28px;">
                <p style="margin: 0 0 4px; font-family: ${BODY_FONT}; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #78350f;">Use Code</p>
                <p style="margin: 0; font-family: 'Courier New', monospace; font-size: 22px; font-weight: 700; letter-spacing: 0.12em; color: ${accent};">${esc(couponCode) || "YUMMY100"}</p>
              </div>
            </td></tr></table>
          </td></tr>
          ${terms ? `<tr><td style="padding: 24px 36px 36px; text-align: center;"><p style="margin: 0; font-family: ${BODY_FONT}; font-size: 11px; line-height: 1.6; color: rgba(255,255,255,0.85);">${nl2br(terms)}</p></td></tr>` : `<tr><td style="padding: 0 0 20px;"></td></tr>`}
        </table>`;

  table = wrapFooterRow(table, restaurantName, options.restaurantAddress, contactText, footerText, "#9ca3af", accent, options.socialLinks);
  return shell({ title: `${restaurantName} - Special offer`, bg: "#f3f4f6", content: table });
}

// ---------------------------------------------------------------------------
// Card Stack — Mobile-optimized stacked card layout
// ---------------------------------------------------------------------------
export function renderCardStack(options: EmailPosterOptions): string {
  const { restaurantName, logoUrl, headline, description, couponCode, terms, heroImageUrl, contactText, footerText } = options;
  const accent = options.primaryColor || "#8b5cf6";
  const offerSummary = formatOfferSummary(options);
  const expiry = formatValidUntil(options.validUntil);

  let table = `        <table role="presentation" width="600" class="yg-container" cellspacing="0" cellpadding="0" style="width: 600px; max-width: 600px; background: #fafafa;">
          <tr><td style="padding: 24px 20px 0;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #ffffff; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);"><tr><td style="padding: 24px 24px 0;">
              ${logoUrl ? `<img src="${escAttr(logoUrl)}" alt="" style="width: 32px; height: 32px; border-radius: 8px; object-fit: cover; margin-bottom: 12px;">` : ""}
              <p style="margin: 0 0 6px; font-family: ${BODY_FONT}; font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: ${accent};">${esc(restaurantName)}</p>
              <h1 class="yg-h1" style="margin: 0; font-family: ${HEADLINE_FONT}; font-size: 28px; font-weight: 700; line-height: 1.25; color: #18181b;">${esc(headline) || "We have something for you"}</h1>
              ${description ? `<p style="margin: 12px 0 0; font-family: ${BODY_FONT}; font-size: 14px; line-height: 1.7; color: #52525b;">${nl2br(description)}</p>` : ""}
            </td></tr>
            ${heroImageUrl ? `<tr><td style="padding: 20px 24px 0;">${heroImage({ url: heroImageUrl, height: 220, radius: "10px", fallbackBg: "" })}</td></tr>` : ""}
            </table>
          </td></tr>
          <tr><td style="padding: 16px 20px 0;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: ${accent}; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);"><tr><td style="padding: 24px; text-align: center;">
              <p style="margin: 0 0 8px; font-family: ${BODY_FONT}; font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(255,255,255,0.85);">Your exclusive offer</p>
              <p style="margin: 0 0 14px; font-family: ${HEADLINE_FONT}; font-size: 24px; font-weight: 700; color: #ffffff;">${esc(offerSummary)}</p>
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto;"><tr><td style="padding: 12px 24px; background: #ffffff; border-radius: 8px;">
                <span style="font-family: 'Courier New', monospace; font-size: 18px; font-weight: 700; letter-spacing: 0.12em; color: ${accent};">${esc(couponCode) || "SAVE20"}</span>
              </td></tr></table>
              ${expiry ? `<p style="margin: 12px 0 0; font-family: ${BODY_FONT}; font-size: 11px; color: rgba(255,255,255,0.9);">Valid until ${esc(expiry)}</p>` : ""}
            </td></tr></table>
          </td></tr>
          ${terms ? `<tr><td style="padding: 20px 24px 0;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #ffffff; border-radius: 12px;"><tr><td style="padding: 16px 20px;"><p style="margin: 0; font-family: ${BODY_FONT}; font-size: 11px; line-height: 1.6; color: #71717a;">${nl2br(terms)}</p></td></tr></table></td></tr>` : ""}
        </table>`;

  table = wrapFooterRow(table, restaurantName, options.restaurantAddress, contactText, footerText, "#a1a1aa", accent, options.socialLinks);
  return shell({ title: `${restaurantName} - Offer for you`, bg: "#fafafa", content: table });
}

// ---------------------------------------------------------------------------
// Split Screen — Dual-column hero with 50/50 image/content split
// ---------------------------------------------------------------------------
export function renderSplitScreen(options: EmailPosterOptions): string {
  const { restaurantName, logoUrl, headline, description, couponCode, terms, heroImageUrl, contactText, footerText } = options;
  const accent = options.primaryColor || "#0891b2";
  const offerSummary = formatOfferSummary(options);
  const expiry = formatValidUntil(options.validUntil);

  let table = `        <table role="presentation" width="600" class="yg-container" cellspacing="0" cellpadding="0" style="width: 600px; max-width: 600px; background: #ffffff;">
          <tr><td>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>
              ${heroImageUrl ? `<td width="50%" class="yg-stack" style="vertical-align: top;">${heroImage({ url: heroImageUrl, height: 360, radius: "0", fallbackBg: accent })}</td>` : ""}
              <td width="${heroImageUrl ? "50%" : "100%"}" class="yg-stack yg-stack-gap" style="vertical-align: middle; background: #fafafa;">
                <div style="padding: 40px 32px;">
                  ${logoUrl ? `<img src="${escAttr(logoUrl)}" alt="" style="width: 36px; height: 36px; border-radius: 8px; object-fit: cover; margin-bottom: 16px;">` : ""}
                  <p style="margin: 0 0 10px; font-family: ${BODY_FONT}; font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: ${accent};">${esc(restaurantName)}</p>
                  <h1 class="yg-h1" style="margin: 0 0 14px; font-family: ${HEADLINE_FONT}; font-size: 30px; font-weight: 700; line-height: 1.2; color: #111827;">${esc(headline) || "Taste the difference"}</h1>
                  ${description ? `<p style="margin: 0 0 20px; font-family: ${BODY_FONT}; font-size: 14px; line-height: 1.7; color: #4b5563;">${nl2br(description)}</p>` : ""}
                  <div style="background: #ffffff; border-radius: 10px; padding: 18px 20px; border: 2px solid ${accent}20;">
                    <p style="margin: 0 0 8px; font-family: ${BODY_FONT}; font-size: 16px; font-weight: 700; color: #1f2937;">${esc(offerSummary)}</p>
                    <p style="margin: 0; font-family: 'Courier New', monospace; font-size: 16px; font-weight: 700; color: ${accent};">${esc(couponCode) || "TREAT50"}</p>
                    ${expiry ? `<p style="margin: 8px 0 0; font-family: ${BODY_FONT}; font-size: 11px; color: #6b7280;">Expires ${esc(expiry)}</p>` : ""}
                  </div>
                </div>
              </td>
            </tr></table>
          </td></tr>
          ${terms ? `<tr><td style="padding: 0 32px 32px; text-align: center;"><p style="margin: 0; font-family: ${BODY_FONT}; font-size: 11px; line-height: 1.6; color: #9ca3af;">${nl2br(terms)}</p></td></tr>` : ""}
        </table>`;

  table = wrapFooterRow(table, restaurantName, options.restaurantAddress, contactText, footerText, "#9ca3af", accent, options.socialLinks);
  return shell({ title: `${restaurantName} - Experience`, bg: "#f9fafb", content: table });
}

// ---------------------------------------------------------------------------
// Countdown Urgency — Time-sensitive offer with urgency indicators
// ---------------------------------------------------------------------------
export function renderCountdownUrgency(options: EmailPosterOptions): string {
  const { restaurantName, logoUrl, headline, description, couponCode, terms, contactText, footerText } = options;
  const accent = options.primaryColor || "#dc2626";
  const offerSummary = formatOfferSummary(options);
  const offerHeadline = formatOfferHeadline(options);
  const expiry = formatValidUntil(options.validUntil);

  let table = `        <table role="presentation" width="600" class="yg-container" cellspacing="0" cellpadding="0" style="width: 600px; max-width: 600px; background: #fff1f2;">
          <tr><td style="padding: 20px 24px; background: ${accent}; text-align: center;">
            ${logoUrl ? `<img src="${escAttr(logoUrl)}" alt="" style="display: inline-block; width: 28px; height: 28px; border-radius: 50%; object-fit: cover; vertical-align: middle; margin-right: 10px;">` : ""}
            <span style="font-family: ${BODY_FONT}; font-size: 13px; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase; color: #ffffff;">${esc(restaurantName)}</span>
          </td></tr>
          <tr><td class="yg-pad" style="padding: 32px 32px 0; text-align: center;">
            ${badge({ label: "⏰ Limited time", bg: `${accent}`, color: "#ffffff", radius: "999px" })}
            <h1 class="yg-h1" style="margin: 18px 0 0; font-family: ${HEADLINE_FONT}; font-size: 48px; font-weight: 800; line-height: 1.1; color: ${accent};">${esc(offerHeadline)}</h1>
            <p style="margin: 10px 0 0; font-family: ${BODY_FONT}; font-size: 18px; font-weight: 700; letter-spacing: 0.02em; text-transform: uppercase; color: #991b1b;">${esc(headline) || "Off today only"}</p>
            ${description ? `<p style="margin: 16px 0 0; font-family: ${BODY_FONT}; font-size: 14px; line-height: 1.7; color: #7f1d1d;">${nl2br(description)}</p>` : ""}
          </td></tr>
          ${expiry ? `<tr><td style="padding: 24px 32px 0;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #ffffff; border: 2px solid ${accent}; border-radius: 12px;"><tr><td style="padding: 16px; text-align: center;">
              <p style="margin: 0 0 4px; font-family: ${BODY_FONT}; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #991b1b;">Offer ends</p>
              <p style="margin: 0; font-family: ${BODY_FONT}; font-size: 20px; font-weight: 800; color: ${accent};">${esc(expiry)}</p>
            </td></tr></table>
          </td></tr>` : ""}
          <tr><td style="padding: 24px 32px 0; text-align: center;">
            <p style="margin: 0 0 12px; font-family: ${BODY_FONT}; font-size: 14px; color: #7f1d1d;">${esc(offerSummary)}</p>
            <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto;"><tr><td style="padding: 16px 32px; background: ${accent}; border-radius: 10px;">
              <span style="font-family: 'Courier New', monospace; font-size: 24px; font-weight: 700; letter-spacing: 0.14em; color: #ffffff;">${esc(couponCode) || "HURRY"}</span>
            </td></tr></table>
          </td></tr>
          ${terms ? `<tr><td style="padding: 24px 32px 32px; text-align: center;"><p style="margin: 0; font-family: ${BODY_FONT}; font-size: 11px; line-height: 1.6; color: #991b1b;">${nl2br(terms)}</p></td></tr>` : `<tr><td style="padding: 0 0 16px;"></td></tr>`}
        </table>`;

  table = wrapFooterRow(table, restaurantName, options.restaurantAddress, contactText, footerText, "#9ca3af", accent, options.socialLinks);
  return shell({ title: `${restaurantName} - Hurry!`, bg: "#fef2f2", content: table });
}

// ---------------------------------------------------------------------------
// Social Proof — Testimonial/review-focused layout
// ---------------------------------------------------------------------------
export function renderSocialProof(options: EmailPosterOptions): string {
  const { restaurantName, logoUrl, headline, description, couponCode, terms, heroImageUrl, contactText, footerText } = options;
  const accent = options.primaryColor || "#059669";
  const offerSummary = formatOfferSummary(options);
  const expiry = formatValidUntil(options.validUntil);

  let table = `        <table role="presentation" width="600" class="yg-container" cellspacing="0" cellpadding="0" style="width: 600px; max-width: 600px; background: #ffffff;">
          <tr><td class="yg-pad" style="padding: 36px 32px 0; text-align: center;">
            ${logoUrl ? `<img src="${escAttr(logoUrl)}" alt="" style="display: block; margin: 0 auto 16px; width: 44px; height: 44px; border-radius: 50%; object-fit: cover;">` : ""}
            <p style="margin: 0 0 8px; font-family: ${BODY_FONT}; font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: ${accent};">${esc(restaurantName)}</p>
            <div style="margin: 0 0 18px;">
              <span style="color: #fbbf24; font-size: 18px;">★★★★★</span>
            </div>
            <h1 class="yg-h1" style="margin: 0; font-family: ${HEADLINE_FONT}; font-size: 32px; font-weight: 700; line-height: 1.3; color: #111827;">${esc(headline) || "Join our happy customers"}</h1>
            ${description ? `<p style="margin: 14px 0 0; font-family: ${BODY_FONT}; font-size: 14px; line-height: 1.7; color: #4b5563;">${nl2br(description)}</p>` : ""}
          </td></tr>
          ${heroImageUrl ? `<tr><td style="padding: 26px 32px 0;">${heroImage({ url: heroImageUrl, height: 240, radius: "12px", fallbackBg: "" })}</td></tr>` : ""}
          <tr><td style="padding: 26px 32px 0;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #f0fdf4; border-left: 4px solid ${accent}; border-radius: 8px;"><tr><td style="padding: 20px 22px;">
              <p style="margin: 0 0 12px; font-family: ${BODY_FONT}; font-size: 13px; font-style: italic; line-height: 1.7; color: #166534;">"Best restaurant in town! The food is amazing and the service is excellent. Highly recommend!"</p>
              <p style="margin: 0; font-family: ${BODY_FONT}; font-size: 11px; font-weight: 600; color: #065f46;">— Sarah M., Regular Customer</p>
            </td></tr></table>
          </td></tr>
          <tr><td style="padding: 26px 32px 0;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #ffffff; border: 2px solid ${accent}30; border-radius: 12px;"><tr><td style="padding: 24px; text-align: center;">
              <p style="margin: 0 0 4px; font-family: ${BODY_FONT}; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #6b7280;">Try it yourself</p>
              <p style="margin: 0 0 14px; font-family: ${BODY_FONT}; font-size: 18px; font-weight: 700; color: #111827;">${esc(offerSummary)}</p>
              <div style="display: inline-block; background: ${accent}; border-radius: 8px; padding: 12px 24px;">
                <span style="font-family: 'Courier New', monospace; font-size: 18px; font-weight: 700; color: #ffffff;">${esc(couponCode) || "WELCOME"}</span>
              </div>
              ${expiry ? `<p style="margin: 12px 0 0; font-family: ${BODY_FONT}; font-size: 11px; color: #6b7280;">Valid until ${esc(expiry)}</p>` : ""}
            </td></tr></table>
          </td></tr>
          ${terms ? `<tr><td style="padding: 24px 32px 32px; text-align: center;"><p style="margin: 0; font-family: ${BODY_FONT}; font-size: 11px; line-height: 1.6; color: #9ca3af;">${nl2br(terms)}</p></td></tr>` : `<tr><td style="padding: 0 0 16px;"></td></tr>`}
        </table>`;

  table = wrapFooterRow(table, restaurantName, options.restaurantAddress, contactText, footerText, "#9ca3af", accent, options.socialLinks);
  return shell({ title: `${restaurantName} - Join us`, bg: "#f9fafb", content: table });
}


// ---------------------------------------------------------------------------
// Photo Grid — Instagram-style food showcase (3-image grid)
// ---------------------------------------------------------------------------
export function renderPhotoGrid(options: EmailPosterOptions): string {
  const { restaurantName, logoUrl, headline, description, couponCode, terms, heroImageUrl, contactText, footerText } = options;
  const accent = options.primaryColor || "#c026d3";
  const offerSummary = formatOfferSummary(options);
  const expiry = formatValidUntil(options.validUntil);
  // Placeholder for additional grid images (using hero as main)
  const gridImages = heroImageUrl ? [heroImageUrl, heroImageUrl, heroImageUrl] : [];

  let table = `        <table role="presentation" width="600" class="yg-container" cellspacing="0" cellpadding="0" style="width: 600px; max-width: 600px; background: #fafafa;">
          <tr><td class="yg-pad" style="padding: 32px 24px 0;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>
              <td>${logoUrl ? `<img src="${escAttr(logoUrl)}" alt="" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover;">` : ""}</td>
              <td align="right"><span style="font-family: ${BODY_FONT}; font-size: 13px; font-weight: 700; color: #18181b;">${esc(restaurantName)}</span></td>
            </tr></table>
          </td></tr>
          <tr><td style="padding: 20px 24px 0; text-align: center;">
            <h1 class="yg-h1" style="margin: 0; font-family: ${HEADLINE_FONT}; font-size: 30px; font-weight: 700; line-height: 1.25; color: #18181b;">${esc(headline) || "Feast your eyes"}</h1>
            ${description ? `<p style="margin: 12px 0 0; font-family: ${BODY_FONT}; font-size: 14px; line-height: 1.7; color: #52525b;">${nl2br(description)}</p>` : ""}
          </td></tr>
          ${gridImages.length === 3 ? `<tr><td style="padding: 24px 24px 0;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>
              <td width="32%" class="yg-col3" style="padding: 0 4px 8px 0;">${heroImage({ url: gridImages[0], height: 160, radius: "10px", fallbackBg: accent })}</td>
              <td width="32%" class="yg-col3" style="padding: 0 4px 8px;">${heroImage({ url: gridImages[1], height: 160, radius: "10px", fallbackBg: `${accent}cc` })}</td>
              <td width="32%" class="yg-col3" style="padding: 0 4px 8px 0;">${heroImage({ url: gridImages[2], height: 160, radius: "10px", fallbackBg: `${accent}99` })}</td>
            </tr></table>
          </td></tr>` : ""}
          <tr><td style="padding: 20px 24px 0;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #ffffff; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.06);"><tr><td style="padding: 24px; text-align: center;">
              <p style="margin: 0 0 14px; font-family: ${BODY_FONT}; font-size: 17px; font-weight: 700; color: #18181b;">${esc(offerSummary)}</p>
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto;"><tr><td style="padding: 12px 26px; background: ${accent}; border-radius: 999px;">
                <span style="font-family: 'Courier New', monospace; font-size: 16px; font-weight: 700; color: #ffffff;">${esc(couponCode) || "SNAP50"}</span>
              </td></tr></table>
              ${expiry ? `<p style="margin: 12px 0 0; font-family: ${BODY_FONT}; font-size: 11px; color: #71717a;">Offer valid until ${esc(expiry)}</p>` : ""}
            </td></tr></table>
          </td></tr>
          ${terms ? `<tr><td style="padding: 20px 28px 24px; text-align: center;"><p style="margin: 0; font-family: ${BODY_FONT}; font-size: 11px; line-height: 1.6; color: #a1a1aa;">${nl2br(terms)}</p></td></tr>` : `<tr><td style="padding: 0 0 12px;"></td></tr>`}
        </table>`;

  table = wrapFooterRow(table, restaurantName, options.restaurantAddress, contactText, footerText, "#a1a1aa", accent, options.socialLinks);
  return shell({ title: `${restaurantName} - Gallery`, bg: "#fafafa", content: table });
}

// ---------------------------------------------------------------------------
// Reward Milestone — Gamification/loyalty progress visualization
// ---------------------------------------------------------------------------
export function renderRewardMilestone(options: EmailPosterOptions): string {
  const { restaurantName, logoUrl, headline, description, couponCode, terms, contactText, footerText } = options;
  const accent = options.primaryColor || "#7c3aed";
  const offerSummary = formatOfferSummary(options);
  const expiry = formatValidUntil(options.validUntil);
  // Progress bar: 75% for demo (would be dynamic in real use)
  const progress = 75;

  let table = `        <table role="presentation" width="600" class="yg-container" cellspacing="0" cellpadding="0" style="width: 600px; max-width: 600px; background: linear-gradient(180deg, #faf5ff 0%, #ffffff 100%);">
          <tr><td class="yg-pad" style="padding: 36px 32px 0; text-align: center;">
            ${logoUrl ? `<img src="${escAttr(logoUrl)}" alt="" style="display: block; margin: 0 auto 16px; width: 48px; height: 48px; border-radius: 50%; object-fit: cover; border: 3px solid ${accent};">` : ""}
            <p style="margin: 0 0 16px; font-family: ${BODY_FONT}; font-size: 12px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: ${accent};">${esc(restaurantName)} Rewards</p>
            <h1 class="yg-h1" style="margin: 0; font-family: ${HEADLINE_FONT}; font-size: 32px; font-weight: 700; line-height: 1.25; color: #3b0764;">${esc(headline) || "You're almost there!"}</h1>
            ${description ? `<p style="margin: 14px 0 0; font-family: ${BODY_FONT}; font-size: 14px; line-height: 1.7; color: #581c87;">${nl2br(description)}</p>` : ""}
          </td></tr>
          <tr><td style="padding: 28px 40px 0;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #ffffff; border-radius: 14px; padding: 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.08);"><tr><td>
              <p style="margin: 0 0 12px; font-family: ${BODY_FONT}; font-size: 13px; font-weight: 600; color: #6b21a8;">Your progress</p>
              <div style="background: #f3e8ff; border-radius: 999px; height: 12px; overflow: hidden;">
                <div style="background: ${accent}; height: 12px; width: ${progress}%; border-radius: 999px;"></div>
              </div>
              <p style="margin: 8px 0 0; font-family: ${BODY_FONT}; font-size: 11px; color: #a855f7; text-align: right;">${progress}% complete</p>
            </td></tr></table>
          </td></tr>
          <tr><td style="padding: 24px 32px 0;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: ${accent}; border-radius: 14px;"><tr><td style="padding: 26px 28px; text-align: center;">
              <p style="margin: 0 0 4px; font-family: ${BODY_FONT}; font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(255,255,255,0.85);">Keep going with</p>
              <p style="margin: 0 0 16px; font-family: ${HEADLINE_FONT}; font-size: 24px; font-weight: 700; color: #ffffff;">${esc(offerSummary)}</p>
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto;"><tr><td style="padding: 12px 24px; background: #ffffff; border-radius: 8px;">
                <span style="font-family: 'Courier New', monospace; font-size: 18px; font-weight: 700; color: ${accent};">${esc(couponCode) || "REWARD"}</span>
              </td></tr></table>
              ${expiry ? `<p style="margin: 12px 0 0; font-family: ${BODY_FONT}; font-size: 11px; color: rgba(255,255,255,0.9);">Use by ${esc(expiry)}</p>` : ""}
            </td></tr></table>
          </td></tr>
          ${terms ? `<tr><td style="padding: 24px 32px 32px; text-align: center;"><p style="margin: 0; font-family: ${BODY_FONT}; font-size: 11px; line-height: 1.6; color: #a855f7;">${nl2br(terms)}</p></td></tr>` : `<tr><td style="padding: 0 0 16px;"></td></tr>`}
        </table>`;

  table = wrapFooterRow(table, restaurantName, options.restaurantAddress, contactText, footerText, "#a855f7", accent, options.socialLinks);
  return shell({ title: `${restaurantName} - Reward progress`, bg: "#faf5ff", content: table });
}

// ---------------------------------------------------------------------------
// Ultra Minimal — Clean premium with maximum whitespace
// ---------------------------------------------------------------------------
export function renderUltraMinimal(options: EmailPosterOptions): string {
  const { restaurantName, headline, description, couponCode, terms, heroImageUrl, contactText, footerText } = options;
  const accent = options.primaryColor || "#171717";
  const offerSummary = formatOfferSummary(options);
  const expiry = formatValidUntil(options.validUntil);

  let table = `        <table role="presentation" width="560" class="yg-container" cellspacing="0" cellpadding="0" style="width: 560px; max-width: 560px; background: #ffffff;">
          <tr><td style="padding: 60px 40px 0; text-align: center;">
            <p style="margin: 0 0 40px; font-family: ${BODY_FONT}; font-size: 11px; font-weight: 500; letter-spacing: 0.3em; text-transform: uppercase; color: #a3a3a3;">${esc(restaurantName)}</p>
            <h1 class="yg-h1" style="margin: 0 auto; max-width: 420px; font-family: ${HEADLINE_FONT}; font-size: 36px; font-weight: 600; line-height: 1.3; color: #171717;">${esc(headline) || "Simple. Elegant. Yours."}</h1>
            ${description ? `<p style="margin: 24px auto 0; max-width: 400px; font-family: ${BODY_FONT}; font-size: 15px; line-height: 1.8; color: #525252;">${nl2br(description)}</p>` : ""}
          </td></tr>
          ${heroImageUrl ? `<tr><td style="padding: 50px 40px 0;">${heroImage({ url: heroImageUrl, height: 300, radius: "0", fallbackBg: "" })}</td></tr>` : ""}
          <tr><td style="padding: 50px 40px 0; text-align: center;">
            <div style="border-top: 1px solid #e5e5e5; border-bottom: 1px solid #e5e5e5; padding: 28px 0;">
              <p style="margin: 0 0 16px; font-family: ${BODY_FONT}; font-size: 14px; color: #737373;">${esc(offerSummary)}</p>
              <p style="margin: 0; font-family: 'Courier New', monospace; font-size: 20px; font-weight: 600; letter-spacing: 0.2em; color: #171717;">${esc(couponCode) || "SIMPLE"}</p>
              ${expiry ? `<p style="margin: 14px 0 0; font-family: ${BODY_FONT}; font-size: 12px; color: #a3a3a3;">Valid through ${esc(expiry)}</p>` : ""}
            </div>
          </td></tr>
          ${terms ? `<tr><td style="padding: 40px 60px 0; text-align: center;"><p style="margin: 0; font-family: ${BODY_FONT}; font-size: 11px; line-height: 1.8; color: #a3a3a3;">${nl2br(terms)}</p></td></tr>` : ""}
        </table>`;

  table = wrapFooterRow(table, restaurantName, options.restaurantAddress, contactText, footerText, "#d4d4d4", accent, options.socialLinks);
  return shell({ title: restaurantName, bg: "#ffffff", content: table });
}

// ---------------------------------------------------------------------------
// Bold Typography — Type-driven high-impact design
// ---------------------------------------------------------------------------
export function renderBoldTypography(options: EmailPosterOptions): string {
  const { restaurantName, logoUrl, headline, description, couponCode, terms, contactText, footerText } = options;
  const accent = options.primaryColor || "#eab308";
  const offerHeadline = formatOfferHeadline(options);
  const offerSummary = formatOfferSummary(options);
  const expiry = formatValidUntil(options.validUntil);

  let table = `        <table role="presentation" width="600" class="yg-container" cellspacing="0" cellpadding="0" style="width: 600px; max-width: 600px; background: #0a0a0a;">
          <tr><td class="yg-pad" style="padding: 44px 36px 0; text-align: center;">
            ${logoUrl ? `<img src="${escAttr(logoUrl)}" alt="" style="display: block; margin: 0 auto 20px; width: 40px; height: 40px; border-radius: 8px; object-fit: cover;">` : ""}
            <p style="margin: 0 0 24px; font-family: ${BODY_FONT}; font-size: 12px; font-weight: 800; letter-spacing: 0.3em; text-transform: uppercase; color: ${accent};">${esc(restaurantName)}</p>
            <p class="yg-h2" style="margin: 0; font-family: ${HEADLINE_FONT}; font-size: 96px; font-weight: 900; line-height: 0.9; color: #ffffff; text-shadow: 0 4px 12px rgba(0,0,0,0.5);">${esc(offerHeadline)}</p>
            <h1 class="yg-h1" style="margin: 16px 0 0; font-family: ${BODY_FONT}; font-size: 28px; font-weight: 800; letter-spacing: -0.02em; line-height: 1.2; color: ${accent}; text-transform: uppercase;">${esc(headline) || "Off Everything"}</h1>
            ${description ? `<p style="margin: 20px 0 0; font-family: ${BODY_FONT}; font-size: 15px; line-height: 1.7; color: #d4d4d4;">${nl2br(description)}</p>` : ""}
          </td></tr>
          <tr><td style="padding: 32px 36px 0; text-align: center;">
            <p style="margin: 0 0 8px; font-family: ${BODY_FONT}; font-size: 13px; color: #a3a3a3;">${esc(offerSummary)}</p>
            <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto;"><tr><td style="padding: 16px 36px; background: ${accent}; border-radius: 4px;">
              <span style="font-family: 'Courier New', monospace; font-size: 26px; font-weight: 800; letter-spacing: 0.12em; color: #0a0a0a;">${esc(couponCode) || "BOLD"}</span>
            </td></tr></table>
            ${expiry ? `<p style="margin: 16px 0 0; font-family: ${BODY_FONT}; font-size: 12px; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; color: #737373;">Ends ${esc(expiry)}</p>` : ""}
          </td></tr>
          ${terms ? `<tr><td style="padding: 32px 40px 40px; text-align: center;"><p style="margin: 0; font-family: ${BODY_FONT}; font-size: 11px; line-height: 1.7; color: #737373;">${nl2br(terms)}</p></td></tr>` : `<tr><td style="padding: 0 0 20px;"></td></tr>`}
        </table>`;

  table = wrapFooterRow(table, restaurantName, options.restaurantAddress, contactText, footerText, "#737373", accent, options.socialLinks);
  return shell({ title: `${restaurantName} - Big offer`, bg: "#0a0a0a", content: table });
}

// ---------------------------------------------------------------------------
// Story Timeline — Progressive narrative with visual steps
// ---------------------------------------------------------------------------
export function renderStoryTimeline(options: EmailPosterOptions): string {
  const { restaurantName, logoUrl, headline, description, couponCode, terms, heroImageUrl, contactText, footerText } = options;
  const accent = options.primaryColor || "#0284c7";
  const offerSummary = formatOfferSummary(options);
  const expiry = formatValidUntil(options.validUntil);

  let table = `        <table role="presentation" width="600" class="yg-container" cellspacing="0" cellpadding="0" style="width: 600px; max-width: 600px; background: #f8fafc;">
          <tr><td class="yg-pad" style="padding: 36px 32px 0; text-align: center;">
            ${logoUrl ? `<img src="${escAttr(logoUrl)}" alt="" style="display: block; margin: 0 auto 16px; width: 40px; height: 40px; border-radius: 50%; object-fit: cover;">` : ""}
            <p style="margin: 0 0 16px; font-family: ${BODY_FONT}; font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: ${accent};">${esc(restaurantName)}</p>
            <h1 class="yg-h1" style="margin: 0; font-family: ${HEADLINE_FONT}; font-size: 32px; font-weight: 700; line-height: 1.3; color: #0c4a6e;">${esc(headline) || "Your journey with us"}</h1>
          </td></tr>
          <tr><td style="padding: 28px 32px 0;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>
              <td width="40" style="vertical-align: top; padding-top: 4px;">
                <div style="width: 32px; height: 32px; background: ${accent}; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                  <span style="font-family: ${BODY_FONT}; font-size: 14px; font-weight: 700; color: #ffffff;">1</span>
                </div>
              </td>
              <td style="vertical-align: top; padding-left: 16px;">
                <p style="margin: 0 0 6px; font-family: ${BODY_FONT}; font-size: 15px; font-weight: 700; color: #0c4a6e;">You joined us</p>
                <p style="margin: 0; font-family: ${BODY_FONT}; font-size: 13px; line-height: 1.6; color: #475569;">Welcome to our community of food lovers.</p>
              </td>
            </tr></table>
          </td></tr>
          <tr><td style="padding: 6px 32px 0 44px;"><div style="width: 2px; height: 24px; background: ${accent}40; margin-left: 15px;"></div></td></tr>
          <tr><td style="padding: 6px 32px 0;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>
              <td width="40" style="vertical-align: top; padding-top: 4px;">
                <div style="width: 32px; height: 32px; background: ${accent}; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                  <span style="font-family: ${BODY_FONT}; font-size: 14px; font-weight: 700; color: #ffffff;">2</span>
                </div>
              </td>
              <td style="vertical-align: top; padding-left: 16px;">
                <p style="margin: 0 0 6px; font-family: ${BODY_FONT}; font-size: 15px; font-weight: 700; color: #0c4a6e;">Try something amazing</p>
                ${description ? `<p style="margin: 0; font-family: ${BODY_FONT}; font-size: 13px; line-height: 1.6; color: #475569;">${nl2br(description)}</p>` : `<p style="margin: 0; font-family: ${BODY_FONT}; font-size: 13px; line-height: 1.6; color: #475569;">Experience flavors that will keep you coming back.</p>`}
              </td>
            </tr></table>
          </td></tr>
          ${heroImageUrl ? `<tr><td style="padding: 20px 48px 0 76px;">${heroImage({ url: heroImageUrl, height: 180, radius: "10px", fallbackBg: "" })}</td></tr>` : ""}
          <tr><td style="padding: 6px 32px 0 44px;"><div style="width: 2px; height: 24px; background: ${accent}40; margin-left: 15px;"></div></td></tr>
          <tr><td style="padding: 6px 32px 0;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>
              <td width="40" style="vertical-align: top; padding-top: 4px;">
                <div style="width: 32px; height: 32px; background: ${accent}; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                  <span style="font-family: ${BODY_FONT}; font-size: 14px; font-weight: 700; color: #ffffff;">3</span>
                </div>
              </td>
              <td style="vertical-align: top; padding-left: 16px;">
                <p style="margin: 0 0 14px; font-family: ${BODY_FONT}; font-size: 15px; font-weight: 700; color: #0c4a6e;">Enjoy your reward</p>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #ffffff; border-radius: 10px; border: 2px solid ${accent}30;"><tr><td style="padding: 18px; text-align: center;">
                  <p style="margin: 0 0 10px; font-family: ${BODY_FONT}; font-size: 16px; font-weight: 700; color: #0c4a6e;">${esc(offerSummary)}</p>
                  <div style="display: inline-block; background: ${accent}; border-radius: 6px; padding: 10px 20px;">
                    <span style="font-family: 'Courier New', monospace; font-size: 16px; font-weight: 700; color: #ffffff;">${esc(couponCode) || "JOURNEY"}</span>
                  </div>
                  ${expiry ? `<p style="margin: 10px 0 0; font-family: ${BODY_FONT}; font-size: 11px; color: #64748b;">Valid until ${esc(expiry)}</p>` : ""}
                </td></tr></table>
              </td>
            </tr></table>
          </td></tr>
          ${terms ? `<tr><td style="padding: 24px 32px 32px; text-align: center;"><p style="margin: 0; font-family: ${BODY_FONT}; font-size: 11px; line-height: 1.6; color: #94a3b8;">${nl2br(terms)}</p></td></tr>` : `<tr><td style="padding: 0 0 16px;"></td></tr>`}
        </table>`;

  table = wrapFooterRow(table, restaurantName, options.restaurantAddress, contactText, footerText, "#94a3b8", accent, options.socialLinks);
  return shell({ title: `${restaurantName} - Your journey`, bg: "#f8fafc", content: table });
}
