/**
 * Business & character family: professional, corporate, brutalist, organic,
 * futuristic, retro, vintage, art-deco.
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
  badge,
  BODY_FONT,
  HEADLINE_FONT,
} from "../email-poster-html";

// ---------------------------------------------------------------------------
// Professional — strong grid, clear sections, restrained color
// ---------------------------------------------------------------------------
export function renderProfessional(options: EmailPosterOptions): string {
  const { restaurantName, logoUrl, headline, description, couponCode, terms, contactText, footerText } = options;
  const accent = options.primaryColor || "#1d4ed8";
  const offerSummary = formatOfferSummary(options);
  const expiry = formatValidUntil(options.validUntil);

  let table = `        <table role="presentation" width="600" class="yg-container" cellspacing="0" cellpadding="0" style="width: 600px; max-width: 600px; background: #ffffff; border: 1px solid #e2e8f0;">
          <tr><td style="padding: 24px 32px; background: #0f172a; border-bottom: 3px solid ${accent};">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>
              <td style="vertical-align: top;">${logoUrl ? `<img src="${escAttr(logoUrl)}" alt="" style="display: block; width: 30px; height: 30px; border-radius: 6px; object-fit: cover; margin-bottom: 8px;">` : ""}<span style="font-family: ${BODY_FONT}; font-size: 14px; font-weight: 700; color: #ffffff;">${esc(restaurantName)}</span></td>
              <td align="right" style="vertical-align: top;">${badge({ label: "Customer notice", bg: "rgba(255,255,255,0.1)", color: "#cbd5e1" })}</td>
            </tr></table>
          </td></tr>
          <tr><td class="yg-pad" style="padding: 32px;">
            <h1 class="yg-h1" style="margin: 0 0 12px; font-family: ${BODY_FONT}; font-size: 24px; font-weight: 700; line-height: 1.35; color: #0f172a;">${esc(headline) || "An update on your account"}</h1>
            ${description ? `<p style="margin: 0 0 20px; font-family: ${BODY_FONT}; font-size: 14px; line-height: 1.7; color: #475569;">${nl2br(description)}</p>` : ""}
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse;">
              <tr>
                <td style="padding: 14px 0; border-top: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; font-family: ${BODY_FONT}; font-size: 13px; color: #64748b;">Offer</td>
                <td align="right" style="padding: 14px 0; border-top: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; font-family: ${BODY_FONT}; font-size: 13px; font-weight: 700; color: #0f172a;">${esc(offerSummary)}</td>
              </tr>
              <tr>
                <td style="padding: 14px 0; border-bottom: 1px solid #e2e8f0; font-family: ${BODY_FONT}; font-size: 13px; color: #64748b;">Code</td>
                <td align="right" style="padding: 14px 0; border-bottom: 1px solid #e2e8f0; font-family: 'Courier New', monospace; font-size: 14px; font-weight: 700; color: #0f172a;">${esc(couponCode) || "ABC123"}</td>
              </tr>
              ${expiry ? `<tr>
                <td style="padding: 14px 0; border-bottom: 1px solid #e2e8f0; font-family: ${BODY_FONT}; font-size: 13px; color: #64748b;">Valid until</td>
                <td align="right" style="padding: 14px 0; border-bottom: 1px solid #e2e8f0; font-family: ${BODY_FONT}; font-size: 13px; font-weight: 600; color: #0f172a;">${esc(expiry)}</td>
              </tr>` : ""}
            </table>
          </td></tr>
          ${terms ? `<tr><td style="padding: 24px 32px 32px;"><p style="margin: 0; font-family: ${BODY_FONT}; font-size: 11px; line-height: 1.6; color: #94a3b8;">${nl2br(terms)}</p></td></tr>` : `<tr><td style="padding: 0 0 12px;"></td></tr>`}
        </table>`;

  table = wrapFooterRow(table, restaurantName, options.restaurantAddress, contactText, footerText, "#94a3b8", accent, options.socialLinks);
  return shell({ title: `${restaurantName} - Notice`, bg: "#f1f5f9", content: table });
}

// ---------------------------------------------------------------------------
// Corporate — formal version of Professional: conservative, brand-focused
// ---------------------------------------------------------------------------
export function renderCorporate(options: EmailPosterOptions): string {
  const { restaurantName, logoUrl, headline, description, couponCode, terms, contactText, footerText } = options;
  const accent = options.primaryColor || "#334155";
  const offerSummary = formatOfferSummary(options);
  const expiry = formatValidUntil(options.validUntil);

  let table = `        <table role="presentation" width="600" class="yg-container" cellspacing="0" cellpadding="0" style="width: 600px; max-width: 600px; background: #ffffff;">
          <tr><td style="padding: 36px 40px 28px; text-align: center; border-bottom: 1px solid #e2e8f0;">
            ${logoUrl ? `<img src="${escAttr(logoUrl)}" alt="" style="display: block; margin: 0 auto 14px; width: 40px; height: 40px; border-radius: 6px; object-fit: cover;">` : ""}
            <p style="margin: 0; font-family: ${BODY_FONT}; font-size: 13px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: ${accent};">${esc(restaurantName)}</p>
          </td></tr>
          <tr><td class="yg-pad" style="padding: 36px 40px 0; text-align: center;">
            <h1 class="yg-h1" style="margin: 0 0 14px; font-family: ${BODY_FONT}; font-size: 24px; font-weight: 600; line-height: 1.4; color: #1e293b;">${esc(headline) || "A message from our team"}</h1>
            ${description ? `<p style="margin: 0; font-family: ${BODY_FONT}; font-size: 14px; line-height: 1.75; color: #475569;">${nl2br(description)}</p>` : ""}
          </td></tr>
          <tr><td style="padding: 30px 40px 0;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #f8fafc; border-radius: 4px;"><tr><td style="padding: 24px; text-align: center;">
              <p style="margin: 0 0 8px; font-family: ${BODY_FONT}; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #64748b;">Offer</p>
              <p style="margin: 0 0 14px; font-family: ${BODY_FONT}; font-size: 20px; font-weight: 700; color: #1e293b;">${esc(offerSummary)}</p>
              <p style="margin: 0; font-family: 'Courier New', monospace; font-size: 15px; font-weight: 700; letter-spacing: 0.1em; color: ${accent};">${esc(couponCode) || "ABC123"}</p>
              ${expiry ? `<p style="margin: 10px 0 0; font-family: ${BODY_FONT}; font-size: 12px; color: #94a3b8;">Valid until ${esc(expiry)}</p>` : ""}
            </td></tr></table>
          </td></tr>
          ${terms ? `<tr><td style="padding: 28px 40px 0; text-align: center;"><p style="margin: 0; font-family: ${BODY_FONT}; font-size: 11px; line-height: 1.6; color: #94a3b8;">${nl2br(terms)}</p></td></tr>` : ""}
        </table>`;

  table = wrapFooterRow(table, restaurantName, options.restaurantAddress, contactText, footerText, "#94a3b8", accent, options.socialLinks, );
  return shell({ title: `${restaurantName} - Notice`, bg: "#f8fafc", content: table });
}

// ---------------------------------------------------------------------------
// Brutalist — raw, huge type, sharp borders, high contrast
// ---------------------------------------------------------------------------
export function renderBrutalist(options: EmailPosterOptions): string {
  const { restaurantName, logoUrl, headline, description, couponCode, terms, contactText, footerText } = options;
  const accent = options.primaryColor || "#ff0000";
  const offerSummary = formatOfferSummary(options);
  const expiry = formatValidUntil(options.validUntil);

  let table = `        <table role="presentation" width="600" class="yg-container" cellspacing="0" cellpadding="0" style="width: 600px; max-width: 600px; background: #ffffff; border: 4px solid #000000;">
          <tr><td style="padding: 20px 24px; background: #000000;">
            ${logoUrl ? `<img src="${escAttr(logoUrl)}" alt="" style="display: inline-block; width: 24px; height: 24px; border-radius: 4px; object-fit: cover; vertical-align: middle; margin-right: 10px;">` : ""}
            <span style="font-family: 'Courier New', monospace; font-size: 13px; font-weight: 700; letter-spacing: 0.05em; color: #ffffff; text-transform: uppercase;">${esc(restaurantName)} // OFFER.TXT</span>
          </td></tr>
          <tr><td style="padding: 36px 28px 0;">
            <h1 class="yg-h1" style="margin: 0; font-family: 'Courier New', monospace; font-size: 46px; font-weight: 700; line-height: 0.98; color: #000000; text-transform: uppercase;">${esc(headline) || "Get the offer"}</h1>
            ${description ? `<p style="margin: 18px 0 0; font-family: 'Courier New', monospace; font-size: 13px; line-height: 1.6; color: #525252;">${nl2br(description)}</p>` : ""}
          </td></tr>
          <tr><td style="padding: 26px 28px 0;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border: 3px solid #000000;"><tr>
              <td style="padding: 20px; border-right: 3px solid #000000; background: ${accent};">
                <p style="margin: 0; font-family: 'Courier New', monospace; font-size: 13px; font-weight: 700; color: #ffffff; text-transform: uppercase;">${esc(offerSummary)}</p>
              </td>
              <td style="padding: 20px; text-align: center;">
                <span style="font-family: 'Courier New', monospace; font-size: 20px; font-weight: 700; letter-spacing: 0.1em; color: #000000;">${esc(couponCode) || "ABC123"}</span>
              </td>
            </tr></table>
          </td></tr>
          ${expiry ? `<tr><td style="padding: 18px 28px 0;"><p style="margin: 0; font-family: 'Courier New', monospace; font-size: 12px; font-weight: 700; color: #000000; text-transform: uppercase;">// EXPIRES ${esc(expiry)}</p></td></tr>` : ""}
          <tr><td style="padding: 20px 28px 0;">
            <p style="margin: 0; font-family: 'Courier New', monospace; font-size: 11px; font-weight: 700; color: ${accent}; text-transform: uppercase;">// SHOW CODE AT CHECKOUT</p>
          </td></tr>
          ${terms ? `<tr><td style="padding: 22px 28px 0;"><p style="margin: 0; font-family: 'Courier New', monospace; font-size: 10px; line-height: 1.6; color: #525252;">${nl2br(terms)}</p></td></tr>` : ""}
        </table>`;

  table = wrapFooterRow(table, restaurantName, options.restaurantAddress, contactText, footerText, "#525252", "#000000", options.socialLinks);
  return shell({ title: `${restaurantName} - Offer`, bg: "#f5f5f5", content: table, bodyStyle: `font-family: 'Courier New', monospace;` });
}

// ---------------------------------------------------------------------------
// Organic — earthy colors, soft curves, natural photography
// ---------------------------------------------------------------------------
export function renderOrganic(options: EmailPosterOptions): string {
  const { restaurantName, logoUrl, headline, description, couponCode, terms, heroImageUrl, contactText, footerText } = options;
  const accent = options.primaryColor || "#5b7553";
  const offerSummary = formatOfferSummary(options);
  const expiry = formatValidUntil(options.validUntil);

  const badgeImg = heroImageUrl
    ? `<img src="${escAttr(heroImageUrl)}" alt="" style="display: block; width: 108px; height: 108px; border-radius: 50%; object-fit: cover; margin: 0 auto 18px; border: 4px solid #ffffff;">`
    : logoUrl
      ? `<img src="${escAttr(logoUrl)}" alt="" style="display: block; width: 88px; height: 88px; border-radius: 50%; object-fit: cover; margin: 0 auto 18px; border: 4px solid #ffffff;">`
      : `<div style="width: 88px; height: 88px; border-radius: 50%; background: ${accent}; margin: 0 auto 18px; text-align: center; line-height: 88px; font-family: ${HEADLINE_FONT}; font-size: 34px; color: #ffffff;">${esc((restaurantName || "Y").charAt(0).toUpperCase())}</div>`;

  let table = `        <table role="presentation" width="600" class="yg-container" cellspacing="0" cellpadding="0" style="width: 600px; max-width: 600px;">
          <tr><td style="padding: 18px 18px 0;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: linear-gradient(160deg, #eef2e6 0%, #f6f1e3 100%); border-radius: 40px 40px 90px 40px;"><tr><td class="yg-pad" style="padding: 40px 40px 34px; text-align: center;">
              ${badgeImg}
              <p style="margin: 0 0 12px; font-family: ${BODY_FONT}; font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: ${accent};">${esc(restaurantName)}</p>
              <h1 class="yg-h1" style="margin: 0; font-family: ${BODY_FONT}; font-size: 28px; font-weight: 700; line-height: 1.35; color: #2e3a26;">${esc(headline) || "Fresh reasons to come back"}</h1>
              ${description ? `<p style="margin: 14px 0 0; font-family: ${BODY_FONT}; font-size: 14px; line-height: 1.7; color: #5a6650;">${nl2br(description)}</p>` : ""}
            </td></tr></table>
          </td></tr>
          <tr><td class="yg-pad" style="padding: 28px 36px 0; text-align: center;">
            <p style="margin: 0 0 4px; font-family: ${BODY_FONT}; font-size: 30px; font-weight: 800; color: ${accent};">${esc(offerSummary)}</p>
            ${expiry ? `<p style="margin: 0; font-family: ${BODY_FONT}; font-size: 12px; color: #8b9481;">Good through ${esc(expiry)}</p>` : ""}
          </td></tr>
          <tr><td style="padding: 22px 36px 0; text-align: center;">
            <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto;"><tr><td style="padding: 14px 26px; background: #ffffff; border: 2px dashed ${accent}80; border-radius: 20px;">
              <span style="font-family: 'Courier New', monospace; font-size: 20px; font-weight: 700; letter-spacing: 0.18em; color: #2e3a26;">${esc(couponCode) || "ABC123"}</span>
            </td></tr></table>
          </td></tr>
          ${terms ? `<tr><td style="padding: 24px 36px 0; text-align: center;"><p style="margin: 0; font-family: ${BODY_FONT}; font-size: 11px; line-height: 1.7; color: #9aa38f;">${nl2br(terms)}</p></td></tr>` : ""}
        </table>`;

  table = wrapFooterRow(table, restaurantName, options.restaurantAddress, contactText, footerText, "#9aa38f", accent, options.socialLinks);
  return shell({ title: `${restaurantName} - A fresh offer`, bg: "#f5f1e6", content: table });
}

// ---------------------------------------------------------------------------
// Futuristic — dark, sparing neon accents, geometric, sharp typography
// ---------------------------------------------------------------------------
export function renderFuturistic(options: EmailPosterOptions): string {
  const { restaurantName, logoUrl, headline, description, couponCode, terms, contactText, footerText } = options;
  const accent = options.primaryColor || "#22d3ee";
  const offerSummary = formatOfferSummary(options);
  const expiry = formatValidUntil(options.validUntil);
  const grid =
    "repeating-linear-gradient(0deg, rgba(34,211,238,0.08) 0px, rgba(34,211,238,0.08) 1px, transparent 1px, transparent 32px)," +
    "repeating-linear-gradient(90deg, rgba(34,211,238,0.08) 0px, rgba(34,211,238,0.08) 1px, transparent 1px, transparent 32px)";

  let table = `        <table role="presentation" width="600" class="yg-container" cellspacing="0" cellpadding="0" style="width: 600px; max-width: 600px; background: #05060a; background-image: ${grid}; border: 1px solid ${accent}55;">
          <tr><td style="padding: 30px 34px 0;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>
              <td style="vertical-align: top;">${logoUrl ? `<img src="${escAttr(logoUrl)}" alt="" style="display: block; width: 32px; height: 32px; border-radius: 4px; object-fit: cover; border: 1px solid ${accent}; margin-bottom: 8px;">` : ""}<span style="font-family: 'Courier New', monospace; font-size: 12px; font-weight: 700; color: ${accent}; letter-spacing: 0.08em;">${esc(restaurantName).toUpperCase()}</span></td>
              <td align="right" style="vertical-align: top;"><span style="font-family: 'Courier New', monospace; font-size: 10px; color: #64748b;">// TRANSMISSION</span></td>
            </tr></table>
            <div style="height: 1px; background: linear-gradient(90deg, ${accent}, transparent); margin: 16px 0 0;"></div>
          </td></tr>
          <tr><td class="yg-pad" style="padding: 28px 34px 0;">
            <h1 class="yg-h1" style="margin: 0; font-family: ${BODY_FONT}; font-size: 30px; font-weight: 800; line-height: 1.25; color: #ffffff;">${esc(headline) || "The future tastes better here"}</h1>
            ${description ? `<p style="margin: 12px 0 0; font-family: ${BODY_FONT}; font-size: 13px; line-height: 1.7; color: #94a3b8;">${nl2br(description)}</p>` : ""}
          </td></tr>
          <tr><td class="yg-pad" style="padding: 26px 34px 0;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: rgba(34,211,238,0.06); border: 1px solid ${accent}55; border-radius: 4px;"><tr><td style="padding: 22px; text-align: center;">
              <p style="margin: 0 0 6px; font-family: 'Courier New', monospace; font-size: 10px; font-weight: 700; letter-spacing: 0.16em; color: ${accent};">[ OFFER ]</p>
              <p style="margin: 0 0 14px; font-family: ${BODY_FONT}; font-size: 24px; font-weight: 800; color: #ffffff;">${esc(offerSummary)}</p>
              <p style="margin: 0; font-family: 'Courier New', monospace; font-size: 18px; font-weight: 700; letter-spacing: 0.14em; color: ${accent};">${esc(couponCode) || "ABC123"}</p>
              ${expiry ? `<p style="margin: 12px 0 0; font-family: 'Courier New', monospace; font-size: 11px; color: #64748b;">EXPIRES: ${esc(expiry)}</p>` : ""}
            </td></tr></table>
          </td></tr>
          ${terms ? `<tr><td style="padding: 24px 34px 0;"><p style="margin: 0; font-family: 'Courier New', monospace; font-size: 10px; line-height: 1.6; color: #475569;">${nl2br(terms)}</p></td></tr>` : ""}
        </table>`;

  table = wrapFooterRow(table, restaurantName, options.restaurantAddress, contactText, footerText, "#475569", accent, options.socialLinks);
  return shell({ title: `${restaurantName} - Offer`, bg: "#000000", content: table });
}

// ---------------------------------------------------------------------------
// Retro — vintage-inspired type, poster layout, nostalgic but polished
// ---------------------------------------------------------------------------
export function renderRetro(options: EmailPosterOptions): string {
  const { restaurantName, headline, description, couponCode, terms, contactText, footerText } = options;
  const accent = options.primaryColor || "#d9480f";
  const offerSummary = formatOfferSummary(options);
  const expiry = formatValidUntil(options.validUntil);

  let table = `        <table role="presentation" width="600" class="yg-container" cellspacing="0" cellpadding="0" style="width: 600px; max-width: 600px; background: #f4e9d8; border: 6px double #3a2618;">
          <tr><td style="padding: 34px 36px 0; text-align: center;">
            <p style="margin: 0 0 8px; font-family: ${BODY_FONT}; font-size: 12px; font-weight: 700; letter-spacing: 0.3em; text-transform: uppercase; color: ${accent};">${esc(restaurantName)}</p>
            <p style="margin: 0 0 14px; font-family: ${BODY_FONT}; font-size: 10px; letter-spacing: 0.2em; color: #6b5a42;">EST. YUMMY</p>
            <h1 class="yg-h1" style="margin: 0; font-family: ${HEADLINE_FONT}; font-size: 44px; font-weight: 700; line-height: 1.1; color: #3a2618; text-transform: uppercase;">${esc(headline) || "The Original Offer"}</h1>
            ${description ? `<p style="margin: 14px 0 0; font-family: ${BODY_FONT}; font-size: 13px; line-height: 1.7; color: #6b5a42;">${nl2br(description)}</p>` : ""}
          </td></tr>
          <tr><td style="padding: 26px 60px 0;"><div style="border-top: 2px solid #3a2618;"></div></td></tr>
          <tr><td style="padding: 24px 36px 0; text-align: center;">
            <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto;"><tr><td style="padding: 4px; border: 3px solid #3a2618; border-radius: 50%; width: 150px; height: 150px;">
              <table role="presentation" width="150" height="150" cellspacing="0" cellpadding="0" style="border: 1px solid #3a2618; border-radius: 50%; background: ${accent};"><tr><td align="center" valign="middle">
                <p style="margin: 0; font-family: ${HEADLINE_FONT}; font-size: 26px; font-weight: 700; color: #f4e9d8;">${esc(offerSummary).split(" ")[0]}</p>
                <p style="margin: 0; font-family: ${BODY_FONT}; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #f4e9d8;">off</p>
              </td></tr></table>
            </td></tr></table>
          </td></tr>
          <tr><td style="padding: 22px 36px 0; text-align: center;">
            <span style="font-family: 'Courier New', monospace; font-size: 18px; font-weight: 700; letter-spacing: 0.2em; color: #3a2618; border: 1px dashed #3a2618; padding: 8px 16px; display: inline-block;">${esc(couponCode) || "ABC123"}</span>
            ${expiry ? `<p style="margin: 12px 0 0; font-family: ${BODY_FONT}; font-size: 12px; color: #6b5a42;">Through ${esc(expiry)}</p>` : ""}
          </td></tr>
          ${terms ? `<tr><td style="padding: 24px 36px 0; text-align: center;"><p style="margin: 0; font-family: ${BODY_FONT}; font-size: 11px; line-height: 1.6; color: #8a7862;">${nl2br(terms)}</p></td></tr>` : ""}
        </table>`;

  table = wrapFooterRow(table, restaurantName, options.restaurantAddress, contactText, footerText, "#8a7862", accent, options.socialLinks);
  return shell({ title: `${restaurantName} - Offer`, bg: "#e9dcc4", content: table });
}

// ---------------------------------------------------------------------------
// Vintage — traditional type, muted colors, classic borders
// ---------------------------------------------------------------------------
export function renderVintage(options: EmailPosterOptions): string {
  const { restaurantName, logoUrl, headline, description, couponCode, terms, heroImageUrl, contactText, footerText } = options;
  const accent = options.primaryColor || "#7c6a4f";
  const offerSummary = formatOfferSummary(options);
  const expiry = formatValidUntil(options.validUntil);

  let table = `        <table role="presentation" width="600" class="yg-container" cellspacing="0" cellpadding="0" style="width: 600px; max-width: 600px; background: #f2ead9; border: 1px solid ${accent}; padding: 6px;">
          <tr><td style="border: 1px solid ${accent}80; padding: 0;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
              <tr><td style="padding: 34px 40px 0; text-align: center;">
                ${logoUrl ? `<img src="${escAttr(logoUrl)}" alt="" style="display: block; margin: 0 auto 14px; width: 52px; height: 52px; border-radius: 50%; object-fit: cover; border: 2px solid ${accent};">` : ""}
                <p style="margin: 0 0 6px; font-family: ${HEADLINE_FONT}; font-size: 13px; font-weight: 600; letter-spacing: 0.2em; text-transform: uppercase; color: ${accent};">${esc(restaurantName)}</p>
                <div style="width: 60px; height: 1px; background: ${accent}; margin: 14px auto;"></div>
                <h1 class="yg-h1" style="margin: 0; font-family: ${HEADLINE_FONT}; font-size: 32px; font-weight: 700; line-height: 1.3; color: #3d3423;">${esc(headline) || "A classic favorite, revisited"}</h1>
                ${description ? `<p style="margin: 14px 0 0; font-family: ${BODY_FONT}; font-size: 13px; font-style: italic; line-height: 1.75; color: #5c4f3a;">${nl2br(description)}</p>` : ""}
              </td></tr>
              ${heroImageUrl ? `<tr><td style="padding: 26px 40px 0;">${heroImage({ url: heroImageUrl, height: 220, fallbackBg: "" })}</td></tr>` : ""}
              <tr><td style="padding: 28px 40px 0; text-align: center;">
                <p style="margin: 0 0 8px; font-family: ${BODY_FONT}; font-size: 11px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: ${accent};">Presenting</p>
                <p style="margin: 0 0 14px; font-family: ${HEADLINE_FONT}; font-size: 26px; color: #3d3423;">${esc(offerSummary)}</p>
                <p style="margin: 0; font-family: 'Courier New', monospace; font-size: 17px; font-weight: 700; letter-spacing: 0.16em; color: #3d3423;">${esc(couponCode) || "ABC123"}</p>
                ${expiry ? `<p style="margin: 12px 0 0; font-family: ${BODY_FONT}; font-size: 12px; font-style: italic; color: #7c6a4f;">Offer available through ${esc(expiry)}</p>` : ""}
              </td></tr>
              ${terms ? `<tr><td style="padding: 26px 40px 0; text-align: center;"><p style="margin: 0; font-family: ${BODY_FONT}; font-size: 11px; font-style: italic; line-height: 1.7; color: #8a7c62;">${nl2br(terms)}</p></td></tr>` : ""}
            </table>
          </td></tr>
        </table>`;

  table = wrapFooterRow(table, restaurantName, options.restaurantAddress, contactText, footerText, "#8a7c62", accent, options.socialLinks);
  return shell({ title: `${restaurantName} - A classic offer`, bg: "#e7dcc3", content: table });
}

// ---------------------------------------------------------------------------
// Art Deco — geometric luxury, symmetry, thin lines, gold accents
// ---------------------------------------------------------------------------
export function renderArtDeco(options: EmailPosterOptions): string {
  const { restaurantName, logoUrl, headline, description, couponCode, terms, contactText, footerText } = options;
  const accent = options.primaryColor || "#c9a34e";
  const offerSummary = formatOfferSummary(options);
  const expiry = formatValidUntil(options.validUntil);
  const chevrons = `<p style="margin: 0; text-align: center; color: ${accent}; font-size: 10px; letter-spacing: 0.4em;">&#9671; &#9671; &#9671;</p>`;

  let table = `        <table role="presentation" width="600" class="yg-container" cellspacing="0" cellpadding="0" style="width: 600px; max-width: 600px; background: #0d1b1e; border: 2px solid ${accent};">
          <tr><td style="padding: 12px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border: 1px solid ${accent}80;">
              <tr><td style="padding: 34px 40px 0; text-align: center;">
                ${logoUrl ? `<img src="${escAttr(logoUrl)}" alt="" style="display: block; margin: 0 auto 16px; width: 46px; height: 46px; object-fit: cover; border: 1px solid ${accent};">` : ""}
                <p style="margin: 0 0 12px; font-family: ${BODY_FONT}; font-size: 11px; font-weight: 600; letter-spacing: 0.32em; text-transform: uppercase; color: ${accent};">${esc(restaurantName)}</p>
                ${chevrons}
                <h1 class="yg-h1" style="margin: 16px 0 0; font-family: ${HEADLINE_FONT}; font-size: 30px; font-weight: 700; line-height: 1.3; color: #f2e8cf; letter-spacing: 0.02em;">${esc(headline) || "An affair to remember"}</h1>
                ${description ? `<p style="margin: 14px 0 0; font-family: ${BODY_FONT}; font-size: 13px; line-height: 1.75; color: #c9bda3;">${nl2br(description)}</p>` : ""}
              </td></tr>
              <tr><td style="padding: 28px 40px 0;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border: 1px solid ${accent}80;"><tr><td style="padding: 24px; text-align: center;">
                  <p style="margin: 0 0 8px; font-family: ${BODY_FONT}; font-size: 10px; font-weight: 700; letter-spacing: 0.24em; text-transform: uppercase; color: ${accent};">Your privilege</p>
                  <p style="margin: 0 0 14px; font-family: ${HEADLINE_FONT}; font-size: 26px; color: #f2e8cf;">${esc(offerSummary)}</p>
                  <p style="margin: 0; font-family: 'Courier New', monospace; font-size: 17px; font-weight: 700; letter-spacing: 0.2em; color: ${accent};">${esc(couponCode) || "ABC123"}</p>
                  ${expiry ? `<p style="margin: 12px 0 0; font-family: ${BODY_FONT}; font-size: 12px; color: #a89b7e;">Until ${esc(expiry)}</p>` : ""}
                </td></tr></table>
              </td></tr>
              <tr><td style="padding: 28px 40px 0; text-align: center;">${chevrons}</td></tr>
              ${terms ? `<tr><td style="padding: 20px 40px 0; text-align: center;"><p style="margin: 0; font-family: ${BODY_FONT}; font-size: 11px; line-height: 1.6; color: #8a7f68;">${nl2br(terms)}</p></td></tr>` : ""}
            </table>
          </td></tr>
        </table>`;

  table = wrapFooterRow(table, restaurantName, options.restaurantAddress, contactText, footerText, "#8a7f68", accent, options.socialLinks);
  return shell({ title: `${restaurantName} - A privilege`, bg: "#080f11", content: table });
}
