/**
 * Generate poster-style HTML email matching backend template
 * Mirrors backend/app/utils/grow_email_template.py:render_poster_style_email_html()
 */

import type { CampaignPosterTemplate } from "./campaign-studio";
import { templateColors } from "@/components/grow/campaign-studio/poster-templates/shared";

export interface EmailPosterOptions {
  template?: CampaignPosterTemplate;
  restaurantName: string;
  logoUrl?: string;
  primaryColor?: string;
  // Shown as the poster's big headline text. Mirrors the backend's real send
  // (growth_campaign_delivery_service.py passes the campaign's resolved email
  // subject as `headline` into render_poster_style_email_html) — wiring the
  // studio's Email subject field in here keeps this preview honest about
  // what the headline actually is.
  headline?: string;
  discountType: "percentage" | "flat_amount";
  value: number;
  percentageCap?: number | null;
  minimumOrderValue?: number | null;
  validUntil?: string | null;
  couponCode?: string;
  terms?: string;
}

// Elegant serif headline + clean sans body. Google Fonts is loaded via <link>
// for clients that support remote fonts (Apple Mail, Gmail, Outlook.com,
// browser preview); the stack after the family name is the web-safe fallback
// used by everyone else (desktop Outlook, etc).
export const HEADLINE_FONT = "'Playfair Display', Georgia, 'Times New Roman', serif";
export const BODY_FONT = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif";
export const GOOGLE_FONTS_LINK =
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Inter:wght@400;500;600;700&display=swap">';

// Shared responsive rules, included in every layout's <head>. Email clients
// need real media queries (inline styles alone can't do this) — supported by
// Apple Mail, iOS/Android Gmail app, Outlook.com/mobile, Yahoo; ignored by
// Outlook desktop, which just falls back to the desktop layout, same as any
// other progressive-enhancement CSS in email. Class names are applied per
// layout below:
//   .yg-container   outer table — locks to 100% width under 600px
//   .yg-stack       a side-by-side column that should become full-width/block
//   .yg-stack-gap   vertical spacing added between stacked columns
//   .yg-h1 / .yg-h2 headline / offer-amount type scale, sized down on mobile
//   .yg-pad         generous desktop padding, tightened on mobile
export const RESPONSIVE_STYLE = `<style>
  @media only screen and (max-width: 600px) {
    .yg-container { width: 100% !important; }
    .yg-stack { display: block !important; width: 100% !important; box-sizing: border-box !important; }
    .yg-stack-gap { padding-top: 20px !important; }
    .yg-h1 { font-size: 26px !important; line-height: 1.25 !important; }
    .yg-h2 { font-size: 30px !important; }
    .yg-pad { padding: 16px !important; }
  }
</style>`;

function formatAmount(amount: number): string {
  return `Rs. ${amount.toLocaleString("en-NP", { maximumFractionDigits: 0 })}`;
}

function formatOfferSummary(options: EmailPosterOptions): string {
  const { discountType, value, percentageCap, minimumOrderValue } = options;
  
  let summary = "";
  
  if (discountType === "percentage") {
    summary = `${value}% off`;
    if (percentageCap) {
      summary += ` (max ${formatAmount(percentageCap)})`;
    }
  } else {
    summary = `${formatAmount(value)} off`;
  }
  
  if (minimumOrderValue) {
    summary += ` on orders above ${formatAmount(minimumOrderValue)}`;
  }
  
  return summary;
}

function formatValidUntil(validUntil: string | null): string {
  if (!validUntil) return "";
  
  try {
    const date = new Date(validUntil);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  } catch {
    return validUntil;
  }
}

export function renderPosterStyleEmailHtml(options: EmailPosterOptions): string {
  const {
    template = "vibrant",
    restaurantName,
    logoUrl,
    primaryColor,
    couponCode = "ABC123",
    terms = "",
  } = options;
  
  const offerSummary = formatOfferSummary(options);
  const expiryDate = formatValidUntil(options.validUntil);
  
  // Get template colors
  const colors = templateColors[template] || templateColors.vibrant;
  const bgGradient = `linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%)`;
  const accentColor = primaryColor || colors.primary;
  
  // Choose layout based on template - MORE AGGRESSIVE DIFFERENTIATION
  const templateLower = template.toLowerCase();

  // Category 0: Premium - dark charcoal, gold-foil, certificate-style
  if (templateLower.includes("premium")) {
    return renderPremiumEmailLayout(options, colors, accentColor, offerSummary, expiryDate);
  }

  // Category 0.5: Grid - bento-box cell layout
  if (templateLower.includes("grid")) {
    return renderGridEmailLayout(options, colors, accentColor, offerSummary, expiryDate, bgGradient);
  }

  // Category 1: Minimal/Minimalist - Dark single column
  if (templateLower.includes("minimal")) {
    return renderMinimalEmailLayout(options, colors, accentColor, offerSummary, expiryDate);
  }
  
  // Category 2: Ticket - Two-panel ticket design
  if (templateLower.includes("ticket")) {
    return renderTicketEmailLayout(options, colors, accentColor, offerSummary, expiryDate);
  }
  
  // Category 3: Bold/Vibrant/Expressive/Neon/Maximalist - Full-width gradient with centered card
  if (templateLower.includes("bold") || templateLower.includes("vibrant") || 
      templateLower.includes("expressive") || templateLower.includes("neon") || 
      templateLower.includes("maximalist")) {
    return renderBoldEmailLayout(options, colors, accentColor, offerSummary, expiryDate, bgGradient);
  }
  
  // Category 4: Elegant/Luxury/Royal/Platinum/Gold - Serif font, sophisticated
  if (templateLower.includes("elegant") || templateLower.includes("luxury") || 
      templateLower.includes("royal") || templateLower.includes("platinum") || 
      templateLower.includes("gold")) {
    return renderElegantEmailLayout(options, colors, accentColor, offerSummary, expiryDate);
  }
  
  // Category 5: Geometric/Artistic - Sharp edges, geometric shapes
  if (templateLower.includes("geometric") || templateLower.includes("artistic")) {
    return renderGeometricEmailLayout(options, colors, accentColor, offerSummary, expiryDate);
  }
  
  // Default: Fresh/Modern/Warm/etc - Two-column classic layout
  return renderDefaultEmailLayout(options, colors, accentColor, offerSummary, expiryDate, bgGradient);
}

// Default Layout (Fresh, Warm, Modern, etc.) - Two-column with gradient left panel
function renderDefaultEmailLayout(
  options: EmailPosterOptions,
  colors: { primary: string; secondary: string },
  accentColor: string,
  offerSummary: string,
  expiryDate: string,
  bgGradient: string
): string {
  const { restaurantName, logoUrl, headline = "", couponCode = "ABC123", terms = "" } = options;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${restaurantName} - Special Offer</title>
  ${GOOGLE_FONTS_LINK}
  ${RESPONSIVE_STYLE}
</head>
<body style="margin: 0; padding: 0; font-family: ${BODY_FONT}; background-color: #f4f4f4;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f4f4f4; padding: 8px 0;">
    <tr>
      <td align="center">
        <!-- Main container -->
        <table role="presentation" width="600" class="yg-container" cellspacing="0" cellpadding="0" style="width: 600px; max-width: 600px; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <!-- Two-column poster layout -->
          <tr>
            <td>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <!-- Left column (40%) - Gradient panel -->
                  <td width="240" class="yg-stack" style="background: ${bgGradient}; color: #ffffff; padding: 20px 16px; vertical-align: top;">
                    ${logoUrl ? `
                    <div style="margin-bottom: 20px;">
                      <img src="${logoUrl}" alt="${restaurantName}" style="max-width: 80px; height: auto; border-radius: 8px;" />
                    </div>
                    ` : ''}

                    <h3 style="margin: 0 0 10px 0; font-family: ${HEADLINE_FONT}; font-size: 18px; font-weight: 600; color: rgba(255,255,255,0.85); line-height: 1.2;">
                      ${restaurantName}
                    </h3>

                    <p style="margin: 0 0 20px 0; font-family: ${HEADLINE_FONT}; font-size: 22px; font-weight: 700; color: #ffffff; line-height: 1.3;">
                      ${headline || "Special Offer"}
                    </p>

                    <div style="margin: 20px 0; padding: 15px; background-color: rgba(255,255,255,0.15); border-radius: 6px; backdrop-filter: blur(10px);">
                      <p style="margin: 0; font-size: 13px; color: rgba(255,255,255,0.9); font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">
                        Your Discount
                      </p>
                      <p style="margin: 8px 0 0 0; font-family: ${HEADLINE_FONT}; font-size: 28px; font-weight: 700; color: #ffffff; line-height: 1.2;">
                        ${offerSummary}
                      </p>
                    </div>
                    
                    ${expiryDate ? `
                    <p style="margin: 0; font-size: 12px; color: rgba(255,255,255,0.7);">
                      Valid until ${expiryDate}
                    </p>
                    ` : ''}
                  </td>
                  
                  <!-- Right column (60%) - White ticket panel -->
                  <td width="360" class="yg-stack yg-stack-gap" style="background-color: #ffffff; padding: 20px 18px; vertical-align: top; position: relative;">
                    <h2 style="margin: 0 0 15px 0; font-family: ${HEADLINE_FONT}; font-size: 22px; font-weight: 700; color: #1a1a1a; line-height: 1.3;">
                      Your exclusive coupon is ready!
                    </h2>
                    
                    <p style="margin: 0 0 20px 0; font-size: 14px; color: #4a4a4a; line-height: 1.6;">
                      Show this code at ${restaurantName} to claim your discount.
                    </p>
                    
                    <!-- Coupon code box -->
                    <div style="margin: 0 0 20px 0; padding: 20px; background: linear-gradient(135deg, ${accentColor}15 0%, ${accentColor}25 100%); border: 2px dashed ${accentColor}; border-radius: 8px; text-align: center;">
                      <p style="margin: 0 0 5px 0; font-size: 11px; font-weight: bold; color: ${accentColor}; text-transform: uppercase; letter-spacing: 1px;">
                        Coupon Code
                      </p>
                      <p style="margin: 0; font-family: 'Courier New', monospace; font-size: 32px; font-weight: bold; color: #1a1a1a; letter-spacing: 3px;">
                        ${couponCode}
                      </p>
                    </div>
                    
                    ${terms ? `
                    <div style="margin: 20px 0 0 0; padding: 12px; background-color: #f9f9f9; border-left: 3px solid ${accentColor}; border-radius: 4px;">
                      <p style="margin: 0 0 5px 0; font-size: 11px; font-weight: bold; color: #1a1a1a; text-transform: uppercase;">
                        Terms & Conditions
                      </p>
                      <p style="margin: 0; font-size: 11px; color: #666666; line-height: 1.5;">
                        ${terms.replace(/\n/g, '<br>')}
                      </p>
                    </div>
                    ` : ''}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 12px; background-color: #f9f9f9; text-align: center; border-top: 1px solid #e0e0e0;">
              <p style="margin: 0 0 8px 0; font-size: 12px; color: #666666;">
                You're receiving this because you opted in to offers from ${restaurantName} on Yummy.
              </p>
              <p style="margin: 0; font-size: 11px; color: #999999;">
                <a href="{{unsubscribe_url}}" style="color: #666666; text-decoration: underline;">Unsubscribe</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// Minimal Layout - Dark background with minimalist design
function renderMinimalEmailLayout(
  options: EmailPosterOptions,
  colors: { primary: string; secondary: string },
  accentColor: string,
  offerSummary: string,
  expiryDate: string
): string {
  const { restaurantName, logoUrl, headline = "", couponCode = "ABC123", terms = "" } = options;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${restaurantName} - Special Offer</title>
  ${GOOGLE_FONTS_LINK}
  ${RESPONSIVE_STYLE}
</head>
<body style="margin: 0; padding: 0; font-family: ${BODY_FONT}; background-color: #0a0a0a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0a0a0a; padding: 8px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" class="yg-container yg-pad" cellspacing="0" cellpadding="0" style="width: 600px; max-width: 600px; background-color: #0a0a0a; border-radius: 8px; padding: 20px;">
          <!-- Header -->
          <tr>
            <td style="padding-bottom: 16px;">
              <table width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td width="70%">
                    ${logoUrl ? `<img src="${logoUrl}" alt="${restaurantName}" style="width: 60px; height: 60px; border-radius: 8px; margin-bottom: 15px;" />` : ''}
                    <h3 style="margin: 0; font-family: ${HEADLINE_FONT}; font-size: 20px; color: #ffffff; font-weight: 700;">${restaurantName}</h3>
                  </td>
                  <td width="30%" align="right">
                    <div style="width: 50px; height: 4px; background-color: ${accentColor}; border-radius: 2px;"></div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          ${headline ? `
          <!-- Headline -->
          <tr>
            <td style="padding-bottom: 20px;">
              <p style="margin: 0; font-family: ${HEADLINE_FONT}; font-size: 22px; font-weight: 700; color: #ffffff; line-height: 1.3;">
                ${headline}
              </p>
            </td>
          </tr>
          ` : ''}

          <!-- Offer Card -->
          <tr>
            <td style="padding: 30px; background-color: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; margin-bottom: 20px;">
              <p style="margin: 0 0 10px 0; font-size: 11px; color: #9ca3af; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">
                SPECIAL OFFER
              </p>
              <h1 class="yg-h2" style="margin: 0 0 15px 0; font-family: ${HEADLINE_FONT}; font-size: 38px; color: ${accentColor}; font-weight: 700; line-height: 1.1;">
                ${offerSummary}
              </h1>
              ${expiryDate ? `
              <p style="margin: 0; font-size: 13px; color: #d1d5db; font-weight: 600;">
                📅 Valid until ${expiryDate}
              </p>
              ` : ''}
            </td>
          </tr>
          
          <!-- Coupon Code -->
          <tr>
            <td style="padding: 25px; background: linear-gradient(135deg, ${accentColor}20 0%, ${accentColor}30 100%); border: 2px dashed ${accentColor}; border-radius: 10px; text-align: center; margin: 20px 0;">
              <p style="margin: 0 0 8px 0; font-size: 12px; color: ${accentColor}; font-weight: bold; text-transform: uppercase;">
                Your Code
              </p>
              <p style="margin: 0; font-family: 'Courier New', monospace; font-size: 40px; font-weight: bold; color: #ffffff; letter-spacing: 4px;">
                ${couponCode}
              </p>
            </td>
          </tr>
          
          <!-- Terms -->
          ${terms ? `
          <tr>
            <td style="padding: 20px; background-color: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; margin-top: 20px;">
              <p style="margin: 0; font-size: 12px; color: #e5e7eb; line-height: 1.6;">
                ${terms.replace(/\n/g, '<br>')}
              </p>
            </td>
          </tr>
          ` : ''}
          
          <!-- Footer -->
          <tr>
            <td style="padding-top: 16px; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #6b7280;">
                You're receiving this from ${restaurantName} on Yummy.
                <a href="{{unsubscribe_url}}" style="color: #9ca3af; text-decoration: underline;">Unsubscribe</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// Ticket Layout - Two-panel ticket design
function renderTicketEmailLayout(
  options: EmailPosterOptions,
  colors: { primary: string; secondary: string },
  accentColor: string,
  offerSummary: string,
  expiryDate: string
): string {
  const { restaurantName, logoUrl, headline = "", couponCode = "ABC123", terms = "" } = options;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${restaurantName} - Special Offer</title>
  ${GOOGLE_FONTS_LINK}
  ${RESPONSIVE_STYLE}
</head>
<body style="margin: 0; padding: 0; font-family: ${BODY_FONT}; background: linear-gradient(135deg, #1f2937 0%, #111827 100%);">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: linear-gradient(135deg, #1f2937 0%, #111827 100%); padding: 8px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" class="yg-container" cellspacing="0" cellpadding="0" style="width: 600px; max-width: 600px; border-radius: 12px; overflow: hidden;">
          <tr>
            <td>
              <table width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <!-- Left Dark Panel (35%) -->
                  <td width="210" class="yg-stack" style="background: linear-gradient(135deg, #374151 0%, #1f2937 100%); padding: 20px 16px; vertical-align: top;">
                    ${logoUrl ? `<img src="${logoUrl}" alt="${restaurantName}" style="width: 70px; height: 70px; border-radius: 12px; margin-bottom: 20px;" />` : ''}
                    <h3 style="margin: 0 0 15px 0; font-family: ${HEADLINE_FONT}; font-size: 20px; color: #ffffff; font-weight: 700; line-height: 1.2;">
                      ${restaurantName}
                    </h3>
                    <div style="width: 60px; height: 4px; background-color: ${accentColor}; border-radius: 2px; margin-bottom: 20px;"></div>
                    <p style="margin: 0; font-family: ${HEADLINE_FONT}; font-size: 18px; color: #ffffff; line-height: 1.35; font-weight: 700;">
                      ${headline || "Exclusive Offer Inside"}
                    </p>
                  </td>

                  <!-- Right White Ticket (65%) -->
                  <td width="390" class="yg-stack yg-stack-gap" style="background-color: #ffffff; padding: 20px 18px; vertical-align: middle; position: relative;">
                    <!-- Gift Icon -->
                    <div style="text-align: center; margin-bottom: 20px;">
                      <div style="display: inline-block; width: 70px; height: 70px; background: ${accentColor}15; border-radius: 50%; padding-top: 18px;">
                        <span style="font-size: 34px;">🎁</span>
                      </div>
                    </div>

                    <!-- Offer -->
                    <div style="text-align: center; margin-bottom: 20px;">
                      <p style="margin: 0 0 8px 0; font-size: 11px; color: #6b7280; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">
                        GET
                      </p>
                      <h1 style="margin: 0 0 15px 0; font-family: ${HEADLINE_FONT}; font-size: 34px; color: ${accentColor}; font-weight: 700; line-height: 1;">
                        ${offerSummary}
                      </h1>
                    </div>
                    
                    <!-- Coupon -->
                    <div style="margin: 20px 0; padding: 18px; background: ${accentColor}10; border: 2px dashed ${accentColor}; border-radius: 8px; text-align: center;">
                      <p style="margin: 0 0 5px 0; font-size: 10px; color: ${accentColor}; font-weight: bold; text-transform: uppercase;">
                        Code
                      </p>
                      <p style="margin: 0; font-family: 'Courier New', monospace; font-size: 28px; font-weight: bold; color: #1a1a1a; letter-spacing: 3px;">
                        ${couponCode}
                      </p>
                    </div>
                    
                    ${expiryDate ? `
                    <p style="margin: 15px 0 0 0; text-align: center; font-size: 13px; color: #374151; font-weight: 600;">
                      📅 Valid until ${expiryDate}
                    </p>
                    ` : ''}
                    
                    ${terms ? `
                    <div style="margin-top: 20px; padding-top: 15px; border-top: 1px dashed ${accentColor}40;">
                      <p style="margin: 0; font-size: 10px; color: #6b7280; line-height: 1.5; text-align: center;">
                        ${terms.replace(/\n/g, '<br>')}
                      </p>
                    </div>
                    ` : ''}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 12px; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #6b7280;">
                ${restaurantName} on Yummy ·
                <a href="{{unsubscribe_url}}" style="color: #6b7280; text-decoration: underline;">Unsubscribe</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// Bold Layout - Full-width gradient with centered content
function renderBoldEmailLayout(
  options: EmailPosterOptions,
  colors: { primary: string; secondary: string },
  accentColor: string,
  offerSummary: string,
  expiryDate: string,
  bgGradient: string
): string {
  const { restaurantName, logoUrl, headline = "", couponCode = "ABC123", terms = "" } = options;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${restaurantName} - Special Offer</title>
  ${GOOGLE_FONTS_LINK}
  ${RESPONSIVE_STYLE}
</head>
<body style="margin: 0; padding: 0; font-family: ${BODY_FONT}; background: ${bgGradient};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: ${bgGradient}; padding: 8px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" class="yg-container" cellspacing="0" cellpadding="0" style="width: 600px; max-width: 600px; padding: 16px;">
          <!-- Logo Header -->
          <tr>
            <td style="text-align: center; padding-bottom: 16px;">
              ${logoUrl ? `<img src="${logoUrl}" alt="${restaurantName}" style="width: 90px; height: 90px; border-radius: 16px; margin-bottom: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.2);" />` : ''}
              <h2 class="yg-h1" style="margin: 0; font-family: ${HEADLINE_FONT}; font-size: 30px; color: #ffffff; font-weight: 700; text-shadow: 0 2px 8px rgba(0,0,0,0.3);">
                ${restaurantName}
              </h2>
              ${headline ? `
              <p style="margin: 10px 0 0 0; font-family: ${HEADLINE_FONT}; font-size: 18px; color: rgba(255,255,255,0.9); font-weight: 600; text-shadow: 0 2px 8px rgba(0,0,0,0.3);">
                ${headline}
              </p>
              ` : ''}
            </td>
          </tr>

          <!-- Main Offer Card -->
          <tr>
            <td class="yg-pad" style="background-color: rgba(255,255,255,0.95); border-radius: 16px; padding: 24px; box-shadow: 0 8px 24px rgba(0,0,0,0.2);">
              <h1 class="yg-h2" style="margin: 0 0 25px 0; font-family: ${HEADLINE_FONT}; font-size: 44px; color: ${accentColor}; font-weight: 700; line-height: 1.1; text-align: center;">
                ${offerSummary}
              </h1>
              
              <div style="margin: 30px 0; padding: 25px; background: linear-gradient(135deg, ${accentColor}15 0%, ${accentColor}25 100%); border: 3px dashed ${accentColor}; border-radius: 12px; text-align: center;">
                <p style="margin: 0 0 8px 0; font-size: 13px; color: ${accentColor}; font-weight: bold; text-transform: uppercase; letter-spacing: 1.5px;">
                  Use Code
                </p>
                <p style="margin: 0; font-family: 'Courier New', monospace; font-size: 44px; font-weight: bold; color: #1a1a1a; letter-spacing: 5px;">
                  ${couponCode}
                </p>
              </div>
              
              ${expiryDate ? `
              <p style="margin: 20px 0 0 0; text-align: center; font-size: 16px; color: #4a4a4a; font-weight: 600;">
                ⏰ Valid until ${expiryDate}
              </p>
              ` : ''}
              
              ${terms ? `
              <div style="margin-top: 25px; padding: 20px; background-color: #f9fafb; border-left: 4px solid ${accentColor}; border-radius: 8px;">
                <p style="margin: 0 0 8px 0; font-size: 12px; color: #1a1a1a; font-weight: bold; text-transform: uppercase;">
                  Terms & Conditions
                </p>
                <p style="margin: 0; font-size: 13px; color: #6b7280; line-height: 1.6;">
                  ${terms.replace(/\n/g, '<br>')}
                </p>
              </div>
              ` : ''}
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding-top: 16px; text-align: center;">
              <p style="margin: 0; font-size: 13px; color: #ffffff; text-shadow: 0 1px 3px rgba(0,0,0,0.3);">
                ${restaurantName} on Yummy ·
                <a href="{{unsubscribe_url}}" style="color: #ffffff; text-decoration: underline;">Unsubscribe</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// Elegant Layout - Sophisticated design with subtle colors
function renderElegantEmailLayout(
  options: EmailPosterOptions,
  colors: { primary: string; secondary: string },
  accentColor: string,
  offerSummary: string,
  expiryDate: string
): string {
  const { restaurantName, logoUrl, headline = "", couponCode = "ABC123", terms = "" } = options;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${restaurantName} - Special Offer</title>
  ${GOOGLE_FONTS_LINK}
  ${RESPONSIVE_STYLE}
</head>
<body style="margin: 0; padding: 0; font-family: ${HEADLINE_FONT}; background-color: #f8f9fa;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8f9fa; padding: 8px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" class="yg-container" cellspacing="0" cellpadding="0" style="width: 600px; max-width: 600px; background-color: #ffffff; border: 2px solid ${accentColor}20; border-radius: 8px; overflow: hidden;">
          <!-- Elegant Header -->
          <tr>
            <td class="yg-pad" style="background: linear-gradient(180deg, ${accentColor}08 0%, #ffffff 100%); padding: 24px 24px 18px 24px; text-align: center; border-bottom: 1px solid ${accentColor}20;">
              ${logoUrl ? `<img src="${logoUrl}" alt="${restaurantName}" style="width: 70px; height: 70px; border-radius: 50%; margin-bottom: 20px; border: 3px solid ${accentColor}30;" />` : ''}
              <h3 style="margin: 0 0 10px 0; font-family: ${HEADLINE_FONT}; font-size: 26px; color: #1a1a1a; font-weight: 600; letter-spacing: 1px;">
                ${restaurantName}
              </h3>
              <div style="width: 80px; height: 2px; background-color: ${accentColor}; margin: 15px auto;"></div>
              <p style="margin: 0; font-family: ${BODY_FONT}; font-size: 14px; color: #6b7280; font-style: italic; letter-spacing: 1px;">
                ${headline || "An Exclusive Offer"}
              </p>
            </td>
          </tr>

          <!-- Offer Section -->
          <tr>
            <td class="yg-pad" style="padding: 24px;">
              <h1 class="yg-h2" style="margin: 0 0 30px 0; font-family: ${HEADLINE_FONT}; font-size: 38px; color: ${accentColor}; font-weight: 700; line-height: 1.2; text-align: center; letter-spacing: 0.5px;">
                ${offerSummary}
              </h1>

              <!-- Elegant Coupon -->
              <div style="margin: 30px 0; padding: 30px; background-color: #ffffff; border: 2px solid ${accentColor}; border-radius: 8px; text-align: center; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
                <p style="margin: 0 0 12px 0; font-size: 12px; color: ${accentColor}; font-weight: normal; text-transform: uppercase; letter-spacing: 2px; font-family: ${BODY_FONT};">
                  Promo Code
                </p>
                <p style="margin: 0; font-family: 'Courier New', monospace; font-size: 38px; font-weight: bold; color: #1a1a1a; letter-spacing: 6px;">
                  ${couponCode}
                </p>
              </div>
              
              ${expiryDate ? `
              <p style="margin: 25px 0 0 0; text-align: center; font-size: 14px; color: #6b7280; font-family: ${BODY_FONT};">
                Valid through ${expiryDate}
              </p>
              ` : ''}
              
              ${terms ? `
              <div style="margin-top: 30px; padding: 25px; background-color: ${accentColor}05; border-radius: 6px;">
                <p style="margin: 0; font-size: 12px; color: #4b5563; line-height: 1.7; text-align: center; font-family: ${BODY_FONT};">
                  ${terms.replace(/\n/g, '<br>')}
                </p>
              </div>
              ` : ''}
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: ${accentColor}05; padding: 14px; text-align: center; border-top: 1px solid ${accentColor}20;">
              <p style="margin: 0; font-size: 12px; color: #6b7280; font-family: ${BODY_FONT};">
                ${restaurantName} · Powered by Yummy<br/>
                <a href="{{unsubscribe_url}}" style="color: #6b7280; text-decoration: underline;">Unsubscribe</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// Geometric Layout - Sharp angles, modern geometric shapes
function renderGeometricEmailLayout(
  options: EmailPosterOptions,
  colors: { primary: string; secondary: string },
  accentColor: string,
  offerSummary: string,
  expiryDate: string
): string {
  const { restaurantName, logoUrl, headline = "", couponCode = "ABC123", terms = "" } = options;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${restaurantName} - Special Offer</title>
  ${GOOGLE_FONTS_LINK}
  ${RESPONSIVE_STYLE}
</head>
<body style="margin: 0; padding: 0; font-family: ${BODY_FONT}; background-color: #fafafa;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #fafafa; padding: 8px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" class="yg-container" cellspacing="0" cellpadding="0" style="width: 600px; max-width: 600px; background-color: #ffffff; overflow: hidden;">
          <!-- Geometric Header with Angular Design -->
          <tr>
            <td style="position: relative; background: ${accentColor}; padding: 0; height: 120px;">
              <!-- Diagonal split effect -->
              <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: linear-gradient(135deg, ${accentColor} 0%, ${accentColor}dd 50%, ${colors.secondary} 100%); clip-path: polygon(0 0, 100% 0, 100% 70%, 0 100%);"></div>
              <table width="100%" cellspacing="0" cellpadding="0" style="position: relative; z-index: 1;">
                <tr>
                  <td style="padding: 18px 24px;">
                    <table width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td width="60%">
                          ${logoUrl ? `<img src="${logoUrl}" alt="${restaurantName}" style="width: 50px; height: 50px; clip-path: polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%); margin-bottom: 10px;" />` : ''}
                          <h3 style="margin: 0; font-family: ${HEADLINE_FONT}; font-size: 24px; color: #ffffff; font-weight: 700; letter-spacing: 1px;">
                            ${restaurantName}
                          </h3>
                        </td>
                        <td width="40%" align="right">
                          <div style="width: 60px; height: 60px; background-color: rgba(255,255,255,0.2); transform: rotate(45deg); border: 2px solid rgba(255,255,255,0.3);"></div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content with Sharp Boxes -->
          <tr>
            <td class="yg-pad" style="padding: 24px;">
              ${headline ? `
              <p style="margin: 0 0 20px 0; font-family: ${HEADLINE_FONT}; font-size: 22px; color: #1a1a1a; font-weight: 700; line-height: 1.3;">
                ${headline}
              </p>
              ` : ''}

              <!-- Offer Box with Angular Cut -->
              <div style="position: relative; padding: 35px 30px; background: linear-gradient(135deg, ${accentColor}10 0%, ${accentColor}05 100%); clip-path: polygon(0 8%, 100% 0, 100% 92%, 0% 100%); margin-bottom: 30px;">
                <p style="margin: 0 0 10px 0; font-size: 12px; color: ${accentColor}; font-weight: bold; text-transform: uppercase; letter-spacing: 2px;">
                  LIMITED OFFER
                </p>
                <h1 class="yg-h2" style="margin: 0; font-family: ${HEADLINE_FONT}; font-size: 40px; color: #1a1a1a; font-weight: 700; line-height: 1.1; letter-spacing: -0.5px;">
                  ${offerSummary}
                </h1>
              </div>
              
              <!-- Coupon Box with Hexagonal Border -->
              <div style="margin: 30px 0; padding: 30px; background-color: #ffffff; border: 4px solid ${accentColor}; clip-path: polygon(10% 0%, 90% 0%, 100% 25%, 100% 75%, 90% 100%, 10% 100%, 0% 75%, 0% 25%); text-align: center;">
                <p style="margin: 0 0 10px 0; font-size: 11px; color: ${accentColor}; font-weight: bold; text-transform: uppercase; letter-spacing: 2px;">
                  CODE
                </p>
                <p style="margin: 0; font-family: 'Courier New', monospace; font-size: 36px; font-weight: bold; color: #1a1a1a; letter-spacing: 5px;">
                  ${couponCode}
                </p>
              </div>
              
              ${expiryDate ? `
              <div style="text-align: center; margin: 20px 0;">
                <div style="display: inline-block; padding: 10px 20px; background-color: ${accentColor}15; clip-path: polygon(5% 0%, 95% 0%, 100% 50%, 95% 100%, 5% 100%, 0% 50%);">
                  <p style="margin: 0; font-size: 13px; color: #1a1a1a; font-weight: 600;">
                    ⏱️ Expires ${expiryDate}
                  </p>
                </div>
              </div>
              ` : ''}
              
              ${terms ? `
              <div style="margin-top: 30px; padding: 20px; background-color: #f5f5f5; clip-path: polygon(0 0, 100% 0, 100% calc(100% - 15px), calc(100% - 15px) 100%, 0 100%);">
                <p style="margin: 0 0 8px 0; font-size: 11px; color: #1a1a1a; font-weight: bold; text-transform: uppercase;">
                  Terms
                </p>
                <p style="margin: 0; font-size: 11px; color: #666666; line-height: 1.6;">
                  ${terms.replace(/\n/g, '<br>')}
                </p>
              </div>
              ` : ''}
            </td>
          </tr>
          
          <!-- Geometric Footer -->
          <tr>
            <td style="background: linear-gradient(90deg, ${accentColor}08 0%, ${accentColor}15 100%); padding: 14px; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #666666;">
                ${restaurantName} · Yummy ·
                <a href="{{unsubscribe_url}}" style="color: ${accentColor}; text-decoration: none; font-weight: bold;">Unsubscribe</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// Premium Layout - dark charcoal, gold-foil, certificate-style
function renderPremiumEmailLayout(
  options: EmailPosterOptions,
  colors: { primary: string; secondary: string },
  accentColor: string,
  offerSummary: string,
  expiryDate: string
): string {
  const { restaurantName, logoUrl, headline = "", couponCode = "ABC123", terms = "" } = options;
  const goldLight = colors.secondary;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${restaurantName} - Exclusive Offer</title>
  ${GOOGLE_FONTS_LINK}
  ${RESPONSIVE_STYLE}
</head>
<body style="margin: 0; padding: 0; font-family: ${BODY_FONT}; background-color: #0a0a0b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0a0a0b; padding: 8px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" class="yg-container yg-pad" cellspacing="0" cellpadding="0" style="width: 600px; max-width: 600px; background: radial-gradient(120% 100% at 85% 0%, #232019 0%, #131211 45%, #0a0a0b 100%); border: 1px solid ${accentColor}40; border-radius: 12px; padding: 22px 20px;">
          <!-- Header -->
          <tr>
            <td style="padding-top: 8px; padding-bottom: 18px;">
              <table width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    ${logoUrl ? `<img src="${logoUrl}" alt="${restaurantName}" style="width: 52px; height: 52px; border-radius: 50%; border: 1.5px solid ${accentColor}; margin-bottom: 14px;" />` : ''}
                    <h3 style="margin: 0; font-family: ${HEADLINE_FONT}; font-size: 16px; color: #f5f0e6; font-weight: 600; text-transform: uppercase; letter-spacing: 2px;">${restaurantName}</h3>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          ${headline ? `
          <tr>
            <td style="padding-bottom: 20px; text-align: center;">
              <p style="margin: 0; font-family: ${HEADLINE_FONT}; font-size: 20px; color: #f5f0e6; font-weight: 700; line-height: 1.3;">
                ${headline}
              </p>
            </td>
          </tr>
          ` : ''}

          <!-- Crown + Offer headline -->
          <tr>
            <td style="text-align: center; padding-bottom: 28px;">
              <div style="display: inline-block; width: 56px; height: 56px; border: 1px solid ${accentColor}80; border-radius: 50%; line-height: 56px; margin-bottom: 18px;">
                <span style="font-size: 24px; color: ${accentColor};">&#9813;</span>
              </div>
              <p style="margin: 0 0 10px 0; font-size: 10px; color: ${accentColor}cc; font-weight: bold; text-transform: uppercase; letter-spacing: 3px;">
                Your Reward
              </p>
              <h1 class="yg-h2" style="margin: 0; font-family: ${HEADLINE_FONT}; font-size: 36px; font-weight: 700; line-height: 1.15; background: linear-gradient(135deg, ${goldLight} 0%, ${accentColor} 60%, ${goldLight} 100%); -webkit-background-clip: text; background-clip: text; color: ${accentColor};">
                ${offerSummary}
              </h1>
            </td>
          </tr>

          <!-- Coupon Code -->
          <tr>
            <td style="padding: 26px; background: rgba(255,255,255,0.04); border: 1px solid ${accentColor}55; border-radius: 12px; text-align: center;">
              <p style="margin: 0 0 10px 0; font-size: 10px; color: ${accentColor}cc; font-weight: bold; text-transform: uppercase; letter-spacing: 2px;">
                Use Code
              </p>
              <p style="margin: 0; font-family: 'Courier New', monospace; font-size: 34px; font-weight: bold; color: #faf7ef; letter-spacing: 4px;">
                ${couponCode}
              </p>
              ${expiryDate ? `
              <p style="margin: 16px 0 0 0; font-size: 12px; color: #e8dfc8; font-weight: 600;">
                Valid until ${expiryDate}
              </p>
              ` : ''}
            </td>
          </tr>

          <!-- Terms -->
          ${terms ? `
          <tr>
            <td style="padding-top: 22px;">
              <p style="margin: 0; font-size: 11px; color: #b8b0a0; line-height: 1.6; text-align: center;">
                ${terms.replace(/\n/g, '<br>')}
              </p>
            </td>
          </tr>
          ` : ''}

          <!-- Footer -->
          <tr>
            <td style="padding-top: 16px; padding-bottom: 8px; text-align: center; border-top: 1px solid ${accentColor}25; margin-top: 26px;">
              <p style="margin: 14px 0 0 0; font-size: 11px; color: #7a7468;">
                ${restaurantName} on Yummy ·
                <a href="{{unsubscribe_url}}" style="color: ${accentColor}; text-decoration: underline;">Unsubscribe</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// Grid Layout - Blueprint/graph-paper look: thin grid lines cover the main
// panel as a backdrop texture (repeating-linear-gradient), with content
// floating directly on top rather than boxed into cells. Mirrors the poster
// GridTemplate.tsx visual identity. Clients that ignore background-image
// (older Outlook desktop) just fall back to the solid bgGradient color set
// alongside it — same tradeoff every gradient-background layout in this file
// already makes.
function renderGridEmailLayout(
  options: EmailPosterOptions,
  colors: { primary: string; secondary: string },
  accentColor: string,
  offerSummary: string,
  expiryDate: string,
  bgGradient: string
): string {
  const { restaurantName, logoUrl, headline = "", couponCode = "ABC123", terms = "" } = options;
  const gridLines =
    "repeating-linear-gradient(0deg, rgba(255,255,255,0.32) 0px, rgba(255,255,255,0.32) 1px, transparent 1px, transparent 40px)," +
    "repeating-linear-gradient(90deg, rgba(255,255,255,0.32) 0px, rgba(255,255,255,0.32) 1px, transparent 1px, transparent 40px)";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${restaurantName} - Special Offer</title>
  ${GOOGLE_FONTS_LINK}
  ${RESPONSIVE_STYLE}
</head>
<body style="margin: 0; padding: 0; font-family: ${BODY_FONT}; background: ${bgGradient};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: ${bgGradient}; padding: 8px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" class="yg-container yg-pad" cellspacing="0" cellpadding="0" style="width: 600px; max-width: 600px; background: ${bgGradient}; background-image: ${gridLines}; padding: 20px 18px;">
          <!-- Header -->
          <tr>
            <td style="padding-bottom: 16px;">
              <table width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td width="70%" style="vertical-align: middle;">
                    <table cellspacing="0" cellpadding="0"><tr>
                      ${logoUrl ? `<td style="padding-right: 10px;"><img src="${logoUrl}" alt="${restaurantName}" style="width: 44px; height: 44px; border-radius: 12px; object-fit: cover; display: block;" /></td>` : ''}
                      <td>
                        <span style="color: #ffffff; font-weight: 700; font-size: 18px;">${restaurantName}</span>
                      </td>
                    </tr></table>
                  </td>
                  <td width="30%" align="right" style="vertical-align: middle;">
                    <span style="display: inline-block; padding: 6px 14px; background-color: rgba(255,255,255,0.2); border-radius: 20px; color: #ffffff; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; font-size: 10px;">Special</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Headline — floats directly on the grid, no card -->
          <tr>
            <td style="padding-bottom: 24px;">
              <p class="yg-h1" style="margin: 0; font-family: ${HEADLINE_FONT}; font-size: 30px; font-weight: 700; color: #ffffff; line-height: 1.2; text-shadow: 0 2px 8px rgba(0,0,0,0.25);">
                ${headline || "A special offer, just for you"}
              </p>
            </td>
          </tr>

          <!-- Offer amount — also floats on the grid -->
          <tr>
            <td style="padding-bottom: 20px;">
              <p style="margin: 0 0 6px 0; font-size: 11px; color: rgba(255,255,255,0.75); font-weight: bold; text-transform: uppercase; letter-spacing: 1.5px;">
                Your Reward
              </p>
              <p class="yg-h2" style="margin: 0 0 10px 0; font-family: ${HEADLINE_FONT}; font-size: 34px; font-weight: 700; color: #ffffff; line-height: 1.1; text-shadow: 0 2px 8px rgba(0,0,0,0.25);">
                ${offerSummary}
              </p>
              ${expiryDate ? `
              <p style="margin: 0; font-size: 12px; color: rgba(255,255,255,0.85); font-weight: 600;">
                Valid until ${expiryDate}
              </p>
              ` : ''}
            </td>
          </tr>

          <!-- Coupon code -->
          <tr>
            <td style="padding-bottom: ${terms ? "20" : "4"}px;">
              <div style="display: inline-block; padding: 16px 24px; border: 2px dashed rgba(255,255,255,0.6); border-radius: 12px; background: rgba(255,255,255,0.08);">
                <p style="margin: 0 0 4px 0; font-size: 10px; color: rgba(255,255,255,0.8); font-weight: bold; text-transform: uppercase; letter-spacing: 1.5px;">
                  Use Code
                </p>
                <p style="margin: 0; font-family: 'Courier New', monospace; font-size: 26px; font-weight: bold; color: #ffffff; letter-spacing: 3px;">
                  ${couponCode}
                </p>
              </div>
            </td>
          </tr>

          ${terms ? `
          <!-- Terms — a thin grid-native rule, not a card -->
          <tr>
            <td style="padding-top: 4px; border-top: 1px solid rgba(255,255,255,0.32);">
              <p style="margin: 14px 0 0 0; font-size: 11px; color: rgba(255,255,255,0.8); line-height: 1.5;">
                ${terms.replace(/\n/g, '<br>')}
              </p>
            </td>
          </tr>
          ` : ''}

          <!-- Footer -->
          <tr>
            <td style="padding-top: 16px; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: rgba(255,255,255,0.75);">
                ${restaurantName} on Yummy ·
                <a href="{{unsubscribe_url}}" style="color: #ffffff; text-decoration: underline;">Unsubscribe</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
