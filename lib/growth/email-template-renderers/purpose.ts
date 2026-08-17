/**
 * Purpose-driven family: promotional, conversion-focused, product-showcase,
 * announcement, newsletter, storytelling, festival, seasonal, flash-sale,
 * personalized, restaurant-menu, invitation, thank-you.
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
  divider,
  badge,
  priceBlock,
  BODY_FONT,
  HEADLINE_FONT,
} from "../email-poster-html";

// ---------------------------------------------------------------------------
// Promotional — offer immediately visible, strong CTA (the original "modern")
// ---------------------------------------------------------------------------
export function renderPromotional(options: EmailPosterOptions): string {
  const { restaurantName, logoUrl, headline, description, couponCode, terms, contactText, footerText, originalPrice, offerPrice } = options;
  const accent = options.primaryColor || "#ea580c";
  const offerSummary = formatOfferSummary(options);
  const offerHeadline = formatOfferHeadline(options);
  const expiry = formatValidUntil(options.validUntil);
  const price = priceBlock({ original: originalPrice, offer: offerPrice, accent, size: 30 });

  let table = `        <table role="presentation" width="600" class="yg-container" cellspacing="0" cellpadding="0" style="width: 600px; max-width: 600px; background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 12px 32px rgba(15,23,42,0.12);">
          <tr><td class="yg-pad" style="padding: 30px 32px; background: linear-gradient(135deg, ${accent} 0%, ${accent}cc 100%);">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>
              <td style="vertical-align: top;">
                ${logoUrl ? `<img src="${escAttr(logoUrl)}" alt="" style="display: block; width: 34px; height: 34px; border-radius: 8px; object-fit: cover; margin-bottom: 8px;">` : ""}
                <span style="font-family: ${BODY_FONT}; font-size: 14px; font-weight: 700; color: #ffffff; letter-spacing: 0.02em;">${esc(restaurantName)}</span>
              </td>
              <td align="right" style="vertical-align: top;">${badge({ label: "Offer inside", bg: "rgba(255,255,255,0.22)", color: "#ffffff" })}</td>
            </tr></table>
            <h1 class="yg-h1" style="margin: 22px 0 0; font-family: ${HEADLINE_FONT}; font-size: 32px; font-weight: 700; line-height: 1.25; color: #ffffff;">${esc(headline) || "Your next visit just got sweeter"}</h1>
            ${description ? `<p style="margin: 12px 0 0; font-family: ${BODY_FONT}; font-size: 14px; line-height: 1.6; color: rgba(255,255,255,0.92);">${nl2br(description)}</p>` : ""}
          </td></tr>
          <tr><td class="yg-pad" style="padding: 30px 32px 0;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #fff7ed; border-radius: 16px;"><tr><td style="padding: 26px 24px; text-align: center;">
              <p style="margin: 0 0 6px; font-family: ${BODY_FONT}; font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: ${accent};">Save</p>
              <p class="yg-h2" style="margin: 0 0 4px; font-family: ${HEADLINE_FONT}; font-size: 52px; font-weight: 700; line-height: 1; color: ${accent};">${esc(offerHeadline)}</p>
              ${price || `<p style="margin: 0 0 18px; font-family: ${BODY_FONT}; font-size: 13px; font-weight: 600; color: #7c3f10;">${esc(offerSummary)}</p>`}
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 12px auto 0;"><tr><td style="padding: 12px 22px; border: 2px dashed ${accent}; border-radius: 10px; background: #ffffff;">
                <span style="font-family: 'Courier New', monospace; font-size: 22px; font-weight: 700; letter-spacing: 0.16em; color: #1a1a1a;">${esc(couponCode) || "ABC123"}</span>
              </td></tr></table>
              ${expiry ? `<p style="margin: 16px 0 0; font-family: ${BODY_FONT}; font-size: 12px; font-weight: 600; color: #9a3412;">⏰ Ends ${esc(expiry)}</p>` : ""}
            </td></tr></table>
          </td></tr>
          ${terms ? `<tr><td style="padding: 22px 32px 0;"><p style="margin: 0; font-family: ${BODY_FONT}; font-size: 11px; line-height: 1.6; color: #94a3b8; text-align: center;">${nl2br(terms)}</p></td></tr>` : ""}
        </table>`;

  table = wrapFooterRow(table, restaurantName, contactText, footerText, "#94a3b8", "#64748b", options.socialLinks);
  return shell({ title: `${restaurantName} - Special offer`, bg: "#f1f5f9", content: table });
}

// ---------------------------------------------------------------------------
// Conversion-Focused — hero → value → offer → benefits → CTA, no distractions
// ---------------------------------------------------------------------------
export function renderConversionFocused(options: EmailPosterOptions): string {
  const { restaurantName, logoUrl, headline, description, couponCode, terms, contactText, footerText } = options;
  const accent = options.primaryColor || "#16a34a";
  const offerSummary = formatOfferSummary(options);
  const expiry = formatValidUntil(options.validUntil);
  const benefits = ["No minimum hassle", "Redeem in one tap", "Valid at checkout"];

  let table = `        <table role="presentation" width="600" class="yg-container" cellspacing="0" cellpadding="0" style="width: 600px; max-width: 600px; background: #ffffff;">
          <tr><td class="yg-pad" style="padding: 34px 36px 0; text-align: center;">
            ${logoUrl ? `<img src="${escAttr(logoUrl)}" alt="" style="display: block; margin: 0 auto 12px; width: 36px; height: 36px; border-radius: 8px; object-fit: cover;">` : ""}
            <p style="margin: 0 0 14px; font-family: ${BODY_FONT}; font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #16a34a;">${esc(restaurantName)}</p>
            <h1 class="yg-h1" style="margin: 0; font-family: ${BODY_FONT}; font-size: 30px; font-weight: 800; line-height: 1.25; color: #052e16;">${esc(headline) || "One offer. One click. Done."}</h1>
            ${description ? `<p style="margin: 14px 0 0; font-family: ${BODY_FONT}; font-size: 14px; line-height: 1.7; color: #14532d;">${nl2br(description)}</p>` : ""}
          </td></tr>
          <tr><td style="padding: 26px 36px 0; text-align: center;">
            <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto;"><tr><td style="padding: 20px 32px; background: #f0fdf4; border-radius: 14px;">
              <p style="margin: 0 0 4px; font-family: ${BODY_FONT}; font-size: 24px; font-weight: 800; color: #16a34a;">${esc(offerSummary)}</p>
              <p style="margin: 0; font-family: 'Courier New', monospace; font-size: 15px; font-weight: 700; color: #052e16;">${esc(couponCode) || "ABC123"}</p>
              ${expiry ? `<p style="margin: 8px 0 0; font-family: ${BODY_FONT}; font-size: 11px; color: #4d7c0f;">Valid until ${esc(expiry)}</p>` : ""}
            </td></tr></table>
          </td></tr>
          <tr><td style="padding: 24px 60px 0;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
              ${benefits.map((b) => `<tr><td style="padding: 6px 0; font-family: ${BODY_FONT}; font-size: 13px; color: #166534;">&#10003;&nbsp;&nbsp;${esc(b)}</td></tr>`).join("")}
            </table>
          </td></tr>
          ${terms ? `<tr><td style="padding: 28px 36px 32px; text-align: center;"><p style="margin: 0; font-family: ${BODY_FONT}; font-size: 11px; line-height: 1.6; color: #86efac;">${nl2br(terms)}</p></td></tr>` : `<tr><td style="padding: 0 0 16px;"></td></tr>`}
        </table>`;

  table = wrapFooterRow(table, restaurantName, contactText, footerText, "#86efac", accent, options.socialLinks);
  return shell({ title: `${restaurantName} - Offer`, bg: "#f7fee7", content: table });
}

// ---------------------------------------------------------------------------
// Product Showcase — the food/product is the hero: photo, name, price, CTA
// ---------------------------------------------------------------------------
export function renderProductShowcase(options: EmailPosterOptions): string {
  const { restaurantName, logoUrl, headline, description, couponCode, terms, heroImageUrl, contactText, footerText, originalPrice, offerPrice } = options;
  const accent = options.primaryColor || "#a16207";
  const offerSummary = formatOfferSummary(options);
  const expiry = formatValidUntil(options.validUntil);
  const price = priceBlock({ original: originalPrice, offer: offerPrice, accent, size: 28 });

  let table = `        <table role="presentation" width="600" class="yg-container" cellspacing="0" cellpadding="0" style="width: 600px; max-width: 600px; background: #fafaf9;">
          <tr><td style="padding: 22px 22px 0;">
            ${logoUrl ? `<img src="${escAttr(logoUrl)}" alt="" style="display: block; width: 28px; height: 28px; border-radius: 6px; object-fit: cover; margin-bottom: 8px;">` : ""}<span style="font-family: ${BODY_FONT}; font-size: 13px; font-weight: 700; color: #292524;">${esc(restaurantName)}</span>
          </td></tr>
          <tr><td style="padding: 18px 22px 0;">${heroImage({ url: heroImageUrl, height: 320, radius: "16px", fallbackBg: `linear-gradient(135deg, ${accent}33 0%, ${accent}66 100%)` })}</td></tr>
          <tr><td class="yg-pad" style="padding: 26px 34px 0; text-align: center;">
            <h1 class="yg-h1" style="margin: 0; font-family: ${HEADLINE_FONT}; font-size: 30px; font-weight: 700; line-height: 1.3; color: #292524;">${esc(headline) || "New on the menu"}</h1>
            ${description ? `<p style="margin: 12px 0 0; font-family: ${BODY_FONT}; font-size: 14px; line-height: 1.75; color: #57534e;">${nl2br(description)}</p>` : ""}
          </td></tr>
          <tr><td style="padding: 22px 34px 0; text-align: center;">
            ${price || `<p style="margin: 0; font-family: ${BODY_FONT}; font-size: 22px; font-weight: 800; color: ${accent};">${esc(offerSummary)}</p>`}
            ${expiry ? `<p style="margin: 6px 0 0; font-family: ${BODY_FONT}; font-size: 12px; color: #a8a29e;">Through ${esc(expiry)}</p>` : ""}
          </td></tr>
          <tr><td style="padding: 18px 34px 0; text-align: center;">
            <span style="display: inline-block; padding: 8px 18px; border: 1px dashed ${accent}; border-radius: 10px; font-family: 'Courier New', monospace; font-size: 15px; font-weight: 700; color: #44403c;">${esc(couponCode) || "ABC123"}</span>
          </td></tr>
          ${terms ? `<tr><td style="padding: 22px 34px 0; text-align: center;"><p style="margin: 0; font-family: ${BODY_FONT}; font-size: 11px; line-height: 1.6; color: #a8a29e;">${nl2br(terms)}</p></td></tr>` : ""}
        </table>`;

  table = wrapFooterRow(table, restaurantName, contactText, footerText, "#a8a29e", accent, options.socialLinks);
  return shell({ title: `${restaurantName} - New dish`, bg: "#f5f5f4", content: table });
}

// ---------------------------------------------------------------------------
// Announcement — huge headline, short message, one CTA
// ---------------------------------------------------------------------------
export function renderAnnouncement(options: EmailPosterOptions): string {
  const { restaurantName, logoUrl, headline, description, heroImageUrl, contactText, footerText, terms } = options;
  const accent = options.primaryColor || "#2563eb";

  let table = `        <table role="presentation" width="600" class="yg-container" cellspacing="0" cellpadding="0" style="width: 600px; max-width: 600px; background: #ffffff;">
          <tr><td class="yg-pad" style="padding: 40px 40px 0; text-align: center;">
            ${logoUrl ? `<img src="${escAttr(logoUrl)}" alt="" style="display: block; margin: 0 auto 16px; width: 40px; height: 40px; border-radius: 8px; object-fit: cover;">` : ""}
            <p style="margin: 0 0 16px; font-family: ${BODY_FONT}; font-size: 12px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: ${accent};">${esc(restaurantName)} · Announcement</p>
            <h1 class="yg-h1" style="margin: 0; font-family: ${HEADLINE_FONT}; font-size: 38px; font-weight: 700; line-height: 1.2; color: #1e3a8a;">${esc(headline) || "Something new is here"}</h1>
            ${description ? `<p style="margin: 16px 0 0; font-family: ${BODY_FONT}; font-size: 15px; line-height: 1.75; color: #475569;">${nl2br(description)}</p>` : ""}
          </td></tr>
          ${heroImageUrl ? `<tr><td style="padding: 30px 40px 0;">${heroImage({ url: heroImageUrl, height: 260, radius: "12px", fallbackBg: "" })}</td></tr>` : ""}
          <tr><td style="padding: 30px 40px 0; text-align: center;">${divider({ color: `${accent}30`, width: "48px", margin: "0 auto" })}</td></tr>
          ${terms ? `<tr><td style="padding: 22px 40px 0; text-align: center;"><p style="margin: 0; font-family: ${BODY_FONT}; font-size: 11px; line-height: 1.6; color: #94a3b8;">${nl2br(terms)}</p></td></tr>` : ""}
        </table>`;

  table = wrapFooterRow(table, restaurantName, contactText, footerText, "#94a3b8", accent, options.socialLinks);
  return shell({ title: `${restaurantName} - Announcement`, bg: "#eff6ff", content: table });
}

// ---------------------------------------------------------------------------
// Newsletter — multi-section digest: featured story, offer, updates
// ---------------------------------------------------------------------------
export function renderNewsletter(options: EmailPosterOptions): string {
  const { restaurantName, logoUrl, headline, description, couponCode, terms, heroImageUrl, contactText, footerText } = options;
  const accent = options.primaryColor || "#0f172a";
  const offerSummary = formatOfferSummary(options);
  const expiry = formatValidUntil(options.validUntil);

  let table = `        <table role="presentation" width="600" class="yg-container" cellspacing="0" cellpadding="0" style="width: 600px; max-width: 600px; background: #ffffff; border: 1px solid #e2e8f0;">
          <tr><td style="padding: 22px 32px; border-bottom: 2px solid #0f172a;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>
              <td style="vertical-align: top;">${logoUrl ? `<img src="${escAttr(logoUrl)}" alt="" style="display: block; width: 28px; height: 28px; border-radius: 6px; object-fit: cover; margin-bottom: 6px;">` : ""}<span style="font-family: ${BODY_FONT}; font-size: 13px; font-weight: 800; color: #0f172a;">${esc(restaurantName)}</span></td>
              <td align="right" style="vertical-align: top;"><span style="font-family: ${BODY_FONT}; font-size: 11px; color: #64748b;">This month</span></td>
            </tr></table>
          </td></tr>
          <tr><td class="yg-pad" style="padding: 28px 32px 0;">
            <p style="margin: 0 0 6px; font-family: ${BODY_FONT}; font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #64748b;">Featured</p>
            <h1 class="yg-h1" style="margin: 0; font-family: ${HEADLINE_FONT}; font-size: 28px; font-weight: 700; line-height: 1.3; color: #0f172a;">${esc(headline) || "What's happening this month"}</h1>
            ${description ? `<p style="margin: 10px 0 0; font-family: ${BODY_FONT}; font-size: 14px; line-height: 1.7; color: #475569;">${nl2br(description)}</p>` : ""}
          </td></tr>
          ${heroImageUrl ? `<tr><td style="padding: 20px 32px 0;">${heroImage({ url: heroImageUrl, height: 220, radius: "8px", fallbackBg: "" })}</td></tr>` : ""}
          <tr><td style="padding: 24px 32px 0;">${divider({ color: "#e2e8f0" })}</td></tr>
          <tr><td class="yg-pad" style="padding: 20px 32px 0;">
            <p style="margin: 0 0 10px; font-family: ${BODY_FONT}; font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #64748b;">Featured offer</p>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #f8fafc; border-radius: 10px;"><tr><td style="padding: 18px 20px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>
                <td><p style="margin: 0; font-family: ${BODY_FONT}; font-size: 16px; font-weight: 700; color: #0f172a;">${esc(offerSummary)}</p>${expiry ? `<p style="margin: 2px 0 0; font-family: ${BODY_FONT}; font-size: 11px; color: #94a3b8;">Until ${esc(expiry)}</p>` : ""}</td>
                <td align="right"><span style="font-family: 'Courier New', monospace; font-size: 14px; font-weight: 700; color: ${accent};">${esc(couponCode) || "ABC123"}</span></td>
              </tr></table>
            </td></tr></table>
          </td></tr>
          ${terms ? `<tr><td style="padding: 20px 32px 0;"><p style="margin: 0; font-family: ${BODY_FONT}; font-size: 11px; line-height: 1.6; color: #94a3b8;">${nl2br(terms)}</p></td></tr>` : ""}
        </table>`;

  table = wrapFooterRow(table, restaurantName, contactText, footerText, "#94a3b8", accent, options.socialLinks);
  return shell({ title: `${restaurantName} - Newsletter`, bg: "#f8fafc", content: table });
}

// ---------------------------------------------------------------------------
// Storytelling — introduction → story → offer → benefits → CTA
// ---------------------------------------------------------------------------
export function renderStorytelling(options: EmailPosterOptions): string {
  const { restaurantName, logoUrl, headline, description, couponCode, terms, heroImageUrl, contactText, footerText } = options;
  const accent = options.primaryColor || "#b45309";
  const offerSummary = formatOfferSummary(options);
  const expiry = formatValidUntil(options.validUntil);

  let table = `        <table role="presentation" width="600" class="yg-container" cellspacing="0" cellpadding="0" style="width: 600px; max-width: 600px; background: #fdf6ec;">
          <tr><td class="yg-pad" style="padding: 40px 40px 0; text-align: center;">
            ${logoUrl ? `<img src="${escAttr(logoUrl)}" alt="" style="display: block; margin: 0 auto 14px; width: 40px; height: 40px; border-radius: 50%; object-fit: cover;">` : ""}
            <p style="margin: 0 0 16px; font-family: ${BODY_FONT}; font-size: 11px; font-weight: 600; letter-spacing: 0.2em; text-transform: uppercase; color: ${accent};">${esc(restaurantName)}</p>
            <h1 class="yg-h1" style="margin: 0; font-family: ${HEADLINE_FONT}; font-style: italic; font-size: 30px; font-weight: 600; line-height: 1.4; color: #451a03;">${esc(headline) || "It started with one simple idea"}</h1>
          </td></tr>
          ${heroImageUrl ? `<tr><td style="padding: 28px 40px 0;">${heroImage({ url: heroImageUrl, height: 240, radius: "4px", fallbackBg: "" })}</td></tr>` : ""}
          <tr><td class="yg-pad" style="padding: 26px 44px 0; text-align: center;">
            ${description ? `<p style="margin: 0; font-family: ${BODY_FONT}; font-size: 15px; line-height: 1.9; color: #78350f;">${nl2br(description)}</p>` : `<p style="margin: 0; font-family: ${BODY_FONT}; font-size: 15px; line-height: 1.9; color: #78350f;">We wanted to share something with the people who make this place what it is — that's you.</p>`}
          </td></tr>
          <tr><td style="padding: 30px 44px 0; text-align: center;">${divider({ color: "#e7d2b3", width: "40px", margin: "0 auto" })}</td></tr>
          <tr><td class="yg-pad" style="padding: 26px 44px 0; text-align: center;">
            <p style="margin: 0 0 6px; font-family: ${BODY_FONT}; font-size: 10px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; color: ${accent};">So, here's our thank you</p>
            <p style="margin: 0 0 14px; font-family: ${HEADLINE_FONT}; font-size: 28px; color: #b45309;">${esc(offerSummary)}</p>
            <p style="margin: 0; font-family: 'Courier New', monospace; font-size: 17px; font-weight: 700; letter-spacing: 0.16em; color: #451a03;">${esc(couponCode) || "ABC123"}</p>
            ${expiry ? `<p style="margin: 10px 0 0; font-family: ${BODY_FONT}; font-size: 12px; color: #a8703f;">Through ${esc(expiry)}</p>` : ""}
          </td></tr>
          ${terms ? `<tr><td style="padding: 24px 44px 0; text-align: center;"><p style="margin: 0; font-family: ${BODY_FONT}; font-size: 11px; line-height: 1.6; color: #a8703f;">${nl2br(terms)}</p></td></tr>` : ""}
        </table>`;

  table = wrapFooterRow(table, restaurantName, contactText, footerText, "#a8703f", accent, options.socialLinks);
  return shell({ title: `${restaurantName} - Our story`, bg: "#f6ead6", content: table });
}

// ---------------------------------------------------------------------------
// Festival / Celebration — warm maroon + gold, ornate but professional
// ---------------------------------------------------------------------------
export function renderFestival(options: EmailPosterOptions): string {
  const { restaurantName, logoUrl, headline, description, couponCode, terms, contactText, footerText } = options;
  const accent = options.primaryColor || "#e0a840";
  const offerSummary = formatOfferSummary(options);
  const expiry = formatValidUntil(options.validUntil);
  const divider2 = `<p style="margin: 0; text-align: center; color: ${accent}; font-size: 12px; letter-spacing: 0.5em;">&#10022;&#10022;&#10022;</p>`;

  let table = `        <table role="presentation" width="600" class="yg-container" cellspacing="0" cellpadding="0" style="width: 600px; max-width: 600px; background: linear-gradient(180deg, #4a1017 0%, #34090f 100%); border-radius: 16px; overflow: hidden; border: 1px solid ${accent}55;">
          <tr><td style="height: 6px; background: linear-gradient(90deg, transparent, ${accent}, transparent);"></td></tr>
          <tr><td class="yg-pad" style="padding: 36px 40px 0; text-align: center;">
            ${logoUrl ? `<img src="${escAttr(logoUrl)}" alt="" style="display: block; margin: 0 auto 14px; width: 46px; height: 46px; border-radius: 50%; object-fit: cover; border: 2px solid ${accent};">` : ""}
            <p style="margin: 0 0 10px; font-family: ${BODY_FONT}; font-size: 11px; font-weight: 700; letter-spacing: 0.26em; text-transform: uppercase; color: ${accent};">${esc(restaurantName)}</p>
            <h1 class="yg-h1" style="margin: 0 0 14px; font-family: ${HEADLINE_FONT}; font-size: 32px; font-weight: 700; line-height: 1.3; color: #fbe9c6;">${esc(headline) || "Warm wishes and a festive treat"}</h1>
            ${divider2}
            ${description ? `<p style="margin: 18px 0 0; font-family: ${BODY_FONT}; font-size: 13px; line-height: 1.75; color: #e3c9b3;">${nl2br(description)}</p>` : ""}
          </td></tr>
          <tr><td class="yg-pad" style="padding: 30px 40px 0;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #fbe9c6; border: 2px solid ${accent}; border-radius: 10px;"><tr><td style="padding: 4px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border: 1px solid ${accent}80; border-radius: 6px;"><tr><td style="padding: 24px 20px; text-align: center;">
                <p style="margin: 0 0 6px; font-family: ${BODY_FONT}; font-size: 10px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; color: #7a3b1a;">Your festive offer</p>
                <p style="margin: 0 0 14px; font-family: ${HEADLINE_FONT}; font-size: 28px; font-weight: 700; color: #7a3b1a;">${esc(offerSummary)}</p>
                <p style="margin: 0; font-family: 'Courier New', monospace; font-size: 22px; font-weight: 700; letter-spacing: 0.18em; color: #3a1a08;">${esc(couponCode) || "ABC123"}</p>
                ${expiry ? `<p style="margin: 12px 0 0; font-family: ${BODY_FONT}; font-size: 12px; color: #8a5a30;">Valid until ${esc(expiry)}</p>` : ""}
              </td></tr></table>
            </td></tr></table>
          </td></tr>
          ${terms ? `<tr><td style="padding: 26px 40px 0; text-align: center;"><p style="margin: 0; font-family: ${BODY_FONT}; font-size: 11px; line-height: 1.7; color: #b98f6b;">${nl2br(terms)}</p></td></tr>` : ""}
        </table>`;

  table = wrapFooterRow(table, restaurantName, contactText, footerText, "#b98f6b", accent, options.socialLinks);
  return shell({ title: `${restaurantName} - Festive offer`, bg: "#1f0509", content: table });
}

// ---------------------------------------------------------------------------
// Seasonal — flexible palette/imagery-driven template that adapts by season
// ---------------------------------------------------------------------------
export function renderSeasonal(options: EmailPosterOptions): string {
  const { restaurantName, logoUrl, headline, description, couponCode, terms, heroImageUrl, contactText, footerText } = options;
  const accent = options.primaryColor || "#16a34a";
  const offerSummary = formatOfferSummary(options);
  const expiry = formatValidUntil(options.validUntil);

  let table = `        <table role="presentation" width="600" class="yg-container" cellspacing="0" cellpadding="0" style="width: 600px; max-width: 600px; background: #ffffff; border-radius: 18px; overflow: hidden;">
          <tr><td>${heroImage({ url: heroImageUrl, height: 200, fallbackBg: `linear-gradient(135deg, ${accent} 0%, ${accent}99 100%)` })}</td></tr>
          <tr><td class="yg-pad" style="padding: 30px 34px 0; text-align: center;">
            ${logoUrl ? `<img src="${escAttr(logoUrl)}" alt="" style="display: block; margin: 0 auto 12px; width: 34px; height: 34px; border-radius: 8px; object-fit: cover;">` : ""}
            <p style="margin: 0 0 10px; font-family: ${BODY_FONT}; font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: ${accent};">${esc(restaurantName)}</p>
            <h1 class="yg-h1" style="margin: 0; font-family: ${BODY_FONT}; font-size: 27px; font-weight: 700; line-height: 1.35; color: #14532d;">${esc(headline) || "A little something for the season"}</h1>
            ${description ? `<p style="margin: 12px 0 0; font-family: ${BODY_FONT}; font-size: 14px; line-height: 1.7; color: #3f6212;">${nl2br(description)}</p>` : ""}
          </td></tr>
          <tr><td style="padding: 22px 34px 0; text-align: center;">
            <span style="display: inline-block; padding: 10px 22px; background: ${accent}18; border-radius: 999px; font-family: ${BODY_FONT}; font-size: 16px; font-weight: 800; color: ${accent};">${esc(offerSummary)}</span>
          </td></tr>
          <tr><td style="padding: 18px 34px 0; text-align: center;">
            <span style="font-family: 'Courier New', monospace; font-size: 16px; font-weight: 700; letter-spacing: 0.14em; color: #14532d;">${esc(couponCode) || "ABC123"}</span>
            ${expiry ? `<p style="margin: 8px 0 0; font-family: ${BODY_FONT}; font-size: 12px; color: #65a30d;">Through ${esc(expiry)}</p>` : ""}
          </td></tr>
          ${terms ? `<tr><td style="padding: 22px 34px 0; text-align: center;"><p style="margin: 0; font-family: ${BODY_FONT}; font-size: 11px; line-height: 1.6; color: #65a30d;">${nl2br(terms)}</p></td></tr>` : ""}
        </table>`;

  table = wrapFooterRow(table, restaurantName, contactText, footerText, "#65a30d", accent, options.socialLinks);
  return shell({ title: `${restaurantName} - Seasonal offer`, bg: "#eef6ee", content: table });
}

// ---------------------------------------------------------------------------
// Flash Sale — urgent, huge numeral, countdown-style expiry, dual CTA
// ---------------------------------------------------------------------------
export function renderFlashSale(options: EmailPosterOptions): string {
  const { restaurantName, logoUrl, headline, couponCode, terms, contactText, footerText } = options;
  const accent = options.primaryColor || "#ff4d29";
  const offerSummary = formatOfferSummary(options);
  const offerHeadline = formatOfferHeadline(options);
  const expiry = formatValidUntil(options.validUntil);
  const stripe = `repeating-linear-gradient(-45deg, ${accent} 0px, ${accent} 14px, #1c130e 14px, #1c130e 28px)`;

  let table = `        <table role="presentation" width="600" class="yg-container" cellspacing="0" cellpadding="0" style="width: 600px; max-width: 600px; background: #18120d; border-radius: 14px; overflow: hidden;">
          <tr><td style="height: 8px; background: ${stripe}; font-size: 0; line-height: 0;">&nbsp;</td></tr>
          <tr><td class="yg-pad" style="padding: 26px 32px 0; text-align: center;">
            <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto 18px;"><tr><td style="padding: 6px 16px; background: ${accent}22; border: 1px solid ${accent}; border-radius: 999px;">
              <span style="font-family: ${BODY_FONT}; font-size: 11px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: ${accent};">&#9889; Limited time</span>
            </td></tr></table>
            ${logoUrl ? `<img src="${escAttr(logoUrl)}" alt="" style="display: block; margin: 0 auto 8px; width: 30px; height: 30px; border-radius: 7px; object-fit: cover;">` : ""}
            <span style="font-family: ${BODY_FONT}; font-size: 13px; font-weight: 700; color: #ffb199; letter-spacing: 0.04em;">${esc(restaurantName)}</span>
          </td></tr>
          <tr><td style="padding: 18px 32px 0; text-align: center;">
            <p class="yg-h2" style="margin: 0; font-family: ${HEADLINE_FONT}; font-size: 78px; font-weight: 700; line-height: 1; color: #ffffff;">${esc(offerHeadline)}</p>
            <p style="margin: 8px 0 0; font-family: ${BODY_FONT}; font-size: 15px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: ${accent};">Off ${esc(headline) || "your next order"}</p>
          </td></tr>
          <tr><td style="padding: 22px 32px 0; text-align: center;">
            <p style="margin: 0; font-family: ${BODY_FONT}; font-size: 13px; color: #d9c9c0;">${esc(offerSummary)}</p>
          </td></tr>
          <tr><td style="padding: 24px 32px 0; text-align: center;">
            <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto;"><tr><td style="padding: 16px 28px; background: #241a13; border: 2px solid ${accent}; border-radius: 12px;">
              <span style="font-family: 'Courier New', monospace; font-size: 26px; font-weight: 700; letter-spacing: 0.16em; color: #ffffff;">${esc(couponCode) || "ABC123"}</span>
            </td></tr></table>
          </td></tr>
          ${expiry ? `<tr><td style="padding: 20px 32px 0; text-align: center;"><table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto;"><tr><td style="padding: 8px 18px; background: #2a1c14; border-radius: 8px;"><span style="font-family: ${BODY_FONT}; font-size: 13px; font-weight: 700; color: #ffb199;">&#9200; Ends ${esc(expiry)} — don't miss it</span></td></tr></table></td></tr>` : ""}
          ${terms ? `<tr><td style="padding: 26px 32px 32px; text-align: center;"><p style="margin: 0; font-family: ${BODY_FONT}; font-size: 11px; line-height: 1.6; color: #8a7568;">${nl2br(terms)}</p></td></tr>` : `<tr><td style="padding: 0 0 16px;"></td></tr>`}
        </table>`;

  table = wrapFooterRow(table, restaurantName, contactText, footerText, "#8a7568", accent, options.socialLinks);
  return shell({ title: `${restaurantName} - Flash sale`, bg: "#0d0906", content: table });
}

// ---------------------------------------------------------------------------
// Personalized — warm, human-feeling message rather than a broadcast ad
// ---------------------------------------------------------------------------
export function renderPersonalized(options: EmailPosterOptions): string {
  const { restaurantName, logoUrl, headline, description, couponCode, terms, contactText, footerText } = options;
  const accent = options.primaryColor || "#f97316";
  const offerSummary = formatOfferSummary(options);
  const expiry = formatValidUntil(options.validUntil);

  let table = `        <table role="presentation" width="580" class="yg-container" cellspacing="0" cellpadding="0" style="width: 580px; max-width: 580px; background: #fff9f5;">
          <tr><td class="yg-pad" style="padding: 44px 40px 0;">
            ${logoUrl ? `<img src="${escAttr(logoUrl)}" alt="" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; margin-bottom: 16px;">` : ""}
            <p style="margin: 0 0 20px; font-family: ${BODY_FONT}; font-size: 16px; line-height: 1.7; color: #431407;">Hi {{customer_name}},</p>
            <h1 class="yg-h1" style="margin: 0 0 16px; font-family: ${BODY_FONT}; font-size: 24px; font-weight: 700; line-height: 1.4; color: #431407;">${esc(headline) || "It's been a while — we miss you"}</h1>
            <p style="margin: 0; font-family: ${BODY_FONT}; font-size: 15px; line-height: 1.85; color: #7c2d12;">${description ? nl2br(description) : `From all of us at ${esc(restaurantName)}, we wanted to send something personal — not a blast, just a note and a little thank-you.`}</p>
          </td></tr>
          <tr><td style="padding: 28px 40px 0;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #ffffff; border: 1px solid #fed7aa; border-radius: 14px;"><tr><td style="padding: 22px; text-align: center;">
              <p style="margin: 0 0 6px; font-family: ${BODY_FONT}; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: ${accent};">Just for you</p>
              <p style="margin: 0 0 12px; font-family: ${BODY_FONT}; font-size: 20px; font-weight: 700; color: #431407;">${esc(offerSummary)}</p>
              <span style="font-family: 'Courier New', monospace; font-size: 15px; font-weight: 700; color: #9a3412;">${esc(couponCode) || "ABC123"}</span>
              ${expiry ? `<p style="margin: 10px 0 0; font-family: ${BODY_FONT}; font-size: 12px; color: #c2410c;">Good until ${esc(expiry)}</p>` : ""}
            </td></tr></table>
          </td></tr>
          <tr><td style="padding: 22px 40px 0;"><p style="margin: 0; font-family: ${BODY_FONT}; font-size: 14px; line-height: 1.7; color: #7c2d12;">— The team at ${esc(restaurantName)}</p></td></tr>
          ${terms ? `<tr><td style="padding: 20px 40px 0;"><p style="margin: 0; font-family: ${BODY_FONT}; font-size: 11px; line-height: 1.6; color: #c2410c;">${nl2br(terms)}</p></td></tr>` : ""}
        </table>`;

  table = wrapFooterRow(table, restaurantName, contactText, footerText, "#c2410c", accent, options.socialLinks);
  return shell({ title: `${restaurantName} - A note for you`, bg: "#fef1e7", content: table });
}

// ---------------------------------------------------------------------------
// Restaurant Menu — food cards with names/prices, digital-menu feel
// ---------------------------------------------------------------------------
export function renderRestaurantMenu(options: EmailPosterOptions): string {
  const { restaurantName, logoUrl, headline, description, couponCode, terms, heroImageUrl, contactText, footerText } = options;
  const accent = options.primaryColor || "#b91c1c";
  const offerSummary = formatOfferSummary(options);
  const expiry = formatValidUntil(options.validUntil);
  const placeholderImg = (label: string) =>
    `<div style="height: 96px; border-radius: 8px; background: ${accent}14; text-align: center; line-height: 96px; font-family: ${HEADLINE_FONT}; font-size: 12px; color: ${accent};">${esc(label)}</div>`;

  let table = `        <table role="presentation" width="600" class="yg-container" cellspacing="0" cellpadding="0" style="width: 600px; max-width: 600px; background: #fffaf0;">
          <tr><td style="padding: 34px 36px 0; text-align: center;">
            ${logoUrl ? `<img src="${escAttr(logoUrl)}" alt="" style="display: block; margin: 0 auto 12px; width: 44px; height: 44px; border-radius: 50%; object-fit: cover;">` : ""}
            <p style="margin: 0 0 8px; font-family: ${BODY_FONT}; font-size: 11px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: ${accent};">${esc(restaurantName)}</p>
            <h1 class="yg-h1" style="margin: 0; font-family: ${HEADLINE_FONT}; font-size: 30px; font-weight: 700; line-height: 1.3; color: #292524;">${esc(headline) || "From our kitchen to your table"}</h1>
            ${description ? `<p style="margin: 12px 0 0; font-family: ${BODY_FONT}; font-size: 14px; line-height: 1.7; color: #57534e;">${nl2br(description)}</p>` : ""}
          </td></tr>
          <tr><td style="padding: 26px 30px 0;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>
              <td width="33%" class="yg-col3" style="padding: 0 6px;">${heroImageUrl ? `<img src="${escAttr(heroImageUrl)}" alt="" style="display: block; width: 100%; height: 96px; object-fit: cover; border-radius: 8px;">` : placeholderImg("Signature")}<p style="margin: 8px 0 0; font-family: ${BODY_FONT}; font-size: 12px; font-weight: 700; color: #292524;">Signature dish</p></td>
              <td width="33%" class="yg-col3" style="padding: 0 6px;">${placeholderImg("Chef's pick")}<p style="margin: 8px 0 0; font-family: ${BODY_FONT}; font-size: 12px; font-weight: 700; color: #292524;">Chef's pick</p></td>
              <td width="33%" class="yg-col3" style="padding: 0 6px;">${placeholderImg("Fan favorite")}<p style="margin: 8px 0 0; font-family: ${BODY_FONT}; font-size: 12px; font-weight: 700; color: #292524;">Fan favorite</p></td>
            </tr></table>
          </td></tr>
          <tr><td style="padding: 26px 36px 0; text-align: center;">${divider({ color: "#e7c9a9", width: "40px", margin: "0 auto" })}</td></tr>
          <tr><td style="padding: 22px 36px 0; text-align: center;">
            <p style="margin: 0 0 6px; font-family: ${BODY_FONT}; font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: ${accent};">On the house</p>
            <p style="margin: 0 0 12px; font-family: ${HEADLINE_FONT}; font-size: 26px; color: #292524;">${esc(offerSummary)}</p>
            <span style="font-family: 'Courier New', monospace; font-size: 16px; font-weight: 700; color: #78716c;">${esc(couponCode) || "ABC123"}</span>
            ${expiry ? `<p style="margin: 10px 0 0; font-family: ${BODY_FONT}; font-size: 12px; color: #a8a29e;">Through ${esc(expiry)}</p>` : ""}
          </td></tr>
          ${terms ? `<tr><td style="padding: 22px 36px 0; text-align: center;"><p style="margin: 0; font-family: ${BODY_FONT}; font-size: 11px; line-height: 1.6; color: #a8a29e;">${nl2br(terms)}</p></td></tr>` : ""}
        </table>`;

  table = wrapFooterRow(table, restaurantName, contactText, footerText, "#a8a29e", accent, options.socialLinks);
  return shell({ title: `${restaurantName} - Menu`, bg: "#f5ead6", content: table });
}

// ---------------------------------------------------------------------------
// Invitation — centered, elegant event card with RSVP CTA
// ---------------------------------------------------------------------------
export function renderInvitation(options: EmailPosterOptions): string {
  const { restaurantName, logoUrl, headline, description, heroImageUrl, contactText, footerText, terms, eventDetails } = options;
  const accent = options.primaryColor || "#d4af37";

  let table = `        <table role="presentation" width="600" class="yg-container" cellspacing="0" cellpadding="0" style="width: 600px; max-width: 600px; background: #101014; border: 1px solid ${accent}55;">
          <tr><td>${heroImage({ url: heroImageUrl, height: 220, fallbackBg: `radial-gradient(120% 140% at 50% 0%, #26241f 0%, #101014 70%)` })}</td></tr>
          <tr><td class="yg-pad" style="padding: 40px 44px 0; text-align: center;">
            ${logoUrl ? `<img src="${escAttr(logoUrl)}" alt="" style="display: block; margin: 0 auto 16px; width: 44px; height: 44px; border-radius: 50%; object-fit: cover; border: 1px solid ${accent};">` : ""}
            <p style="margin: 0 0 6px; font-family: ${BODY_FONT}; font-size: 11px; font-weight: 600; letter-spacing: 0.3em; text-transform: uppercase; color: ${accent};">You're invited</p>
            <p style="margin: 0 0 20px; font-family: ${BODY_FONT}; font-size: 12px; letter-spacing: 0.14em; text-transform: uppercase; color: #a89b7e;">${esc(restaurantName)}</p>
            <h1 class="yg-h1" style="margin: 0; font-family: ${HEADLINE_FONT}; font-style: italic; font-size: 32px; font-weight: 600; line-height: 1.35; color: #f5f0e6;">${esc(headline) || "An evening worth dressing up for"}</h1>
            ${description ? `<p style="margin: 16px 0 0; font-family: ${BODY_FONT}; font-size: 14px; line-height: 1.8; color: #c9bda3;">${nl2br(description)}</p>` : ""}
          </td></tr>
          <tr><td style="padding: 30px 44px 0;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-top: 1px solid ${accent}40; border-bottom: 1px solid ${accent}40;"><tr><td style="padding: 22px 0; text-align: center;">
              <p style="margin: 0; font-family: ${BODY_FONT}; font-size: 14px; line-height: 1.8; color: #f5f0e6;">${eventDetails ? nl2br(eventDetails) : "Date, time, and location to follow."}</p>
            </td></tr></table>
          </td></tr>
          ${terms ? `<tr><td style="padding: 24px 44px 0; text-align: center;"><p style="margin: 0; font-family: ${BODY_FONT}; font-size: 11px; line-height: 1.6; color: #8a7f68;">${nl2br(terms)}</p></td></tr>` : ""}
        </table>`;

  table = wrapFooterRow(table, restaurantName, contactText, footerText, "#8a7f68", accent, options.socialLinks);
  return shell({ title: `${restaurantName} - You're invited`, bg: "#000000", content: table });
}

// ---------------------------------------------------------------------------
// Thank You — warm relationship-focused, short message, soft CTA
// ---------------------------------------------------------------------------
export function renderThankYou(options: EmailPosterOptions): string {
  const { restaurantName, logoUrl, headline, description, couponCode, terms, contactText, footerText } = options;
  const accent = options.primaryColor || "#e11d48";
  const offerSummary = formatOfferSummary(options);
  const expiry = formatValidUntil(options.validUntil);
  const hasOffer = Boolean(options.value);

  let table = `        <table role="presentation" width="580" class="yg-container" cellspacing="0" cellpadding="0" style="width: 580px; max-width: 580px; background: #fef2f2;">
          <tr><td class="yg-pad" style="padding: 48px 44px 0; text-align: center;">
            ${logoUrl ? `<img src="${escAttr(logoUrl)}" alt="" style="display: block; margin: 0 auto 18px; width: 46px; height: 46px; border-radius: 50%; object-fit: cover;">` : ""}
            <p style="margin: 0 0 6px; font-family: ${BODY_FONT}; font-size: 28px;">&#10084;</p>
            <h1 class="yg-h1" style="margin: 0 0 16px; font-family: ${HEADLINE_FONT}; font-size: 30px; font-weight: 700; line-height: 1.35; color: #4c0519;">${esc(headline) || "Thank you for being here"}</h1>
            <p style="margin: 0; font-family: ${BODY_FONT}; font-size: 15px; line-height: 1.85; color: #9f1239;">${description ? nl2br(description) : `We know you have plenty of choices, and we're grateful you chose ${esc(restaurantName)}. This one's on us.`}</p>
          </td></tr>
          ${hasOffer ? `<tr><td style="padding: 28px 44px 0;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #ffffff; border-radius: 16px;"><tr><td style="padding: 22px; text-align: center;">
              <p style="margin: 0 0 10px; font-family: ${BODY_FONT}; font-size: 20px; font-weight: 700; color: #e11d48;">${esc(offerSummary)}</p>
              <span style="font-family: 'Courier New', monospace; font-size: 15px; font-weight: 700; color: #4c0519;">${esc(couponCode) || "ABC123"}</span>
              ${expiry ? `<p style="margin: 10px 0 0; font-family: ${BODY_FONT}; font-size: 12px; color: #be123c;">Valid until ${esc(expiry)}</p>` : ""}
            </td></tr></table>
          </td></tr>` : ""}
          ${terms ? `<tr><td style="padding: 24px 44px 0; text-align: center;"><p style="margin: 0; font-family: ${BODY_FONT}; font-size: 11px; line-height: 1.6; color: #be123c;">${nl2br(terms)}</p></td></tr>` : ""}
        </table>`;

  table = wrapFooterRow(table, restaurantName, contactText, footerText, "#be123c", accent, options.socialLinks);
  return shell({ title: `${restaurantName} - Thank you`, bg: "#fee2e2", content: table });
}
