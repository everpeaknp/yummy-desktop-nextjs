/**
 * Foundational family: minimalist, maximalist, modern, luxury, editorial,
 * bold, elegant, playful. See ../email-poster-html.ts for the shared
 * primitives every renderer here is built from.
 */
import {
  type EmailPosterOptions,
  esc,
  escAttr,
  nl2br,
  formatOfferSummary,
  formatOfferHeadline,
  formatValidUntil,
  shell,
  wrapFooterRow,
  heroImage,
  badge,
  BODY_FONT,
  HEADLINE_FONT,
} from "../email-poster-html";

// ---------------------------------------------------------------------------
// Minimalist — whitespace-forward, single image, one quiet text link
// ---------------------------------------------------------------------------
export function renderMinimalist(options: EmailPosterOptions): string {
  const { restaurantName, logoUrl, headline, description, couponCode, terms, heroImageUrl, contactText, footerText } = options;
  const accent = options.primaryColor || "#111111";
  const offerSummary = formatOfferSummary(options);
  const expiry = formatValidUntil(options.validUntil);

  let table = `        <table role="presentation" width="560" class="yg-container" cellspacing="0" cellpadding="0" style="width: 560px; max-width: 560px;">
          <tr><td class="yg-pad" style="padding: 56px 24px 0; text-align: center;">
            ${logoUrl ? `<img src="${escAttr(logoUrl)}" alt="" style="display: block; margin: 0 auto 24px; width: 28px; height: 28px; border-radius: 6px; object-fit: cover;">` : ""}
            <p style="margin: 0 0 40px; font-family: ${BODY_FONT}; font-size: 12px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: #737373;">${esc(restaurantName)}</p>
          </td></tr>
          ${heroImageUrl ? `<tr><td class="yg-pad-sm" style="padding: 0 24px;">${heroImage({ url: heroImageUrl, height: 260, radius: "6px", fallbackBg: "" })}</td></tr>` : ""}
          <tr><td class="yg-pad" style="padding: ${heroImageUrl ? "36" : "0"}px 40px 0; text-align: center;">
            <h1 class="yg-h1" style="margin: 0; font-family: ${BODY_FONT}; font-size: 30px; font-weight: 600; letter-spacing: -0.01em; line-height: 1.35; color: #111111;">${esc(headline) || "A small offer, made for you"}</h1>
            ${description ? `<p style="margin: 18px 0 0; font-family: ${BODY_FONT}; font-size: 15px; line-height: 1.7; color: #525252;">${nl2br(description)}</p>` : ""}
          </td></tr>
          <tr><td style="padding: 40px 40px 0; text-align: center;">
            <p style="margin: 0 0 6px; font-family: ${BODY_FONT}; font-size: 26px; font-weight: 700; color: #111111;">${esc(offerSummary)}</p>
            ${expiry ? `<p style="margin: 0; font-family: ${BODY_FONT}; font-size: 13px; color: #a3a3a3;">Through ${esc(expiry)}</p>` : ""}
          </td></tr>
          <tr><td style="padding: 26px 40px 0; text-align: center;">
            <p style="margin: 0; font-family: 'Courier New', monospace; font-size: 20px; font-weight: 700; letter-spacing: 0.2em; color: #111111; border-bottom: 1px solid ${accent}; display: inline-block; padding-bottom: 6px;">${esc(couponCode) || "ABC123"}</p>
          </td></tr>
          ${terms ? `<tr><td style="padding: 34px 40px 0; text-align: center;"><p style="margin: 0; font-family: ${BODY_FONT}; font-size: 11px; line-height: 1.7; color: #a3a3a3;">${nl2br(terms)}</p></td></tr>` : ""}
        </table>`;

  table = wrapFooterRow(table, restaurantName, options.restaurantAddress, contactText, footerText, "#a3a3a3", "#737373", options.socialLinks);
  return shell({ title: `${restaurantName} - Offer`, bg: "#ffffff", content: table });
}

// ---------------------------------------------------------------------------
// Maximalist — layered sections, bold color, multiple visual blocks
// ---------------------------------------------------------------------------
export function renderMaximalist(options: EmailPosterOptions): string {
  const { restaurantName, logoUrl, headline, description, couponCode, terms, heroImageUrl, contactText, footerText } = options;
  const accent = options.primaryColor || "#db2777";
  const accent2 = "#fbbf24";
  const offerSummary = formatOfferSummary(options);
  const offerHeadline = formatOfferHeadline(options);
  const expiry = formatValidUntil(options.validUntil);

  let table = `        <table role="presentation" width="600" class="yg-container" cellspacing="0" cellpadding="0" style="width: 600px; max-width: 600px; background: #fef08a;">
          <tr><td style="height: 10px; background: linear-gradient(90deg, ${accent} 0%, ${accent2} 50%, ${accent} 100%);"></td></tr>
          <tr><td class="yg-pad" style="padding: 30px 28px 0;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>
              <td style="vertical-align: top;">${logoUrl ? `<img src="${escAttr(logoUrl)}" alt="" style="display: block; width: 40px; height: 40px; border-radius: 10px; object-fit: cover; border: 3px solid #1e1b4b; margin-bottom: 8px;">` : ""}<span style="font-family: ${BODY_FONT}; font-size: 15px; font-weight: 800; color: #1e1b4b;">${esc(restaurantName)}</span></td>
              <td align="right" style="vertical-align: top;">${badge({ label: "Big news", bg: "#1e1b4b", color: "#fef08a" })}</td>
            </tr></table>
          </td></tr>
          <tr><td style="padding: 22px 28px 0;">
            <div style="background: #1e1b4b; border-radius: 18px; padding: 30px 26px; position: relative;">
              <h1 class="yg-h1" style="margin: 0; font-family: ${HEADLINE_FONT}; font-size: 40px; font-weight: 700; line-height: 1.08; color: #fef08a;">${esc(headline) || "Everything, all at once"}</h1>
              ${description ? `<p style="margin: 14px 0 0; font-family: ${BODY_FONT}; font-size: 14px; line-height: 1.7; color: #e9d8fd;">${nl2br(description)}</p>` : ""}
            </div>
          </td></tr>
          ${heroImageUrl ? `<tr><td style="padding: 22px 28px 0;">${heroImage({ url: heroImageUrl, height: 220, radius: "16px", fallbackBg: "" })}</td></tr>` : ""}
          <tr><td style="padding: 26px 20px 0;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>
              <td width="55%" class="yg-stack" style="padding: 0 8px;">
                <div style="background: #ffffff; border: 3px solid #1e1b4b; border-radius: 16px; padding: 22px; text-align: center; box-shadow: 6px 6px 0 ${accent};">
                  <p style="margin: 0 0 6px; font-family: ${BODY_FONT}; font-size: 11px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: ${accent};">Save big</p>
                  <p style="margin: 0; font-family: ${HEADLINE_FONT}; font-size: 42px; font-weight: 700; color: #1e1b4b; line-height: 1;">${esc(offerHeadline)}</p>
                </div>
              </td>
              <td width="45%" class="yg-stack yg-stack-gap" style="padding: 0 8px;">
                <div style="background: ${accent2}; border: 3px solid #1e1b4b; border-radius: 16px; padding: 18px; text-align: center; box-shadow: 6px 6px 0 #1e1b4b; height: 100%; box-sizing: border-box;">
                  <p style="margin: 0 0 6px; font-family: ${BODY_FONT}; font-size: 10px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: #1e1b4b;">Code</p>
                  <p style="margin: 0; font-family: 'Courier New', monospace; font-size: 20px; font-weight: 800; color: #1e1b4b;">${esc(couponCode) || "ABC123"}</p>
                </div>
              </td>
            </tr></table>
          </td></tr>
          <tr><td style="padding: 10px 28px 0; text-align: center;"><p style="margin: 0; font-family: ${BODY_FONT}; font-size: 13px; font-weight: 700; color: #1e1b4b;">${esc(offerSummary)}${expiry ? ` · Ends ${esc(expiry)}` : ""}</p></td></tr>
          ${terms ? `<tr><td style="padding: 22px 28px 0; text-align: center;"><p style="margin: 0; font-family: ${BODY_FONT}; font-size: 11px; line-height: 1.6; color: #4c1d95;">${nl2br(terms)}</p></td></tr>` : ""}
        </table>`;

  table = wrapFooterRow(table, restaurantName, options.restaurantAddress, contactText, footerText, "#78350f", "#1e1b4b", options.socialLinks);
  return shell({ title: `${restaurantName} - A lot going on`, bg: "#fde68a", content: table });
}

// ---------------------------------------------------------------------------
// Modern — SaaS-clean: cards, subtle shadows, balanced whitespace
// ---------------------------------------------------------------------------
export function renderModern(options: EmailPosterOptions): string {
  const { restaurantName, logoUrl, headline, description, couponCode, terms, heroImageUrl, contactText, footerText } = options;
  const accent = options.primaryColor || "#6366f1";
  const offerSummary = formatOfferSummary(options);
  const expiry = formatValidUntil(options.validUntil);

  let table = `        <table role="presentation" width="600" class="yg-container" cellspacing="0" cellpadding="0" style="width: 600px; max-width: 600px; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0;">
          <tr><td class="yg-pad" style="padding: 32px 36px 0;">
            ${logoUrl ? `<img src="${escAttr(logoUrl)}" alt="" style="display: block; width: 32px; height: 32px; border-radius: 8px; object-fit: cover; margin-bottom: 10px;">` : ""}<span style="font-family: ${BODY_FONT}; font-size: 14px; font-weight: 700; color: #0f172a;">${esc(restaurantName)}</span>
          </td></tr>
          ${heroImageUrl ? `<tr><td style="padding: 22px 36px 0;">${heroImage({ url: heroImageUrl, height: 220, radius: "12px", fallbackBg: "" })}</td></tr>` : ""}
          <tr><td class="yg-pad" style="padding: 26px 36px 0;">
            <h1 class="yg-h1" style="margin: 0; font-family: ${BODY_FONT}; font-size: 28px; font-weight: 700; letter-spacing: -0.01em; line-height: 1.3; color: #0f172a;">${esc(headline) || "A little something for your next visit"}</h1>
            ${description ? `<p style="margin: 12px 0 0; font-family: ${BODY_FONT}; font-size: 14px; line-height: 1.65; color: #64748b;">${nl2br(description)}</p>` : ""}
          </td></tr>
          <tr><td style="padding: 22px 36px 0;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; box-shadow: 0 1px 2px rgba(15,23,42,0.04);"><tr><td style="padding: 22px 24px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>
                <td>
                  <p style="margin: 0 0 4px; font-family: ${BODY_FONT}; font-size: 11px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: ${accent};">Your offer</p>
                  <p style="margin: 0; font-family: ${BODY_FONT}; font-size: 20px; font-weight: 700; color: #0f172a;">${esc(offerSummary)}</p>
                  ${expiry ? `<p style="margin: 4px 0 0; font-family: ${BODY_FONT}; font-size: 12px; color: #94a3b8;">Valid until ${esc(expiry)}</p>` : ""}
                </td>
                <td align="right" style="vertical-align: middle;">
                  <span style="display: inline-block; padding: 8px 14px; background: #ffffff; border: 1px dashed ${accent}; border-radius: 8px; font-family: 'Courier New', monospace; font-size: 15px; font-weight: 700; color: #0f172a;">${esc(couponCode) || "ABC123"}</span>
                </td>
              </tr></table>
            </td></tr></table>
          </td></tr>
          ${terms ? `<tr><td style="padding: 20px 36px 0;"><p style="margin: 0; font-family: ${BODY_FONT}; font-size: 11px; line-height: 1.6; color: #94a3b8;">${nl2br(terms)}</p></td></tr>` : ""}
        </table>`;

  table = wrapFooterRow(table, restaurantName, options.restaurantAddress, contactText, footerText, "#94a3b8", accent, options.socialLinks);
  return shell({ title: `${restaurantName} - Offer`, bg: "#f1f5f9", content: table });
}

// ---------------------------------------------------------------------------
// Luxury — editorial elegance, serif type, minimal color, small refined CTA
// ---------------------------------------------------------------------------
export function renderLuxury(options: EmailPosterOptions): string {
  const { restaurantName, logoUrl, headline, description, couponCode, terms, heroImageUrl, contactText, footerText } = options;
  const accent = options.primaryColor || "#9a7b3f";
  const offerSummary = formatOfferSummary(options);
  const expiry = formatValidUntil(options.validUntil);

  const hero = heroImage({
    url: heroImageUrl,
    height: 300,
    radius: "4px",
    fallbackBg: "linear-gradient(135deg, #f1ece0 0%, #e8ddc7 100%)",
    fallbackContent: `<table role="presentation" cellspacing="0" cellpadding="0" style="margin: auto;"><tr><td style="width: 64px; height: 64px; border: 1px solid ${accent}; border-radius: 50%; text-align: center; vertical-align: middle; font-family: ${HEADLINE_FONT}; font-size: 22px; color: ${accent};">${esc((restaurantName || "Y").charAt(0).toUpperCase())}</td></tr></table>`,
  });

  const content = `        <table role="presentation" width="600" class="yg-container" cellspacing="0" cellpadding="0" style="width: 600px; max-width: 600px;">
          <tr><td class="yg-pad" style="padding: 40px 44px 0;">
            ${logoUrl ? `<img src="${escAttr(logoUrl)}" alt="" style="display: block; margin: 0 auto 18px; width: 48px; height: 48px; border-radius: 50%; object-fit: cover;">` : ""}
            <p style="margin: 0 0 10px; text-align: center; font-family: ${BODY_FONT}; font-size: 11px; font-weight: 600; letter-spacing: 0.28em; text-transform: uppercase; color: #8a7b5e;">${esc(restaurantName)}</p>
            <div style="width: 36px; height: 1px; background: ${accent}; margin: 0 auto 28px;"></div>
          </td></tr>
          <tr><td class="yg-pad-sm" style="padding: 0 44px;">${hero}</td></tr>
          <tr><td class="yg-pad" style="padding: 34px 44px 0; text-align: center;">
            <h1 class="yg-h1" style="margin: 0 0 16px; font-family: ${HEADLINE_FONT}; font-style: italic; font-weight: 600; font-size: 34px; line-height: 1.35; color: #1c1917;">${esc(headline) || "A quiet invitation, just for you"}</h1>
            ${description ? `<p style="margin: 0 0 26px; font-family: ${BODY_FONT}; font-size: 14px; line-height: 1.8; color: #6b6355;">${nl2br(description)}</p>` : ""}
          </td></tr>
          <tr><td class="yg-pad" style="padding: 6px 44px 0;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-top: 1px solid #e7e0d0; border-bottom: 1px solid #e7e0d0;"><tr><td style="padding: 28px 0; text-align: center;">
              <p style="margin: 0 0 6px; font-family: ${BODY_FONT}; font-size: 10px; font-weight: 600; letter-spacing: 0.24em; text-transform: uppercase; color: #8a7b5e;">Your offer</p>
              <p style="margin: 0 0 18px; font-family: ${HEADLINE_FONT}; font-size: 30px; color: ${accent};">${esc(offerSummary)}</p>
              <p style="margin: 0 0 4px; font-family: ${BODY_FONT}; font-size: 10px; font-weight: 600; letter-spacing: 0.2em; text-transform: uppercase; color: #8a7b5e;">Code</p>
              <p style="margin: 0; font-family: 'Courier New', monospace; font-size: 22px; font-weight: 700; letter-spacing: 0.3em; color: #1c1917;">${esc(couponCode) || "ABC123"}</p>
              ${expiry ? `<p style="margin: 16px 0 0; font-family: ${BODY_FONT}; font-size: 12px; color: #8a7b5e;">Valid through ${esc(expiry)}</p>` : ""}
            </td></tr></table>
          </td></tr>
          ${terms ? `<tr><td style="padding: 30px 44px 0; text-align: center;"><p style="margin: 0; font-family: ${BODY_FONT}; font-size: 11px; line-height: 1.7; color: #a39a86;">${nl2br(terms)}</p></td></tr>` : ""}
        </table>`;

  return shell({ title: `${restaurantName} - An exclusive invitation`, bg: "#f4f0e6", content: wrapFooterRow(content, restaurantName, contactText, footerText, "#a39a86", "#8a7b5e", options.socialLinks) });
}

// ---------------------------------------------------------------------------
// Editorial / Magazine — asymmetric masthead, pull-quote offer, stacked blocks
// ---------------------------------------------------------------------------
export function renderEditorial(options: EmailPosterOptions): string {
  const { restaurantName, logoUrl, headline, description, couponCode, terms, heroImageUrl, contactText, footerText } = options;
  const accent = options.primaryColor || "#b3452c";
  const offerSummary = formatOfferSummary(options);
  const expiry = formatValidUntil(options.validUntil);

  let table = `        <table role="presentation" width="600" class="yg-container" cellspacing="0" cellpadding="0" style="width: 600px; max-width: 600px; background: #fbfaf7;">
          <tr><td class="yg-pad" style="padding: 40px 40px 0;">
            ${logoUrl ? `<img src="${escAttr(logoUrl)}" alt="" style="display: block; width: 44px; height: 44px; border-radius: 8px; object-fit: cover; margin-bottom: 16px;">` : ""}
            <p style="margin: 0 0 6px; font-family: ${BODY_FONT}; font-size: 11px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; color: ${accent};">The offer issue</p>
            <h1 class="yg-h1" style="margin: 0; font-family: ${HEADLINE_FONT}; font-size: 40px; font-weight: 700; line-height: 1.05; color: #1a1a1a;">${esc(restaurantName)}</h1>
            <div style="height: 3px; background: #1a1a1a; margin: 18px 0 0;"></div>
          </td></tr>
          ${heroImageUrl ? `<tr><td style="padding: 26px 40px 0;">${heroImage({ url: heroImageUrl, height: 260, fallbackBg: "" })}<p style="margin: 8px 0 0; font-family: ${BODY_FONT}; font-style: italic; font-size: 11px; color: #9a9284;">${esc(headline) || "This season's feature"}</p></td></tr>` : ""}
          <tr><td class="yg-pad" style="padding: ${heroImageUrl ? "8" : "34"}px 40px 0;">
            <h2 class="yg-h1" style="margin: 0; font-family: ${HEADLINE_FONT}; font-style: italic; font-size: 28px; line-height: 1.4; color: #1a1a1a;">${heroImageUrl ? "" : `“${esc(headline) || "A story worth returning for"}”`}</h2>
            ${description ? `<p style="margin: 16px 0 0; font-family: ${BODY_FONT}; font-size: 14px; line-height: 1.85; color: #4a4a4a;">${nl2br(description)}</p>` : ""}
          </td></tr>
          <tr><td style="padding: 30px 40px 0;"><div style="border-top: 1px solid #dedad0;"></div></td></tr>
          <tr><td class="yg-pad" style="padding: 26px 40px 0; text-align: center;">
            <p style="margin: 0 0 8px; font-family: ${BODY_FONT}; font-size: 10px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; color: #9a9284;">Featured offer</p>
            <p style="margin: 0 0 16px; font-family: ${HEADLINE_FONT}; font-size: 36px; color: ${accent};">${esc(offerSummary)}</p>
            <p style="margin: 0; font-family: 'Courier New', monospace; font-size: 20px; font-weight: 700; letter-spacing: 0.18em; color: #1a1a1a;">${esc(couponCode) || "ABC123"}</p>
            ${expiry ? `<p style="margin: 12px 0 0; font-family: ${BODY_FONT}; font-size: 12px; color: #9a9284;">Available through ${esc(expiry)}</p>` : ""}
          </td></tr>
          ${terms ? `<tr><td style="padding: 30px 40px 0;"><div style="border-top: 1px solid #dedad0; margin-bottom: 16px;"></div><p style="margin: 0; font-family: ${BODY_FONT}; font-size: 11px; line-height: 1.7; color: #9a9284;">${nl2br(terms)}</p></td></tr>` : ""}
        </table>`;

  table = wrapFooterRow(table, restaurantName, options.restaurantAddress, contactText, footerText, "#9a9284", accent, options.socialLinks);
  return shell({ title: `${restaurantName} - Feature offer`, bg: "#efece4", content: table });
}

// ---------------------------------------------------------------------------
// Bold — huge headline, strong contrast, one CTA, minimal supporting copy
// ---------------------------------------------------------------------------
export function renderBold(options: EmailPosterOptions): string {
  const { restaurantName, logoUrl, headline, description, couponCode, terms, contactText, footerText } = options;
  const accent = options.primaryColor || "#facc15";
  const offerHeadline = formatOfferHeadline(options);
  const offerSummary = formatOfferSummary(options);
  const expiry = formatValidUntil(options.validUntil);

  let table = `        <table role="presentation" width="600" class="yg-container" cellspacing="0" cellpadding="0" style="width: 600px; max-width: 600px; background: #000000;">
          <tr><td class="yg-pad" style="padding: 40px 36px 0; text-align: center;">
            ${logoUrl ? `<img src="${escAttr(logoUrl)}" alt="" style="display: block; margin: 0 auto 16px; width: 36px; height: 36px; border-radius: 6px; object-fit: cover;">` : ""}
            <p style="margin: 0 0 18px; font-family: ${BODY_FONT}; font-size: 12px; font-weight: 800; letter-spacing: 0.24em; text-transform: uppercase; color: #ffffff;">${esc(restaurantName)}</p>
            <p class="yg-h2" style="margin: 0; font-family: ${HEADLINE_FONT}; font-size: 84px; font-weight: 700; line-height: 0.95; color: ${accent};">${esc(offerHeadline)}</p>
            <h1 class="yg-h1" style="margin: 10px 0 0; font-family: ${BODY_FONT}; font-size: 24px; font-weight: 800; letter-spacing: -0.01em; line-height: 1.3; color: #ffffff;">${esc(headline) || "Off your next order"}</h1>
            ${description ? `<p style="margin: 14px 0 0; font-family: ${BODY_FONT}; font-size: 14px; line-height: 1.65; color: #d4d4d4;">${nl2br(description)}</p>` : ""}
          </td></tr>
          <tr><td style="padding: 22px 36px 0; text-align: center;">
            <p style="margin: 0; font-family: ${BODY_FONT}; font-size: 14px; color: #d4d4d4;">${esc(offerSummary)}${expiry ? ` · Ends ${esc(expiry)}` : ""}</p>
          </td></tr>
          <tr><td style="padding: 26px 36px 0; text-align: center;">
            <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto;"><tr><td style="padding: 16px 30px; border: 2px solid ${accent};">
              <span style="font-family: 'Courier New', monospace; font-size: 26px; font-weight: 700; letter-spacing: 0.16em; color: #ffffff;">${esc(couponCode) || "ABC123"}</span>
            </td></tr></table>
          </td></tr>
          ${terms ? `<tr><td style="padding: 24px 36px 0; text-align: center;"><p style="margin: 0; font-family: ${BODY_FONT}; font-size: 11px; line-height: 1.6; color: #737373;">${nl2br(terms)}</p></td></tr>` : ""}
        </table>`;

  table = wrapFooterRow(table, restaurantName, options.restaurantAddress, contactText, footerText, "#737373", accent, options.socialLinks);
  return shell({ title: `${restaurantName} - Big offer`, bg: "#000000", content: table });
}

// ---------------------------------------------------------------------------
// Elegant — softer than Luxury: thin borders, spacious, gentle neutrals
// ---------------------------------------------------------------------------
export function renderElegant(options: EmailPosterOptions): string {
  const { restaurantName, logoUrl, headline, description, couponCode, terms, heroImageUrl, contactText, footerText } = options;
  const accent = options.primaryColor || "#b08968";
  const offerSummary = formatOfferSummary(options);
  const expiry = formatValidUntil(options.validUntil);

  let table = `        <table role="presentation" width="600" class="yg-container" cellspacing="0" cellpadding="0" style="width: 600px; max-width: 600px; background: #ffffff; border: 1px solid #ece5db;">
          <tr><td class="yg-pad" style="padding: 46px 46px 0; text-align: center;">
            ${logoUrl ? `<img src="${escAttr(logoUrl)}" alt="" style="display: block; margin: 0 auto 16px; width: 44px; height: 44px; border-radius: 50%; object-fit: cover;">` : ""}
            <p style="margin: 0 0 14px; font-family: ${BODY_FONT}; font-size: 11px; font-weight: 500; letter-spacing: 0.22em; text-transform: uppercase; color: #a9987f;">${esc(restaurantName)}</p>
            <h1 class="yg-h1" style="margin: 0; font-family: ${HEADLINE_FONT}; font-size: 30px; font-weight: 600; line-height: 1.4; color: #3f3a34;">${esc(headline) || "A gentle invitation"}</h1>
            ${description ? `<p style="margin: 16px 0 0; font-family: ${BODY_FONT}; font-size: 14px; line-height: 1.85; color: #7a7166;">${nl2br(description)}</p>` : ""}
          </td></tr>
          ${heroImageUrl ? `<tr><td style="padding: 34px 46px 0;">${heroImage({ url: heroImageUrl, height: 240, radius: "2px", fallbackBg: "" })}</td></tr>` : ""}
          <tr><td class="yg-pad" style="padding: 34px 46px 0; text-align: center;">
            <div style="width: 24px; height: 1px; background: ${accent}; margin: 0 auto 24px;"></div>
            <p style="margin: 0 0 6px; font-family: ${BODY_FONT}; font-size: 10px; font-weight: 500; letter-spacing: 0.2em; text-transform: uppercase; color: #a9987f;">Your offer</p>
            <p style="margin: 0 0 18px; font-family: ${HEADLINE_FONT}; font-size: 26px; color: ${accent};">${esc(offerSummary)}</p>
            <p style="margin: 0; font-family: 'Courier New', monospace; font-size: 18px; font-weight: 600; letter-spacing: 0.24em; color: #3f3a34;">${esc(couponCode) || "ABC123"}</p>
            ${expiry ? `<p style="margin: 14px 0 0; font-family: ${BODY_FONT}; font-size: 12px; color: #a9987f;">Through ${esc(expiry)}</p>` : ""}
            <div style="width: 24px; height: 1px; background: ${accent}; margin: 24px auto 0;"></div>
          </td></tr>
          ${terms ? `<tr><td style="padding: 30px 46px 0; text-align: center;"><p style="margin: 0; font-family: ${BODY_FONT}; font-size: 11px; line-height: 1.7; color: #b3a894;">${nl2br(terms)}</p></td></tr>` : ""}
        </table>`;

  table = wrapFooterRow(table, restaurantName, options.restaurantAddress, contactText, footerText, "#b3a894", accent, options.socialLinks);
  return shell({ title: `${restaurantName} - An invitation`, bg: "#f7f4ef", content: table });
}

// ---------------------------------------------------------------------------
// Playful — bright controlled color, rounded shapes, energetic CTA
// ---------------------------------------------------------------------------
export function renderPlayful(options: EmailPosterOptions): string {
  const { restaurantName, logoUrl, headline, description, couponCode, terms, heroImageUrl, contactText, footerText } = options;
  const accent = options.primaryColor || "#fb7185";
  const offerSummary = formatOfferSummary(options);
  const offerHeadline = formatOfferHeadline(options);
  const expiry = formatValidUntil(options.validUntil);

  const badgeRow = `<table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto 14px;"><tr><td style="padding: 6px 16px; background: #ffe4e6; border-radius: 999px;"><span style="font-family: ${BODY_FONT}; font-size: 11px; font-weight: 800; color: ${accent};">&#127881; Yay, a treat!</span></td></tr></table>`;

  let table = `        <table role="presentation" width="600" class="yg-container" cellspacing="0" cellpadding="0" style="width: 600px; max-width: 600px; background: #fff1f5; border-radius: 28px; overflow: hidden;">
          <tr><td class="yg-pad" style="padding: 34px 32px 0; text-align: center;">
            ${logoUrl ? `<img src="${escAttr(logoUrl)}" alt="" style="display: block; margin: 0 auto 12px; width: 56px; height: 56px; border-radius: 50%; object-fit: cover; border: 3px solid #ffffff; box-shadow: 0 4px 10px rgba(251,113,133,0.25);">` : ""}
            <p style="margin: 0 0 10px; font-family: ${BODY_FONT}; font-size: 13px; font-weight: 800; color: ${accent};">${esc(restaurantName)}</p>
            ${badgeRow}
            <h1 class="yg-h1" style="margin: 0; font-family: ${BODY_FONT}; font-size: 28px; font-weight: 800; line-height: 1.3; color: #831843;">${esc(headline) || "Something sweet is waiting"}</h1>
            ${description ? `<p style="margin: 12px 0 0; font-family: ${BODY_FONT}; font-size: 14px; line-height: 1.7; color: #9d174d;">${nl2br(description)}</p>` : ""}
          </td></tr>
          ${heroImageUrl ? `<tr><td style="padding: 22px 32px 0;">${heroImage({ url: heroImageUrl, height: 220, radius: "20px", fallbackBg: "" })}</td></tr>` : ""}
          <tr><td style="padding: 24px 32px 0; text-align: center;">
            <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto;"><tr><td style="padding: 20px 30px; background: #ffffff; border-radius: 22px; box-shadow: 0 8px 18px rgba(251,113,133,0.18);">
              <p style="margin: 0 0 4px; font-family: ${HEADLINE_FONT}; font-size: 36px; font-weight: 700; color: ${accent};">${esc(offerHeadline)}</p>
              <p style="margin: 0; font-family: ${BODY_FONT}; font-size: 12px; color: #9d174d;">${esc(offerSummary)}</p>
            </td></tr></table>
          </td></tr>
          <tr><td style="padding: 20px 32px 0; text-align: center;">
            <span style="display: inline-block; padding: 10px 20px; background: #ffe4e6; border-radius: 999px; font-family: 'Courier New', monospace; font-size: 16px; font-weight: 700; color: #831843;">${esc(couponCode) || "ABC123"}</span>
            ${expiry ? `<p style="margin: 10px 0 0; font-family: ${BODY_FONT}; font-size: 12px; color: #9d174d;">Ends ${esc(expiry)} — don't miss out!</p>` : ""}
          </td></tr>
          ${terms ? `<tr><td style="padding: 22px 32px 0; text-align: center;"><p style="margin: 0; font-family: ${BODY_FONT}; font-size: 11px; line-height: 1.6; color: #be185d;">${nl2br(terms)}</p></td></tr>` : ""}
        </table>`;

  table = wrapFooterRow(table, restaurantName, options.restaurantAddress, contactText, footerText, "#be185d", accent, options.socialLinks);
  return shell({ title: `${restaurantName} - A treat for you`, bg: "#ffe4e6", content: table });
}
