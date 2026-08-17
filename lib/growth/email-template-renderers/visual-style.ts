/**
 * Visual-style / interface-inspired family: monochromatic, pastel,
 * dark-mode, glassmorphism, neomorphism, flat-design, dimensional, collage,
 * asymmetric.
 */
import {
  type EmailPosterOptions,
  esc,
  escAttr,
  nl2br,
  formatOfferSummary,
  formatValidUntil,
  shell,
  wrapFooterRow,
  heroImage,
  BODY_FONT,
  HEADLINE_FONT,
} from "../email-poster-html";

/** Lightens/darkens a hex color by `amount` (-1..1) for tonal-hierarchy templates. */
function shade(hex: string, amount: number): string {
  const clean = hex.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return hex;
  const num = parseInt(clean, 16);
  let r = (num >> 16) & 0xff;
  let g = (num >> 8) & 0xff;
  let b = num & 0xff;
  const mix = (channel: number) => Math.round(amount >= 0 ? channel + (255 - channel) * amount : channel * (1 + amount));
  r = Math.min(255, Math.max(0, mix(r)));
  g = Math.min(255, Math.max(0, mix(g)));
  b = Math.min(255, Math.max(0, mix(b)));
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

// ---------------------------------------------------------------------------
// Monochromatic — dynamically built from shades of the brand's primary color
// ---------------------------------------------------------------------------
export function renderMonochromatic(options: EmailPosterOptions): string {
  const { restaurantName, logoUrl, headline, description, couponCode, terms, contactText, footerText } = options;
  const base = options.primaryColor || "#6d28d9";
  const dark = shade(base, -0.6);
  const light = shade(base, 0.9);
  const mid = shade(base, 0.6);
  const offerSummary = formatOfferSummary(options);
  const expiry = formatValidUntil(options.validUntil);

  let table = `        <table role="presentation" width="600" class="yg-container" cellspacing="0" cellpadding="0" style="width: 600px; max-width: 600px; background: ${light};">
          <tr><td style="padding: 30px 36px 0;">
            ${logoUrl ? `<img src="${escAttr(logoUrl)}" alt="" style="display: block; width: 32px; height: 32px; border-radius: 8px; object-fit: cover; margin-bottom: 10px;">` : ""}<span style="font-family: ${BODY_FONT}; font-size: 14px; font-weight: 700; color: ${dark};">${esc(restaurantName)}</span>
          </td></tr>
          <tr><td class="yg-pad" style="padding: 26px 36px 0;">
            <div style="background: ${base}; border-radius: 18px; padding: 32px 28px;">
              <h1 class="yg-h1" style="margin: 0; font-family: ${BODY_FONT}; font-size: 28px; font-weight: 700; line-height: 1.3; color: #ffffff;">${esc(headline) || "One color, made for you"}</h1>
              ${description ? `<p style="margin: 12px 0 0; font-family: ${BODY_FONT}; font-size: 14px; line-height: 1.65; color: ${light};">${nl2br(description)}</p>` : ""}
            </div>
          </td></tr>
          <tr><td style="padding: 22px 36px 0;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: ${mid}; border-radius: 14px;"><tr><td style="padding: 22px 24px; text-align: center;">
              <p style="margin: 0 0 6px; font-family: ${BODY_FONT}; font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: ${dark};">Offer</p>
              <p style="margin: 0 0 12px; font-family: ${BODY_FONT}; font-size: 22px; font-weight: 800; color: ${dark};">${esc(offerSummary)}</p>
              <span style="display: inline-block; padding: 8px 18px; background: ${light}; border-radius: 8px; font-family: 'Courier New', monospace; font-size: 15px; font-weight: 700; color: ${dark};">${esc(couponCode) || "ABC123"}</span>
              ${expiry ? `<p style="margin: 12px 0 0; font-family: ${BODY_FONT}; font-size: 12px; color: ${dark};">Valid until ${esc(expiry)}</p>` : ""}
            </td></tr></table>
          </td></tr>
          ${terms ? `<tr><td style="padding: 20px 36px 0;"><p style="margin: 0; font-family: ${BODY_FONT}; font-size: 11px; line-height: 1.6; color: ${dark};">${nl2br(terms)}</p></td></tr>` : ""}
        </table>`;

  table = wrapFooterRow(table, restaurantName, contactText, footerText, dark, dark, options.socialLinks);
  return shell({ title: `${restaurantName} - Offer`, bg: light, content: table });
}

// ---------------------------------------------------------------------------
// Pastel — soft colors, gentle backgrounds, rounded shapes, light type
// ---------------------------------------------------------------------------
export function renderPastel(options: EmailPosterOptions): string {
  const { restaurantName, logoUrl, headline, description, couponCode, terms, heroImageUrl, contactText, footerText } = options;
  const accent = options.primaryColor || "#c4b5fd";
  const offerSummary = formatOfferSummary(options);
  const expiry = formatValidUntil(options.validUntil);

  let table = `        <table role="presentation" width="600" class="yg-container" cellspacing="0" cellpadding="0" style="width: 600px; max-width: 600px; background: #fdf4ff; border-radius: 28px; overflow: hidden;">
          <tr><td class="yg-pad" style="padding: 36px 34px 0; text-align: center;">
            ${logoUrl ? `<img src="${escAttr(logoUrl)}" alt="" style="display: block; margin: 0 auto 14px; width: 48px; height: 48px; border-radius: 50%; object-fit: cover; box-shadow: 0 6px 14px rgba(196,181,253,0.4);">` : ""}
            <p style="margin: 0 0 10px; font-family: ${BODY_FONT}; font-size: 12px; font-weight: 600; letter-spacing: 0.08em; color: #7e22ce;">${esc(restaurantName)}</p>
            <h1 class="yg-h1" style="margin: 0; font-family: ${BODY_FONT}; font-size: 26px; font-weight: 700; line-height: 1.4; color: #581c87;">${esc(headline) || "A soft little surprise"}</h1>
            ${description ? `<p style="margin: 12px 0 0; font-family: ${BODY_FONT}; font-size: 14px; line-height: 1.7; color: #86198f;">${nl2br(description)}</p>` : ""}
          </td></tr>
          ${heroImageUrl ? `<tr><td style="padding: 22px 34px 0;">${heroImage({ url: heroImageUrl, height: 210, radius: "22px", fallbackBg: "" })}</td></tr>` : ""}
          <tr><td style="padding: 24px 34px 0; text-align: center;">
            <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto;"><tr><td style="padding: 20px 30px; background: #f3e8ff; border-radius: 20px; box-shadow: 0 4px 10px rgba(196,181,253,0.35);">
              <p style="margin: 0 0 4px; font-family: ${BODY_FONT}; font-size: 22px; font-weight: 700; color: #6b21a8;">${esc(offerSummary)}</p>
              ${expiry ? `<p style="margin: 0; font-family: ${BODY_FONT}; font-size: 12px; color: #a855f7;">Through ${esc(expiry)}</p>` : ""}
            </td></tr></table>
          </td></tr>
          <tr><td style="padding: 20px 34px 0; text-align: center;">
            <span style="display: inline-block; padding: 8px 20px; background: #fae8ff; border: 1px solid ${accent}; border-radius: 999px; font-family: 'Courier New', monospace; font-size: 15px; font-weight: 700; color: #86198f;">${esc(couponCode) || "ABC123"}</span>
          </td></tr>
          ${terms ? `<tr><td style="padding: 22px 34px 0; text-align: center;"><p style="margin: 0; font-family: ${BODY_FONT}; font-size: 11px; line-height: 1.6; color: #a855f7;">${nl2br(terms)}</p></td></tr>` : ""}
        </table>`;

  table = wrapFooterRow(table, restaurantName, contactText, footerText, "#a855f7", "#7e22ce", options.socialLinks);
  return shell({ title: `${restaurantName} - Offer`, bg: "#f3e8ff", content: table });
}

// ---------------------------------------------------------------------------
// Dark Mode — cinematic hero, near-black background, jewel accent
// ---------------------------------------------------------------------------
export function renderDarkMode(options: EmailPosterOptions): string {
  const { restaurantName, logoUrl, headline, description, couponCode, terms, heroImageUrl, contactText, footerText } = options;
  const accent = options.primaryColor || "#d4af37";
  const offerSummary = formatOfferSummary(options);
  const expiry = formatValidUntil(options.validUntil);

  const hero = heroImage({
    url: heroImageUrl,
    height: heroImageUrl ? 280 : 200,
    fallbackBg: "radial-gradient(120% 140% at 50% 0%, #2a2620 0%, #14120f 70%)",
  });

  let table = `        <table role="presentation" width="600" class="yg-container" cellspacing="0" cellpadding="0" style="width: 600px; max-width: 600px; background: #0d0d0e; border-radius: 14px; overflow: hidden; border: 1px solid ${accent}33;">
          <tr><td>${hero}</td></tr>
          <tr><td class="yg-pad" style="padding: 32px 36px 0; text-align: center;">
            ${logoUrl ? `<img src="${escAttr(logoUrl)}" alt="" style="display: block; margin: 0 auto 14px; width: 42px; height: 42px; border-radius: 50%; object-fit: cover; border: 1px solid ${accent};">` : ""}
            <p style="margin: 0 0 16px; font-family: ${BODY_FONT}; font-size: 11px; font-weight: 600; letter-spacing: 0.24em; text-transform: uppercase; color: ${accent}cc;">${esc(restaurantName)}</p>
            <h1 class="yg-h1" style="margin: 0; font-family: ${HEADLINE_FONT}; font-size: 32px; font-weight: 700; line-height: 1.3; color: #f7f3ea;">${esc(headline) || "An evening worth returning for"}</h1>
            ${description ? `<p style="margin: 14px 0 0; font-family: ${BODY_FONT}; font-size: 13px; line-height: 1.7; color: #b7ae9c;">${nl2br(description)}</p>` : ""}
          </td></tr>
          <tr><td class="yg-pad" style="padding: 28px 36px 0;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: rgba(255,255,255,0.045); border: 1px solid ${accent}40; border-radius: 12px;"><tr><td style="padding: 26px 20px; text-align: center;">
              <p style="margin: 0 0 8px; font-family: ${BODY_FONT}; font-size: 10px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; color: ${accent};">Your reward</p>
              <p style="margin: 0 0 18px; font-family: ${HEADLINE_FONT}; font-size: 30px; font-weight: 700; color: #f7f3ea;">${esc(offerSummary)}</p>
              <p style="margin: 0 0 6px; font-family: 'Courier New', monospace; font-size: 26px; font-weight: 700; letter-spacing: 0.2em; color: ${accent};">${esc(couponCode) || "ABC123"}</p>
              ${expiry ? `<p style="margin: 14px 0 0; font-family: ${BODY_FONT}; font-size: 12px; color: #8a8375;">Valid until ${esc(expiry)}</p>` : ""}
            </td></tr></table>
          </td></tr>
          ${terms ? `<tr><td style="padding: 26px 36px 0; text-align: center;"><p style="margin: 0; font-family: ${BODY_FONT}; font-size: 11px; line-height: 1.7; color: #6f6a5e;">${nl2br(terms)}</p></td></tr>` : ""}
        </table>`;

  table = wrapFooterRow(table, restaurantName, contactText, footerText, "#6f6a5e", accent, options.socialLinks);
  return shell({ title: `${restaurantName} - Exclusive offer`, bg: "#000000", content: table });
}

// ---------------------------------------------------------------------------
// Glassmorphism — layered, translucent-looking cards, soft gradients
// (email-safe: simulated with semi-transparent overlays + light borders,
// no backdrop-filter/blur — those aren't reliably supported in email)
// ---------------------------------------------------------------------------
export function renderGlassmorphism(options: EmailPosterOptions): string {
  const { restaurantName, logoUrl, headline, description, couponCode, terms, contactText, footerText } = options;
  const accent = options.primaryColor || "#818cf8";
  const offerSummary = formatOfferSummary(options);
  const expiry = formatValidUntil(options.validUntil);
  const bgGradient = `linear-gradient(135deg, ${accent} 0%, #a78bfa 50%, #f472b6 100%)`;

  let table = `        <table role="presentation" width="600" class="yg-container" cellspacing="0" cellpadding="0" style="width: 600px; max-width: 600px; background: ${bgGradient}; border-radius: 20px; overflow: hidden;">
          <tr><td class="yg-pad" style="padding: 34px 32px 0;">
            ${logoUrl ? `<img src="${escAttr(logoUrl)}" alt="" style="display: block; width: 32px; height: 32px; border-radius: 8px; object-fit: cover; border: 1px solid rgba(255,255,255,0.6); margin-bottom: 10px;">` : ""}<span style="font-family: ${BODY_FONT}; font-size: 14px; font-weight: 700; color: #ffffff;">${esc(restaurantName)}</span>
          </td></tr>
          <tr><td style="padding: 22px 24px 0;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: rgba(255,255,255,0.16); border: 1px solid rgba(255,255,255,0.35); border-radius: 18px;"><tr><td style="padding: 28px 26px;">
              <h1 class="yg-h1" style="margin: 0; font-family: ${BODY_FONT}; font-size: 27px; font-weight: 700; line-height: 1.3; color: #ffffff;">${esc(headline) || "Layers of good news"}</h1>
              ${description ? `<p style="margin: 12px 0 0; font-family: ${BODY_FONT}; font-size: 13px; line-height: 1.65; color: rgba(255,255,255,0.9);">${nl2br(description)}</p>` : ""}
            </td></tr></table>
          </td></tr>
          <tr><td style="padding: 16px 24px 0;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: rgba(255,255,255,0.22); border: 1px solid rgba(255,255,255,0.4); border-radius: 16px;"><tr><td style="padding: 24px; text-align: center;">
              <p style="margin: 0 0 6px; font-family: ${BODY_FONT}; font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(255,255,255,0.85);">Offer</p>
              <p style="margin: 0 0 14px; font-family: ${BODY_FONT}; font-size: 24px; font-weight: 800; color: #ffffff;">${esc(offerSummary)}</p>
              <span style="display: inline-block; padding: 8px 18px; background: rgba(255,255,255,0.28); border: 1px solid rgba(255,255,255,0.5); border-radius: 8px; font-family: 'Courier New', monospace; font-size: 15px; font-weight: 700; color: #ffffff;">${esc(couponCode) || "ABC123"}</span>
              ${expiry ? `<p style="margin: 12px 0 0; font-family: ${BODY_FONT}; font-size: 12px; color: rgba(255,255,255,0.85);">Valid until ${esc(expiry)}</p>` : ""}
            </td></tr></table>
          </td></tr>
          ${terms ? `<tr><td style="padding: 22px 32px 0; text-align: center;"><p style="margin: 0; font-family: ${BODY_FONT}; font-size: 11px; line-height: 1.6; color: rgba(255,255,255,0.75);">${nl2br(terms)}</p></td></tr>` : ""}
        </table>`;

  table = wrapFooterRow(table, restaurantName, contactText, footerText, "rgba(255,255,255,0.75)", "#ffffff", options.socialLinks);
  return shell({ title: `${restaurantName} - Offer`, bg: "#4338ca", content: table });
}

// ---------------------------------------------------------------------------
// Neomorphism — soft raised/recessed sections on a muted background
// ---------------------------------------------------------------------------
export function renderNeomorphism(options: EmailPosterOptions): string {
  const { restaurantName, logoUrl, headline, description, couponCode, terms, contactText, footerText } = options;
  const accent = options.primaryColor || "#64748b";
  const offerSummary = formatOfferSummary(options);
  const expiry = formatValidUntil(options.validUntil);

  let table = `        <table role="presentation" width="600" class="yg-container" cellspacing="0" cellpadding="0" style="width: 600px; max-width: 600px; background: #e8ecf1; border-radius: 24px;">
          <tr><td class="yg-pad" style="padding: 36px 34px 0; text-align: center;">
            ${logoUrl ? `<img src="${escAttr(logoUrl)}" alt="" style="display: block; margin: 0 auto 14px; width: 44px; height: 44px; border-radius: 50%; object-fit: cover; box-shadow: 4px 4px 8px rgba(163,177,198,0.5), -4px -4px 8px rgba(255,255,255,0.7);">` : ""}
            <p style="margin: 0 0 10px; font-family: ${BODY_FONT}; font-size: 12px; font-weight: 600; letter-spacing: 0.08em; color: #475569;">${esc(restaurantName)}</p>
            <h1 class="yg-h1" style="margin: 0; font-family: ${BODY_FONT}; font-size: 26px; font-weight: 700; line-height: 1.35; color: #334155;">${esc(headline) || "Something gentle, just for you"}</h1>
            ${description ? `<p style="margin: 12px 0 0; font-family: ${BODY_FONT}; font-size: 14px; line-height: 1.7; color: #64748b;">${nl2br(description)}</p>` : ""}
          </td></tr>
          <tr><td style="padding: 26px 34px 0;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #e8ecf1; border-radius: 18px;"><tr><td style="padding: 24px; text-align: center;">
              <div style="background: #e8ecf1; border-radius: 14px; padding: 18px; box-shadow: inset 3px 3px 6px rgba(163,177,198,0.45), inset -3px -3px 6px rgba(255,255,255,0.8);">
                <p style="margin: 0 0 6px; font-family: ${BODY_FONT}; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #64748b;">Offer</p>
                <p style="margin: 0; font-family: ${BODY_FONT}; font-size: 22px; font-weight: 700; color: #334155;">${esc(offerSummary)}</p>
              </div>
              <div style="margin-top: 14px; display: inline-block; background: #e8ecf1; border-radius: 10px; padding: 12px 22px; box-shadow: 3px 3px 6px rgba(163,177,198,0.45), -3px -3px 6px rgba(255,255,255,0.8);">
                <span style="font-family: 'Courier New', monospace; font-size: 16px; font-weight: 700; color: #334155;">${esc(couponCode) || "ABC123"}</span>
              </div>
              ${expiry ? `<p style="margin: 14px 0 0; font-family: ${BODY_FONT}; font-size: 12px; color: #94a3b8;">Valid until ${esc(expiry)}</p>` : ""}
            </td></tr></table>
          </td></tr>
          ${terms ? `<tr><td style="padding: 22px 34px 0; text-align: center;"><p style="margin: 0; font-family: ${BODY_FONT}; font-size: 11px; line-height: 1.6; color: #94a3b8;">${nl2br(terms)}</p></td></tr>` : ""}
        </table>`;

  table = wrapFooterRow(table, restaurantName, contactText, footerText, "#94a3b8", accent, options.socialLinks);
  return shell({ title: `${restaurantName} - Offer`, bg: "#e8ecf1", content: table });
}

// ---------------------------------------------------------------------------
// Flat Design — flat colors, simple shapes, no gradients/shadows
// ---------------------------------------------------------------------------
export function renderFlatDesign(options: EmailPosterOptions): string {
  const { restaurantName, logoUrl, headline, description, couponCode, terms, contactText, footerText } = options;
  const accent = options.primaryColor || "#ef4444";
  const offerSummary = formatOfferSummary(options);
  const expiry = formatValidUntil(options.validUntil);

  let table = `        <table role="presentation" width="600" class="yg-container" cellspacing="0" cellpadding="0" style="width: 600px; max-width: 600px; background: #ffffff;">
          <tr><td style="padding: 28px 32px; background: ${accent};">
            ${logoUrl ? `<img src="${escAttr(logoUrl)}" alt="" style="display: block; width: 30px; height: 30px; border-radius: 6px; object-fit: cover; margin-bottom: 8px;">` : ""}<span style="font-family: ${BODY_FONT}; font-size: 14px; font-weight: 700; color: #ffffff;">${esc(restaurantName)}</span>
          </td></tr>
          <tr><td class="yg-pad" style="padding: 32px;">
            <h1 class="yg-h1" style="margin: 0 0 14px; font-family: ${BODY_FONT}; font-size: 26px; font-weight: 800; line-height: 1.3; color: #1f2937;">${esc(headline) || "Simple. Direct. Delicious."}</h1>
            ${description ? `<p style="margin: 0 0 22px; font-family: ${BODY_FONT}; font-size: 14px; line-height: 1.7; color: #4b5563;">${nl2br(description)}</p>` : ""}
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>
              <td width="60%" class="yg-stack" style="background: #fef2f2; padding: 18px;">
                <p style="margin: 0 0 4px; font-family: ${BODY_FONT}; font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: ${accent};">Offer</p>
                <p style="margin: 0; font-family: ${BODY_FONT}; font-size: 18px; font-weight: 800; color: #1f2937;">${esc(offerSummary)}</p>
              </td>
              <td width="40%" class="yg-stack yg-stack-gap" style="background: #1f2937; padding: 18px; text-align: center;">
                <p style="margin: 0 0 4px; font-family: ${BODY_FONT}; font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #9ca3af;">Code</p>
                <p style="margin: 0; font-family: 'Courier New', monospace; font-size: 15px; font-weight: 700; color: #ffffff;">${esc(couponCode) || "ABC123"}</p>
              </td>
            </tr></table>
            ${expiry ? `<p style="margin: 14px 0 0; font-family: ${BODY_FONT}; font-size: 12px; color: #9ca3af;">Valid until ${esc(expiry)}</p>` : ""}
          </td></tr>
          ${terms ? `<tr><td style="padding: 20px 32px 26px;"><p style="margin: 0; font-family: ${BODY_FONT}; font-size: 11px; line-height: 1.6; color: #9ca3af;">${nl2br(terms)}</p></td></tr>` : `<tr><td style="padding: 0 0 12px;"></td></tr>`}
        </table>`;

  table = wrapFooterRow(table, restaurantName, contactText, footerText, "#9ca3af", accent, options.socialLinks);
  return shell({ title: `${restaurantName} - Offer`, bg: "#f3f4f6", content: table });
}

// ---------------------------------------------------------------------------
// Dimensional / 3D — overlapping cards and strong shadows create real depth
// ---------------------------------------------------------------------------
export function renderDimensional(options: EmailPosterOptions): string {
  const { restaurantName, logoUrl, headline, description, couponCode, terms, heroImageUrl, contactText, footerText } = options;
  const accent = options.primaryColor || "#f59e0b";
  const offerSummary = formatOfferSummary(options);
  const offerCode = couponCode || "ABC123";
  const expiry = formatValidUntil(options.validUntil);

  let table = `        <table role="presentation" width="600" class="yg-container" cellspacing="0" cellpadding="0" style="width: 600px; max-width: 600px; background: #111827;">
          <tr><td class="yg-pad" style="padding: 30px 30px 0;">
            ${logoUrl ? `<img src="${escAttr(logoUrl)}" alt="" style="display: block; width: 30px; height: 30px; border-radius: 8px; object-fit: cover; margin-bottom: 8px;">` : ""}<span style="font-family: ${BODY_FONT}; font-size: 13px; font-weight: 700; color: #f9fafb;">${esc(restaurantName)}</span>
          </td></tr>
          <tr><td style="padding: 20px 30px 0;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td>
              <div style="position: relative; padding: 6px 0 0 24px;">
                <div style="background: #1f2937; border-radius: 16px; padding: 26px 24px; box-shadow: 0 24px 40px -12px rgba(0,0,0,0.6);">
                  <h1 class="yg-h1" style="margin: 0; font-family: ${BODY_FONT}; font-size: 26px; font-weight: 800; line-height: 1.3; color: #f9fafb;">${esc(headline) || "Layers of flavor, layers of savings"}</h1>
                  ${description ? `<p style="margin: 12px 0 0; font-family: ${BODY_FONT}; font-size: 13px; line-height: 1.65; color: #9ca3af;">${nl2br(description)}</p>` : ""}
                </div>
                <div style="background: ${accent}; border-radius: 14px; padding: 16px 20px; margin: -20px 0 0 -24px; max-width: 220px; box-shadow: 0 16px 26px -10px rgba(0,0,0,0.5);">
                  <p style="margin: 0; font-family: ${BODY_FONT}; font-size: 20px; font-weight: 800; color: #111827;">${esc(offerSummary)}</p>
                </div>
              </div>
            </td></tr></table>
          </td></tr>
          ${heroImageUrl ? `<tr><td style="padding: 30px 30px 0;">${heroImage({ url: heroImageUrl, height: 200, radius: "14px", fallbackBg: "" })}</td></tr>` : ""}
          <tr><td style="padding: 26px 30px 0; text-align: center;">
            <span style="display: inline-block; padding: 12px 24px; background: #1f2937; border-radius: 10px; box-shadow: 0 10px 18px -8px rgba(0,0,0,0.5); font-family: 'Courier New', monospace; font-size: 18px; font-weight: 700; color: ${accent};">${esc(offerCode)}</span>
            ${expiry ? `<p style="margin: 12px 0 0; font-family: ${BODY_FONT}; font-size: 12px; color: #9ca3af;">Valid until ${esc(expiry)}</p>` : ""}
          </td></tr>
          ${terms ? `<tr><td style="padding: 22px 30px 0; text-align: center;"><p style="margin: 0; font-family: ${BODY_FONT}; font-size: 11px; line-height: 1.6; color: #6b7280;">${nl2br(terms)}</p></td></tr>` : ""}
        </table>`;

  table = wrapFooterRow(table, restaurantName, contactText, footerText, "#6b7280", accent, options.socialLinks);
  return shell({ title: `${restaurantName} - Offer`, bg: "#000000", content: table });
}

// ---------------------------------------------------------------------------
// Collage — multiple images at different sizes, type layered around them
// ---------------------------------------------------------------------------
export function renderCollage(options: EmailPosterOptions): string {
  const { restaurantName, logoUrl, headline, description, couponCode, terms, heroImageUrl, contactText, footerText } = options;
  const accent = options.primaryColor || "#ea580c";
  const offerSummary = formatOfferSummary(options);
  const expiry = formatValidUntil(options.validUntil);
  // Only real food/menu photography goes in the large collage tiles — a
  // small square logo stretched to fill a 200px-tall crop looks stretched
  // and low-res, so the logo stays confined to its own small badge below
  // and the tiles fall back to color blocks instead when no hero photo
  // exists yet.
  const bigTile = heroImageUrl
    ? `<img src="${escAttr(heroImageUrl)}" alt="" style="display: block; width: 100%; height: 200px; object-fit: cover; border-radius: 12px; transform: rotate(-1deg);">`
    : `<div style="height: 200px; border-radius: 12px; background: linear-gradient(135deg, #fed7aa 0%, #fdba74 100%);"></div>`;
  const smallTile = heroImageUrl
    ? `<img src="${escAttr(heroImageUrl)}" alt="" style="display: block; width: 100%; height: 92px; object-fit: cover; border-radius: 12px; margin-bottom: 8px; transform: rotate(1.5deg); border: 4px solid #ffffff;">`
    : `<div style="height: 92px; border-radius: 12px; margin-bottom: 8px; background: #fdba74;"></div>`;

  let table = `        <table role="presentation" width="600" class="yg-container" cellspacing="0" cellpadding="0" style="width: 600px; max-width: 600px; background: #fff7ed;">
          <tr><td style="padding: 24px 24px 0;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>
              <td width="62%" class="yg-stack" style="vertical-align: top;">
                ${bigTile}
              </td>
              <td width="38%" class="yg-stack yg-stack-gap" style="vertical-align: top; padding-left: 10px;">
                ${smallTile}
                <div style="height: 92px; border-radius: 12px; background: ${accent};"></div>
              </td>
            </tr></table>
          </td></tr>
          <tr><td class="yg-pad" style="padding: 26px 30px 0;">
            ${logoUrl ? `<img src="${escAttr(logoUrl)}" alt="" style="display: block; width: 28px; height: 28px; border-radius: 6px; object-fit: cover; margin-bottom: 8px;">` : ""}
            <span style="font-family: ${BODY_FONT}; font-size: 13px; font-weight: 700; color: #9a3412;">${esc(restaurantName)}</span>
            <h1 class="yg-h1" style="margin: 12px 0 0; font-family: ${HEADLINE_FONT}; font-size: 30px; font-weight: 700; line-height: 1.25; color: #431407;">${esc(headline) || "A collection, just for you"}</h1>
            ${description ? `<p style="margin: 12px 0 0; font-family: ${BODY_FONT}; font-size: 14px; line-height: 1.7; color: #7c2d12;">${nl2br(description)}</p>` : ""}
          </td></tr>
          <tr><td style="padding: 22px 30px 0; text-align: center;">
            <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto;"><tr><td style="padding: 16px 26px; background: #ffffff; border: 2px dashed ${accent}; border-radius: 14px;">
              <span style="font-family: ${BODY_FONT}; font-size: 18px; font-weight: 800; color: ${accent};">${esc(offerSummary)}</span>
              <span style="font-family: 'Courier New', monospace; font-size: 15px; font-weight: 700; color: #431407; margin-left: 14px;">${esc(couponCode) || "ABC123"}</span>
            </td></tr></table>
            ${expiry ? `<p style="margin: 12px 0 0; font-family: ${BODY_FONT}; font-size: 12px; color: #9a3412;">Valid until ${esc(expiry)}</p>` : ""}
          </td></tr>
          ${terms ? `<tr><td style="padding: 22px 30px 0; text-align: center;"><p style="margin: 0; font-family: ${BODY_FONT}; font-size: 11px; line-height: 1.6; color: #9a5b3a;">${nl2br(terms)}</p></td></tr>` : ""}
        </table>`;

  table = wrapFooterRow(table, restaurantName, contactText, footerText, "#9a5b3a", accent, options.socialLinks);
  return shell({ title: `${restaurantName} - A collection`, bg: "#ffedd5", content: table });
}

// ---------------------------------------------------------------------------
// Asymmetric — unequal columns, offset imagery, intentional imbalance
// ---------------------------------------------------------------------------
export function renderAsymmetric(options: EmailPosterOptions): string {
  const { restaurantName, logoUrl, headline, description, couponCode, terms, heroImageUrl, contactText, footerText } = options;
  const accent = options.primaryColor || "#0f766e";
  const offerSummary = formatOfferSummary(options);
  const expiry = formatValidUntil(options.validUntil);

  let table = `        <table role="presentation" width="600" class="yg-container" cellspacing="0" cellpadding="0" style="width: 600px; max-width: 600px; background: #f8f7f4;">
          <tr><td>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>
              <td width="38%" class="yg-stack" style="vertical-align: top;">
                ${heroImage({ url: heroImageUrl, height: 320, fallbackBg: `linear-gradient(180deg, ${accent} 0%, #134e4a 100%)` })}
              </td>
              <td width="62%" class="yg-stack yg-stack-gap" style="vertical-align: top; padding: 40px 32px 0;">
                ${logoUrl ? `<img src="${escAttr(logoUrl)}" alt="" style="width: 30px; height: 30px; border-radius: 6px; object-fit: cover; margin-bottom: 12px;">` : ""}
                <p style="margin: 0 0 8px; font-family: ${BODY_FONT}; font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: ${accent};">${esc(restaurantName)}</p>
                <h1 class="yg-h1" style="margin: 0; font-family: ${HEADLINE_FONT}; font-size: 32px; font-weight: 700; line-height: 1.15; color: #134e4a;">${esc(headline) || "Off-center, on purpose"}</h1>
                ${description ? `<p style="margin: 14px 0 0; font-family: ${BODY_FONT}; font-size: 13px; line-height: 1.7; color: #3f6663;">${nl2br(description)}</p>` : ""}
              </td>
            </tr></table>
          </td></tr>
          <tr><td style="padding: 30px 32px 0;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>
              <td width="70%" class="yg-stack">
                <p style="margin: 0 0 4px; font-family: ${BODY_FONT}; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: ${accent};">Offer</p>
                <p style="margin: 0; font-family: ${BODY_FONT}; font-size: 22px; font-weight: 800; color: #134e4a;">${esc(offerSummary)}</p>
                ${expiry ? `<p style="margin: 4px 0 0; font-family: ${BODY_FONT}; font-size: 12px; color: #6b8f8c;">Valid until ${esc(expiry)}</p>` : ""}
              </td>
              <td width="30%" class="yg-stack yg-stack-gap" align="right" style="vertical-align: middle;">
                <span style="display: inline-block; padding: 8px 14px; background: #ffffff; border: 1px solid ${accent}; border-radius: 8px; font-family: 'Courier New', monospace; font-size: 13px; font-weight: 700; color: #134e4a;">${esc(couponCode) || "ABC123"}</span>
              </td>
            </tr></table>
          </td></tr>
          ${terms ? `<tr><td style="padding: 20px 32px 0;"><p style="margin: 0; font-family: ${BODY_FONT}; font-size: 11px; line-height: 1.6; color: #6b8f8c;">${nl2br(terms)}</p></td></tr>` : ""}
        </table>`;

  table = wrapFooterRow(table, restaurantName, contactText, footerText, "#6b8f8c", accent, options.socialLinks);
  return shell({ title: `${restaurantName} - Offer`, bg: "#eef0ec", content: table });
}
