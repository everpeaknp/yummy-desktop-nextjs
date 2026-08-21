/**
 * Nepali cultural email template renderers — authentic designs inspired by
 * Nepal's rich visual heritage, festivals, traditional art, and color symbolism.
 *
 * Design research based on Nepali cultural elements:
 * - Crimson red: National color (rhododendron), victory, bravery
 * - Deep blue: Peace border (from national flag)
 * - Marigold yellow/orange: Tihar festival, sacred flowers
 * - White: Purity, enlightenment (Buddhist symbolism)
 * - Green: Harmony, balance (thangka art)
 * - Patterns: Rangoli, mandala, traditional Newari motifs
 * - Festivals: Dashain (tika ceremony), Tihar (lights & marigolds)
 *
 * Content rephrased for compliance with licensing restrictions.
 * Cultural research sources: Public domain materials, Wikipedia, cultural guides
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
// Dashain Red — Crimson red with traditional tika-inspired design
// ---------------------------------------------------------------------------
export function renderDashainRed(options: EmailPosterOptions): string {
  const { restaurantName, logoUrl, headline, description, couponCode, terms, heroImageUrl, contactText, footerText } = options;
  const crimsonRed = options.primaryColor || "#c41e3a"; // Nepali flag crimson
  const deepBlue = "#003893"; // Nepali flag blue border
  const offerSummary = formatOfferSummary(options);
  const expiry = formatValidUntil(options.validUntil);

  let table = `        <table role="presentation" width="600" class="yg-container" cellspacing="0" cellpadding="0" style="width: 600px; max-width: 600px; background: #fff8f0; border: 4px solid ${deepBlue};">
          <tr><td style="padding: 0; background: ${crimsonRed}; text-align: center;">
            <div style="padding: 28px 32px;">
              ${logoUrl ? `<img src="${escAttr(logoUrl)}" alt="" style="display: block; margin: 0 auto 14px; width: 44px; height: 44px; border-radius: 50%; object-fit: cover; border: 3px solid #ffffff;">` : ""}
              <p style="margin: 0 0 8px; font-family: ${BODY_FONT}; font-size: 12px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; color: rgba(255,255,255,0.95);">${esc(restaurantName)}</p>
              <div style="width: 60px; height: 3px; background: rgba(255,255,255,0.4); margin: 0 auto;"></div>
            </div>
          </td></tr>
          <tr><td class="yg-pad" style="padding: 36px 32px 0; text-align: center;">
            <h1 class="yg-h1" style="margin: 0; font-family: ${HEADLINE_FONT}; font-size: 36px; font-weight: 700; line-height: 1.25; color: ${crimsonRed};">${esc(headline) || "विशेष प्रस्ताव"}</h1>
            ${description ? `<p style="margin: 16px 0 0; font-family: ${BODY_FONT}; font-size: 15px; line-height: 1.75; color: #5c3317;">${nl2br(description)}</p>` : ""}
          </td></tr>
          ${heroImageUrl ? `<tr><td style="padding: 28px 32px 0;">${heroImage({ url: heroImageUrl, height: 260, radius: "12px", fallbackBg: "" })}</td></tr>` : ""}
          <tr><td style="padding: 30px 32px 0;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #ffffff; border: 3px solid ${crimsonRed}; border-radius: 14px;"><tr><td style="padding: 26px 28px; text-align: center;">
              <div style="margin: 0 0 16px;">
                <svg width="40" height="40" viewBox="0 0 40 40" style="display: inline-block;">
                  <circle cx="20" cy="20" r="18" fill="none" stroke="${crimsonRed}" stroke-width="2"/>
                  <circle cx="20" cy="20" r="10" fill="${crimsonRed}"/>
                  <circle cx="20" cy="20" r="6" fill="#ffffff"/>
                </svg>
              </div>
              <p style="margin: 0 0 14px; font-family: ${BODY_FONT}; font-size: 18px; font-weight: 700; color: ${crimsonRed};">${esc(offerSummary)}</p>
              ${expiry ? `<p style="margin: 0 0 18px; font-family: ${BODY_FONT}; font-size: 12px; color: #8b5a3c;">मान्य छ ${esc(expiry)} सम्म</p>` : ""}
              <div style="display: inline-block; background: ${crimsonRed}; border-radius: 10px; padding: 14px 28px;">
                <p style="margin: 0; font-family: 'Courier New', monospace; font-size: 22px; font-weight: 700; letter-spacing: 0.12em; color: #ffffff;">${esc(couponCode) || "DASHAIN"}</p>
              </div>
            </td></tr></table>
          </td></tr>
          ${terms ? `<tr><td style="padding: 28px 36px 36px; text-align: center;"><p style="margin: 0; font-family: ${BODY_FONT}; font-size: 11px; line-height: 1.7; color: #8b5a3c;">${nl2br(terms)}</p></td></tr>` : `<tr><td style="padding: 0 0 20px;"></td></tr>`}
        </table>`;

  table = wrapFooterRow(table, restaurantName, options.restaurantAddress, contactText, footerText, "#a0826d", crimsonRed, options.socialLinks);
  return shell({ title: `${restaurantName} - Dashain offer`, bg: "#fef6e4", content: table });
}

// ---------------------------------------------------------------------------
// Tihar Lights — Marigold and lights inspired by festival of lights
// ---------------------------------------------------------------------------
export function renderTiharLights(options: EmailPosterOptions): string {
  const { restaurantName, logoUrl, headline, description, couponCode, terms, heroImageUrl, contactText, footerText } = options;
  const marigold = options.primaryColor || "#ff9933"; // Marigold orange
  const deepOrange = "#ff6600";
  const offerSummary = formatOfferSummary(options);
  const expiry = formatValidUntil(options.validUntil);

  // Diyo (lamp) pattern in CSS
  const diyoPattern = `<svg width="24" height="28" viewBox="0 0 24 28" style="display: inline-block; margin: 0 6px;">
    <ellipse cx="12" cy="22" rx="10" ry="4" fill="${deepOrange}"/>
    <path d="M8 22 L12 8 L16 22 Z" fill="${marigold}"/>
    <ellipse cx="12" cy="8" rx="2" ry="3" fill="#ffd700"/>
  </svg>`;

  let table = `        <table role="presentation" width="600" class="yg-container" cellspacing="0" cellpadding="0" style="width: 600px; max-width: 600px; background: linear-gradient(180deg, #2d1810 0%, #1a0d06 100%);">
          <tr><td style="padding: 28px 32px 0; text-align: center;">
            <div style="margin-bottom: 20px;">
              ${diyoPattern}${diyoPattern}${diyoPattern}
            </div>
            ${logoUrl ? `<img src="${escAttr(logoUrl)}" alt="" style="display: block; margin: 0 auto 14px; width: 40px; height: 40px; border-radius: 50%; object-fit: cover; box-shadow: 0 0 20px ${marigold}80;">` : ""}
            <p style="margin: 0; font-family: ${BODY_FONT}; font-size: 12px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: ${marigold};">${esc(restaurantName)}</p>
          </td></tr>
          <tr><td class="yg-pad" style="padding: 26px 32px 0; text-align: center;">
            <h1 class="yg-h1" style="margin: 0; font-family: ${HEADLINE_FONT}; font-size: 34px; font-weight: 700; line-height: 1.3; color: #ffd700; text-shadow: 0 2px 12px ${marigold}80;">${esc(headline) || "तिहारको शुभकामना"}</h1>
            ${description ? `<p style="margin: 16px 0 0; font-family: ${BODY_FONT}; font-size: 14px; line-height: 1.75; color: #ffb366;">${nl2br(description)}</p>` : ""}
          </td></tr>
          ${heroImageUrl ? `<tr><td style="padding: 28px 32px 0;">${heroImage({ url: heroImageUrl, height: 240, radius: "14px", fallbackBg: "" })}</td></tr>` : ""}
          <tr><td style="padding: 28px 32px 0;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: rgba(255,153,51,0.15); border: 2px solid ${marigold}; border-radius: 14px; backdrop-filter: blur(10px);"><tr><td style="padding: 28px 24px; text-align: center;">
              <p style="margin: 0 0 4px; font-family: ${BODY_FONT}; font-size: 11px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: #ffb366;">🪔 प्रकाशको उत्सव 🪔</p>
              <p style="margin: 0 0 16px; font-family: ${HEADLINE_FONT}; font-size: 24px; font-weight: 700; color: #ffd700;">${esc(offerSummary)}</p>
              <div style="display: inline-block; background: linear-gradient(135deg, ${marigold} 0%, ${deepOrange} 100%); border-radius: 999px; padding: 14px 32px; box-shadow: 0 4px 16px ${marigold}60;">
                <p style="margin: 0; font-family: 'Courier New', monospace; font-size: 20px; font-weight: 700; color: #1a0d06;">${esc(couponCode) || "TIHAR"}</p>
              </div>
              ${expiry ? `<p style="margin: 14px 0 0; font-family: ${BODY_FONT}; font-size: 11px; color: #ffb366;">Valid until ${esc(expiry)}</p>` : ""}
            </td></tr></table>
          </td></tr>
          ${terms ? `<tr><td style="padding: 26px 36px 36px; text-align: center;"><p style="margin: 0; font-family: ${BODY_FONT}; font-size: 11px; line-height: 1.7; color: #cc7a29;">${nl2br(terms)}</p></td></tr>` : `<tr><td style="padding: 0 0 20px;"></td></tr>`}
        </table>`;

  table = wrapFooterRow(table, restaurantName, options.restaurantAddress, contactText, footerText, "#996633", marigold, options.socialLinks);
  return shell({ title: `${restaurantName} - Tihar celebration`, bg: "#1a0d06", content: table });
}

// ---------------------------------------------------------------------------
// Mandala Harmony — Circular mandala-inspired geometric pattern
// ---------------------------------------------------------------------------
export function renderMandalaHarmony(options: EmailPosterOptions): string {
  const { restaurantName, logoUrl, headline, description, couponCode, terms, heroImageUrl, contactText, footerText } = options;
  const mandalaBlue = options.primaryColor || "#1e40af"; // Thangka blue (wisdom)
  const mandalaRed = "#991b1b"; // Thangka red (passion/transformation)
  const mandalaGold = "#d97706"; // Gold accent
  const offerSummary = formatOfferSummary(options);
  const expiry = formatValidUntil(options.validUntil);

  // Simple mandala pattern in SVG
  const mandalaPattern = `<svg width="80" height="80" viewBox="0 0 80 80" style="display: block; margin: 0 auto;">
    <circle cx="40" cy="40" r="35" fill="none" stroke="${mandalaGold}" stroke-width="1" opacity="0.3"/>
    <circle cx="40" cy="40" r="28" fill="none" stroke="${mandalaBlue}" stroke-width="2"/>
    <circle cx="40" cy="40" r="20" fill="none" stroke="${mandalaRed}" stroke-width="1.5"/>
    <circle cx="40" cy="40" r="12" fill="none" stroke="${mandalaGold}" stroke-width="2"/>
    <circle cx="40" cy="40" r="4" fill="${mandalaBlue}"/>
    <circle cx="40" cy="12" r="3" fill="${mandalaRed}"/>
    <circle cx="40" cy="68" r="3" fill="${mandalaRed}"/>
    <circle cx="12" cy="40" r="3" fill="${mandalaRed}"/>
    <circle cx="68" cy="40" r="3" fill="${mandalaRed}"/>
  </svg>`;

  let table = `        <table role="presentation" width="600" class="yg-container" cellspacing="0" cellpadding="0" style="width: 600px; max-width: 600px; background: #fefbf3;">
          <tr><td style="padding: 36px 32px 0; text-align: center;">
            <div style="margin-bottom: 20px;">${mandalaPattern}</div>
            ${logoUrl ? `<img src="${escAttr(logoUrl)}" alt="" style="display: block; margin: 0 auto 14px; width: 42px; height: 42px; border-radius: 50%; object-fit: cover; border: 2px solid ${mandalaGold};">` : ""}
            <p style="margin: 0 0 6px; font-family: ${BODY_FONT}; font-size: 11px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: ${mandalaBlue};">${esc(restaurantName)}</p>
            <div style="width: 40px; height: 2px; background: ${mandalaGold}; margin: 0 auto;"></div>
          </td></tr>
          <tr><td class="yg-pad" style="padding: 24px 40px 0; text-align: center;">
            <h1 class="yg-h1" style="margin: 0; font-family: ${HEADLINE_FONT}; font-size: 32px; font-weight: 700; line-height: 1.35; color: ${mandalaBlue};">${esc(headline) || "सद्भाव र सन्तुलन"}</h1>
            ${description ? `<p style="margin: 14px auto 0; max-width: 480px; font-family: ${BODY_FONT}; font-size: 14px; line-height: 1.8; color: #78350f;">${nl2br(description)}</p>` : ""}
          </td></tr>
          ${heroImageUrl ? `<tr><td style="padding: 28px 40px 0;">${heroImage({ url: heroImageUrl, height: 240, radius: "10px", fallbackBg: "" })}</td></tr>` : ""}
          <tr><td style="padding: 28px 32px 0;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #ffffff; border: 2px solid ${mandalaGold}40; border-radius: 12px; box-shadow: 0 2px 12px rgba(0,0,0,0.06);"><tr><td style="padding: 26px 28px; text-align: center;">
              <div style="width: 50px; height: 2px; background: ${mandalaGold}; margin: 0 auto 16px;"></div>
              <p style="margin: 0 0 14px; font-family: ${BODY_FONT}; font-size: 17px; font-weight: 700; color: ${mandalaBlue};">${esc(offerSummary)}</p>
              ${expiry ? `<p style="margin: 0 0 16px; font-family: ${BODY_FONT}; font-size: 11px; color: #92400e;">मान्य अवधि ${esc(expiry)} सम्म</p>` : ""}
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto;"><tr>
                <td style="padding: 3px; background: linear-gradient(135deg, ${mandalaBlue} 0%, ${mandalaRed} 100%); border-radius: 8px;">
                  <div style="background: #ffffff; border-radius: 6px; padding: 12px 24px;">
                    <span style="font-family: 'Courier New', monospace; font-size: 20px; font-weight: 700; color: ${mandalaBlue};">${esc(couponCode) || "HARMONY"}</span>
                  </div>
                </td>
              </tr></table>
              <div style="width: 50px; height: 2px; background: ${mandalaGold}; margin: 16px auto 0;"></div>
            </td></tr></table>
          </td></tr>
          ${terms ? `<tr><td style="padding: 26px 40px 36px; text-align: center;"><p style="margin: 0; font-family: ${BODY_FONT}; font-size: 11px; line-height: 1.7; color: #92400e;">${nl2br(terms)}</p></td></tr>` : `<tr><td style="padding: 0 0 20px;"></td></tr>`}
        </table>`;

  table = wrapFooterRow(table, restaurantName, options.restaurantAddress, contactText, footerText, "#a16207", mandalaBlue, options.socialLinks);
  return shell({ title: `${restaurantName} - Special offer`, bg: "#fffbeb", content: table });
}

// ---------------------------------------------------------------------------
// Himalayan Peaks — Mountain-inspired with national flag colors
// ---------------------------------------------------------------------------
export function renderHimalayanPeaks(options: EmailPosterOptions): string {
  const { restaurantName, logoUrl, headline, description, couponCode, terms, heroImageUrl, contactText, footerText } = options;
  const peakBlue = options.primaryColor || "#003893"; // Nepal flag blue
  const crimson = "#c41e3a"; // Nepal flag crimson
  const snowWhite = "#f8fafc";
  const offerSummary = formatOfferSummary(options);
  const expiry = formatValidUntil(options.validUntil);

  // Mountain peak SVG pattern
  const peakPattern = `<svg width="100%" height="100" viewBox="0 0 600 100" preserveAspectRatio="none" style="display: block;">
    <path d="M0,100 L0,80 L100,20 L200,60 L300,10 L400,50 L500,25 L600,70 L600,100 Z" fill="${peakBlue}"/>
    <path d="M0,100 L0,85 L100,30 L200,65 L300,20 L400,55 L500,35 L600,75 L600,100 Z" fill="${crimson}" opacity="0.7"/>
  </svg>`;

  let table = `        <table role="presentation" width="600" class="yg-container" cellspacing="0" cellpadding="0" style="width: 600px; max-width: 600px; background: ${snowWhite};">
          <tr><td style="padding: 0;">${peakPattern}</td></tr>
          <tr><td class="yg-pad" style="padding: 32px 36px 0; text-align: center;">
            ${logoUrl ? `<img src="${escAttr(logoUrl)}" alt="" style="display: block; margin: 0 auto 16px; width: 44px; height: 44px; border-radius: 10px; object-fit: cover; border: 3px solid ${peakBlue};">` : ""}
            <p style="margin: 0 0 18px; font-family: ${BODY_FONT}; font-size: 12px; font-weight: 800; letter-spacing: 0.24em; text-transform: uppercase; color: ${peakBlue};">${esc(restaurantName)}</p>
            <h1 class="yg-h1" style="margin: 0; font-family: ${HEADLINE_FONT}; font-size: 36px; font-weight: 700; line-height: 1.25; color: ${crimson};">${esc(headline) || "हिमालबाट प्रेरणा"}</h1>
            ${description ? `<p style="margin: 14px 0 0; font-family: ${BODY_FONT}; font-size: 14px; line-height: 1.75; color: #475569;">${nl2br(description)}</p>` : ""}
          </td></tr>
          ${heroImageUrl ? `<tr><td style="padding: 26px 36px 0;">${heroImage({ url: heroImageUrl, height: 260, radius: "12px", fallbackBg: "" })}</td></tr>` : ""}
          <tr><td style="padding: 28px 36px 0;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #ffffff; border: 3px solid ${peakBlue}; border-radius: 0 0 14px 14px;"><tr><td style="padding: 0;">
              <div style="background: ${crimson}; padding: 12px; text-align: center;">
                <p style="margin: 0; font-family: ${BODY_FONT}; font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #ffffff;">विशेष प्रस्ताव</p>
              </div>
              <div style="padding: 24px 26px; text-align: center;">
                <p style="margin: 0 0 16px; font-family: ${BODY_FONT}; font-size: 18px; font-weight: 700; color: ${peakBlue};">${esc(offerSummary)}</p>
                ${expiry ? `<p style="margin: 0 0 18px; font-family: ${BODY_FONT}; font-size: 12px; color: #64748b;">मान्य ${esc(expiry)} सम्म</p>` : ""}
                <div style="display: inline-block; background: ${peakBlue}; padding: 14px 30px; border-radius: 8px;">
                  <p style="margin: 0; font-family: 'Courier New', monospace; font-size: 22px; font-weight: 700; letter-spacing: 0.14em; color: #ffffff;">${esc(couponCode) || "NEPAL"}</p>
                </div>
              </div>
            </td></tr></table>
          </td></tr>
          ${terms ? `<tr><td style="padding: 26px 40px 36px; text-align: center;"><p style="margin: 0; font-family: ${BODY_FONT}; font-size: 11px; line-height: 1.7; color: #64748b;">${nl2br(terms)}</p></td></tr>` : `<tr><td style="padding: 0 0 20px;"></td></tr>`}
        </table>`;

  table = wrapFooterRow(table, restaurantName, options.restaurantAddress, contactText, footerText, "#94a3b8", peakBlue, options.socialLinks);
  return shell({ title: `${restaurantName} - Mountain offer`, bg: "#e2e8f0", content: table });
}

// ---------------------------------------------------------------------------
// Rangoli Pattern — Colorful geometric pattern inspired by Tihar decorations
// ---------------------------------------------------------------------------
export function renderRangoliPattern(options: EmailPosterOptions): string {
  const { restaurantName, logoUrl, headline, description, couponCode, terms, heroImageUrl, contactText, footerText } = options;
  const rangoliPink = options.primaryColor || "#ec4899";
  const rangoliOrange = "#fb923c";
  const rangoliGreen = "#22c55e";
  const rangoliYellow = "#facc15";
  const offerSummary = formatOfferSummary(options);
  const expiry = formatValidUntil(options.validUntil);

  // Simplified rangoli pattern as decorative border
  const rangoliDots = `<div style="text-align: center; margin: 0 auto;">
    <span style="display: inline-block; width: 8px; height: 8px; background: ${rangoliPink}; border-radius: 50%; margin: 0 3px;"></span>
    <span style="display: inline-block; width: 8px; height: 8px; background: ${rangoliOrange}; border-radius: 50%; margin: 0 3px;"></span>
    <span style="display: inline-block; width: 8px; height: 8px; background: ${rangoliYellow}; border-radius: 50%; margin: 0 3px;"></span>
    <span style="display: inline-block; width: 8px; height: 8px; background: ${rangoliGreen}; border-radius: 50%; margin: 0 3px;"></span>
    <span style="display: inline-block; width: 8px; height: 8px; background: ${rangoliPink}; border-radius: 50%; margin: 0 3px;"></span>
  </div>`;

  let table = `        <table role="presentation" width="600" class="yg-container" cellspacing="0" cellpadding="0" style="width: 600px; max-width: 600px; background: #ffffff;">
          <tr><td style="padding: 32px 32px 0; text-align: center;">
            ${rangoliDots}
            <div style="margin: 16px 0;">
              ${logoUrl ? `<img src="${escAttr(logoUrl)}" alt="" style="display: block; margin: 0 auto; width: 48px; height: 48px; border-radius: 50%; object-fit: cover; border: 3px solid ${rangoliPink};">` : ""}
            </div>
            <p style="margin: 0 0 12px; font-family: ${BODY_FONT}; font-size: 13px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: ${rangoliPink};">${esc(restaurantName)}</p>
            ${rangoliDots}
          </td></tr>
          <tr><td class="yg-pad" style="padding: 26px 36px 0; text-align: center;">
            <h1 class="yg-h1" style="margin: 0; font-family: ${HEADLINE_FONT}; font-size: 34px; font-weight: 700; line-height: 1.3; color: #1f2937;">${esc(headline) || "रङ्गोली उत्सव"}</h1>
            ${description ? `<p style="margin: 14px 0 0; font-family: ${BODY_FONT}; font-size: 14px; line-height: 1.75; color: #4b5563;">${nl2br(description)}</p>` : ""}
          </td></tr>
          ${heroImageUrl ? `<tr><td style="padding: 26px 36px 0;">${heroImage({ url: heroImageUrl, height: 240, radius: "14px", fallbackBg: "" })}</td></tr>` : ""}
          <tr><td style="padding: 28px 36px 0;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: linear-gradient(135deg, ${rangoliPink}15 0%, ${rangoliOrange}15 25%, ${rangoliYellow}15 50%, ${rangoliGreen}15 75%, ${rangoliPink}15 100%); border: 2px solid ${rangoliPink}40; border-radius: 16px;"><tr><td style="padding: 28px 26px; text-align: center;">
              <p style="margin: 0 0 4px; font-family: ${BODY_FONT}; font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #6b7280;">🌺 रंगीन प्रस्ताव 🌺</p>
              <p style="margin: 0 0 16px; font-family: ${HEADLINE_FONT}; font-size: 22px; font-weight: 700; color: ${rangoliPink};">${esc(offerSummary)}</p>
              ${expiry ? `<p style="margin: 0 0 18px; font-family: ${BODY_FONT}; font-size: 11px; color: #6b7280;">Valid until ${esc(expiry)}</p>` : ""}
              <div style="display: inline-block; background: linear-gradient(135deg, ${rangoliPink} 0%, ${rangoliOrange} 50%, ${rangoliYellow} 100%); padding: 3px; border-radius: 12px;">
                <div style="background: #ffffff; padding: 12px 28px; border-radius: 10px;">
                  <p style="margin: 0; font-family: 'Courier New', monospace; font-size: 20px; font-weight: 700; color: ${rangoliPink};">${esc(couponCode) || "RANGOLI"}</p>
                </div>
              </div>
            </td></tr></table>
          </td></tr>
          ${terms ? `<tr><td style="padding: 26px 40px 36px; text-align: center;"><p style="margin: 0; font-family: ${BODY_FONT}; font-size: 11px; line-height: 1.7; color: #9ca3af;">${nl2br(terms)}</p></td></tr>` : `<tr><td style="padding: 0 0 20px;"></td></tr>`}
        </table>`;

  table = wrapFooterRow(table, restaurantName, options.restaurantAddress, contactText, footerText, "#9ca3af", rangoliPink, options.socialLinks);
  return shell({ title: `${restaurantName} - Colorful celebration`, bg: "#f9fafb", content: table });
}
