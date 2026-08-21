"use client";

/**
 * Email Preview Component
 * Shows how an email will render for recipients with subject and HTML body
 * Matches the backend template structure exactly
 */

import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Mail, Info, ImageIcon, Search, ChevronDown, Send, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";
import { renderPosterStyleEmailHtml, HEADLINE_FONT, BODY_FONT, GOOGLE_FONTS_LINK, RESPONSIVE_STYLE } from "@/lib/growth/email-poster-html";
import {
  EMAIL_TEMPLATE_DEFINITIONS,
  EMAIL_TEMPLATE_CATEGORIES,
  getEmailTemplateDefinition,
  type CampaignEmailTemplate,
  type EmailTemplateDefinition,
} from "@/lib/growth/email-templates";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { growthApi } from "@/lib/api/growth";
import { toast } from "sonner";

/** A miniature mock-email swatch that communicates a template's palette, type, and structure at a glance. */
function TemplateSwatch({ definition, size, full }: { definition: EmailTemplateDefinition; size: number; full?: boolean }) {
  const fontFamily =
    definition.swatch.font === "serif"
      ? "'Playfair Display', Georgia, serif"
      : definition.swatch.font === "mono"
        ? "'Courier New', monospace"
        : definition.swatch.font === "display"
          ? "'Bebas Neue', Georgia, sans-serif"
          : "var(--font-inter), sans-serif";

  const outerStyle = {
    height: size,
    width: full ? "100%" : size,
    background: definition.swatch.bg,
    border: `1px solid ${definition.swatch.accent}33`,
  };
  const outerClassName = cn("relative flex flex-shrink-0 overflow-hidden rounded-lg", full && "w-full");

  // These two styles are about depth/overlap and image mosaics respectively —
  // the shared "Aa" glyph swatch reads identically for every template and
  // doesn't hint at either, so they get a small representative mock instead.
  if (definition.id === "dimensional") {
    return (
      <span className={outerClassName} style={outerStyle}>
        <span className="relative flex flex-1 items-center justify-center">
          <span
            className="absolute rounded-md"
            style={{
              width: "56%",
              height: "56%",
              top: "20%",
              left: "16%",
              background: definition.swatch.text,
              opacity: 0.16,
              boxShadow: "0 6px 10px -4px rgba(0,0,0,0.55)",
            }}
          />
          <span
            className="absolute rounded-md"
            style={{
              width: "38%",
              height: "34%",
              bottom: "16%",
              right: "14%",
              background: definition.swatch.accent,
              boxShadow: "0 6px 12px -4px rgba(0,0,0,0.5)",
            }}
          />
        </span>
      </span>
    );
  }

  if (definition.id === "collage") {
    return (
      <span className={cn(outerClassName, "gap-[3px] p-[3px]")} style={outerStyle}>
        <span
          className="flex-1 rounded-md"
          style={{ background: definition.swatch.accent, opacity: 0.85, transform: "rotate(-2deg)" }}
        />
        <span className="flex flex-1 flex-col gap-[3px]">
          <span
            className="flex-1 rounded-md"
            style={{ background: definition.swatch.text, opacity: 0.28, transform: "rotate(2deg)" }}
          />
          <span className="flex-1 rounded-md" style={{ background: definition.swatch.accent, opacity: 0.55 }} />
        </span>
      </span>
    );
  }

  return (
    <span className={cn(outerClassName, "flex-col")} style={outerStyle}>
      <span className="block h-[3px] w-full flex-shrink-0" style={{ background: definition.swatch.accent }} />
      <span className="flex flex-1 flex-col items-center justify-center gap-1.5">
        <span
          style={{
            fontFamily,
            color: definition.swatch.accent,
            fontSize: Math.round(size * 0.34),
            lineHeight: 1,
            fontWeight: 700,
          }}
        >
          Aa
        </span>
        <span className="flex items-center gap-[3px]">
          <span className="block h-[3px] w-6 rounded-full" style={{ background: definition.swatch.text, opacity: 0.22 }} />
          <span className="block h-[3px] w-3 rounded-full" style={{ background: definition.swatch.accent, opacity: 0.55 }} />
        </span>
      </span>
    </span>
  );
}

export interface EmailPreviewProps {
  subject?: string;
  bodyHtml?: string;
  showWarning?: boolean;
  posterDataUrl?: string;  // Optional poster image to show as attachment
  restaurantName?: string;  // Restaurant name for template
  restaurantAddress?: string;  // Restaurant address for template footer
  couponCode?: string;  // Coupon code for template
  logoUrl?: string;  // Restaurant logo URL
  usePosterTemplate?: boolean;  // Use poster-style HTML template
  template?: CampaignEmailTemplate;  // Email template design
  primaryColor?: string;  // Primary brand color
  offer?: {
    discountType: "percentage" | "flat_amount";
    value: number;
    percentageCap?: number | null;
    minimumOrderValue?: number | null;
    validUntil?: string | null;
  };
  terms?: string;
  heroImageUrl?: string;  // Optional real food/menu photo for templates with a hero
  contactText?: string;  // From the restaurant's brand profile
  footerText?: string;  // From the restaurant's brand profile
  isReadOnly?: boolean;  // Read-only mode
  onUsePosterTemplateChange?: (checked: boolean) => void;  // Callback for checkbox
  onTemplateChange?: (template: CampaignEmailTemplate) => void;  // Callback for template picker
}

export function EmailPreview({
  subject,
  bodyHtml,
  showWarning = true,
  posterDataUrl,
  restaurantName = "Your Restaurant",
  restaurantAddress,
  couponCode = "ABC123",
  logoUrl,
  usePosterTemplate = false,
  template = "modern",
  primaryColor,
  offer,
  terms,
  heroImageUrl,
  contactText,
  footerText,
  isReadOnly = false,
  onUsePosterTemplateChange,
  onTemplateChange,
}: EmailPreviewProps) {
  const { theme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  const [browserOpen, setBrowserOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [activeCategory, setActiveCategory] = React.useState<string>("All");
  const [testEmail, setTestEmail] = React.useState("");
  const [sendingTest, setSendingTest] = React.useState(false);

  // useEffect only runs on the client, so now we can safely show the UI
  React.useEffect(() => {
    setMounted(true);
  }, []);

  const currentDefinition = getEmailTemplateDefinition(template);

  const filteredTemplates = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return EMAIL_TEMPLATE_DEFINITIONS.filter((def) => {
      const matchesCategory = activeCategory === "All" || def.category === activeCategory;
      const matchesSearch =
        !q || def.label.toLowerCase().includes(q) || def.tagline.toLowerCase().includes(q) || def.description.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [search, activeCategory]);

  // Grouped by category so the browser reads as curated sections rather than one long grid,
  // except while actively filtered to a single category (the chip already says which one).
  const groupedTemplates = React.useMemo(() => {
    if (activeCategory !== "All") {
      return [{ category: activeCategory, items: filteredTemplates }];
    }
    const byCategory = new Map<string, EmailTemplateDefinition[]>();
    for (const def of filteredTemplates) {
      const list = byCategory.get(def.category) ?? [];
      list.push(def);
      byCategory.set(def.category, list);
    }
    return EMAIL_TEMPLATE_CATEGORIES.map((category) => ({ category, items: byCategory.get(category) ?? [] })).filter(
      (group) => group.items.length > 0,
    );
  }, [filteredTemplates, activeCategory]);

  const isDarkMode = mounted && theme === "dark";

  // Generate complete HTML email template matching backend structure
  const completeEmailHtml = React.useMemo(() => {
    // If poster template is enabled and offer data is available, render poster HTML
    if (usePosterTemplate && offer && template) {
      return renderPosterStyleEmailHtml({
        template,
        restaurantName,
        restaurantAddress,
        logoUrl,
        primaryColor,
        // Matches the real send: growth_campaign_delivery_service.py passes
        // the campaign's resolved email subject as `headline`.
        headline: subject || undefined,
        // The free-text "Email body (HTML)" field doubles as this
        // template's secondary description copy when a poster template is
        // active — previously it was silently dropped in that mode.
        description: bodyHtml || undefined,
        discountType: offer.discountType,
        value: offer.value,
        percentageCap: offer.percentageCap,
        minimumOrderValue: offer.minimumOrderValue,
        validUntil: offer.validUntil,
        couponCode,
        terms: terms || undefined,
        heroImageUrl: heroImageUrl || undefined,
        contactText: contactText || undefined,
        footerText: footerText || undefined,
      });
    }

    // Otherwise, use regular body HTML
    if (!bodyHtml) return null;

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${GOOGLE_FONTS_LINK}
  ${RESPONSIVE_STYLE}
</head>
<body style="margin: 0; padding: 0; background-color: #f6f7fb; font-family: ${BODY_FONT};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding: 8px; background: #f6f7fb;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 560px; overflow: hidden; border: 1px solid #e7eaf0; border-radius: 20px; background: #ffffff;">
          <!-- Header Section -->
          <tr>
            <td class="yg-pad" style="padding: 16px 16px 12px; background: #fff7ed;">
              <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                ${logoUrl ? `<img src="${logoUrl}" alt="${restaurantName}" style="width: 40px; height: 40px; border-radius: 8px; object-fit: cover;" />` : ''}
                <div style="font-size: 13px; font-weight: 700; letter-spacing: 0.14em; color: #f97316; text-transform: uppercase;">YUMMY</div>
              </div>
              <h1 class="yg-h1" style="margin: 0; font-family: ${HEADLINE_FONT}; font-size: 26px; font-weight: 700; line-height: 1.3; color: #172033;">${subject || 'A special offer for you'}</h1>
            </td>
          </tr>

          <!-- Body Section -->
          <tr>
            <td class="yg-pad" style="padding: 16px;">
              <p style="margin: 0 0 14px; font-size: 16px; line-height: 1.6; color: #172033;">Hi {{customer_name}},</p>
              
              <div style="margin: 0 0 22px; font-size: 15px; line-height: 1.65; color: #4b5565;">
                ${bodyHtml}
              </div>

              <!-- Coupon Code Section -->
              <p style="margin: 0 0 8px; font-size: 13px; font-weight: 700; letter-spacing: 0.08em; color: #9a3412; text-transform: uppercase;">Your coupon code</p>
              <div style="padding: 18px 16px; border: 2px dashed #f97316; border-radius: 14px; background: #fff7ed; text-align: center;">
                <span style="font-family: Consolas, monospace; font-size: 30px; font-weight: 700; letter-spacing: 0.18em; color: #172033;">${couponCode}</span>
              </div>

              <p style="margin: 14px 0 0; font-size: 12px; line-height: 1.55; color: #87909f;">
                A printable coupon card is attached to this email.
              </p>

              <p style="margin: 22px 0 0; font-size: 12px; line-height: 1.55; color: #87909f;">
                You're receiving this because you opted in to offers from ${restaurantName} on Yummy. <a href="#" style="color: #87909f; text-decoration: underline;">Unsubscribe</a>.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();
  }, [usePosterTemplate, template, offer, terms, primaryColor, bodyHtml, restaurantName, couponCode, subject, logoUrl, heroImageUrl, contactText, footerText]);

  // Debug logging
  React.useEffect(() => {
    if (mounted) {
      console.log("=== EmailPreview Debug ===");
      console.log("Theme:", theme);
      console.log("posterDataUrl:", posterDataUrl ? "Present" : "NULL");
      console.log("completeEmailHtml:", completeEmailHtml ? "Present" : "NULL");
    }
  }, [mounted, theme, posterDataUrl, completeEmailHtml]);

  const handleSendTestEmail = async () => {
    if (!testEmail.trim()) {
      toast.error("Please enter a recipient email address");
      return;
    }

    if (!usePosterTemplate || !offer || !template) {
      toast.error("Test emails can only be sent with poster templates and offer data");
      return;
    }

    setSendingTest(true);
    try {
      await growthApi.sendTestEmail({
        template,
        recipient_email: testEmail.trim(),
        restaurant_name: restaurantName,
        ...(restaurantAddress && { restaurant_address: restaurantAddress }),
        headline: subject,
        description: bodyHtml,
        discount_type: offer.discountType,
        value: offer.value,
        percentage_cap: offer.percentageCap,
        minimum_order_value: offer.minimumOrderValue,
        valid_until: offer.validUntil,
        coupon_code: couponCode,
        terms,
        logo_url: logoUrl || undefined,
        primary_color: primaryColor || undefined,
      });
      toast.success(`Test email sent to ${testEmail}`);
      setTestEmail("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to send test email";
      toast.error(message);
    } finally {
      setSendingTest(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Email preview</CardTitle>
          </div>

          {onUsePosterTemplateChange && onTemplateChange && (
            <div className="flex items-center gap-2">
              <Checkbox
                id="email-preview-poster"
                checked={usePosterTemplate}
                disabled={isReadOnly}
                onCheckedChange={(checked) => onUsePosterTemplateChange(checked as boolean)}
              />
              <Label htmlFor="email-preview-poster" className="cursor-pointer text-sm font-medium whitespace-nowrap">
                Use template
              </Label>
            </div>
          )}
        </div>

        {usePosterTemplate && onTemplateChange && (
          <button
            type="button"
            disabled={isReadOnly}
            onClick={() => setBrowserOpen(true)}
            className={cn(
              "mt-4 flex w-full items-center gap-3 rounded-lg border p-2 text-left transition-colors hover:border-primary/50",
              isReadOnly && "cursor-not-allowed opacity-60"
            )}
          >
            <TemplateSwatch definition={currentDefinition} size={40} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold leading-tight">{currentDefinition.label}</p>
              <p className="truncate text-xs text-muted-foreground">{currentDefinition.tagline} · {currentDefinition.category}</p>
            </div>
            <ChevronDown className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
          </button>
        )}
      </CardHeader>

      {onTemplateChange && (
        <Dialog open={browserOpen} onOpenChange={setBrowserOpen}>
          <DialogContent className="flex max-h-[85vh] max-w-4xl flex-col overflow-hidden">
            <DialogHeader>
              <DialogTitle>Choose an email design</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-3 border-b pb-4">
              <div className="relative w-full">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search styles..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-9 text-sm"
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {["All", ...EMAIL_TEMPLATE_CATEGORIES].map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setActiveCategory(cat)}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-[11px] font-medium whitespace-nowrap transition-colors",
                      activeCategory === cat ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/50"
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
            <div className="-mx-1 space-y-6 overflow-y-auto px-1 pt-1">
              {groupedTemplates.length === 0 ? (
                <div className="py-14 text-center text-sm text-muted-foreground">No styles match your search.</div>
              ) : (
                groupedTemplates.map((group) => (
                  <div key={group.category}>
                    {activeCategory === "All" && (
                      <div className="sticky top-0 z-10 mb-3 flex items-center gap-2.5 bg-background/95 py-1 backdrop-blur-sm">
                        <h3 className="whitespace-nowrap text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {group.category}
                        </h3>
                        <span className="text-[10px] text-muted-foreground/50">{group.items.length}</span>
                        <div className="h-px flex-1 bg-border" />
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                      {group.items.map((definition) => {
                        const selected = template === definition.id;
                        return (
                          <button
                            key={definition.id}
                            type="button"
                            onClick={() => {
                              onTemplateChange(definition.id);
                              setBrowserOpen(false);
                            }}
                            className={cn(
                              "group relative flex flex-col items-start gap-2.5 rounded-xl border bg-card p-3 text-left transition-all",
                              selected
                                ? "border-primary ring-2 ring-primary/25"
                                : "border-border hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
                            )}
                          >
                            {selected && (
                              <span className="absolute right-2 top-2 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
                                <Check className="h-3 w-3" strokeWidth={3} />
                              </span>
                            )}
                            <TemplateSwatch definition={definition} size={76} full />
                            <div className="min-w-0 w-full">
                              <p className="text-xs font-semibold leading-tight">{definition.label}</p>
                              <p className="truncate text-[10.5px] text-muted-foreground">{definition.tagline}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
      <CardContent className="space-y-4">
        {/* Email Preview - Renders Complete Backend Template HTML */}
        {/* Container adapts to theme, but email content stays light (realistic) */}
        <div className={cn(
          "transition-colors overflow-x-auto rounded-lg",
          isDarkMode
            ? "bg-gray-900/50 p-4"
            : "bg-gray-50 p-4"
        )}>
          {completeEmailHtml ? (
            // Render the complete HTML email exactly as backend generates it
            // Email content is always light (emails don't support dark mode in reality)
            // eslint-disable-next-line react/no-danger
            <div
              dangerouslySetInnerHTML={{ __html: completeEmailHtml }}
              className="email-preview-content mx-auto"
              style={{ 
                colorScheme: 'light',
                // Ensure email background stays light regardless of parent theme
                backgroundColor: '#f6f7fb',
                maxWidth: '600px'
              }}
            />
          ) : (
            <div className={cn(
              "flex items-center justify-center py-20 rounded-xl border mx-auto transition-colors",
              isDarkMode 
                ? "bg-[#1a1a1a] border-gray-700" 
                : "bg-white border-gray-200"
            )} style={{ maxWidth: "600px" }}>
              <div className="text-center px-6">
                <Mail className={cn(
                  "h-16 w-16 mx-auto mb-4 transition-colors",
                  isDarkMode ? "text-gray-600" : "text-gray-300"
                )} />
                <p className={cn(
                  "text-base font-medium mb-2 transition-colors",
                  isDarkMode ? "text-gray-400" : "text-gray-500"
                )}>
                  Nothing to preview yet.
                </p>
                <p className={cn(
                  "text-sm transition-colors",
                  isDarkMode ? "text-gray-500" : "text-gray-400"
                )}>
                  Compose your email to see the preview
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Poster Attachment Preview (if exists) - Shown below email */}
        {posterDataUrl && completeEmailHtml && (
          <div className={cn(
            "rounded-xl border p-5 transition-colors",
            isDarkMode 
              ? "border-gray-700 bg-gray-800" 
              : "border-gray-300 bg-white"
          )}>
            <div className="flex items-center gap-2 mb-4">
              <ImageIcon className={cn(
                "h-5 w-5 transition-colors",
                isDarkMode ? "text-gray-400" : "text-gray-600"
              )} />
              <p className={cn(
                "text-sm font-semibold transition-colors",
                isDarkMode ? "text-gray-300" : "text-gray-700"
              )}>
                Printable Coupon Card (PNG Attachment)
              </p>
            </div>
            <img
              src={posterDataUrl}
              alt="Printable coupon card attachment"
              className="w-full max-w-md mx-auto rounded-lg shadow-sm"
            />
          </div>
        )}

        {/* Send Test Email */}
        {completeEmailHtml && usePosterTemplate && !isReadOnly && (
          <div className={cn(
            "rounded-xl border p-4 transition-colors",
            isDarkMode 
              ? "border-gray-700 bg-gray-800/50" 
              : "border-gray-300 bg-gray-50"
          )}>
            <div className="flex items-start gap-4">
              <Send className={cn(
                "h-5 w-5 mt-0.5 transition-colors shrink-0",
                isDarkMode ? "text-gray-400" : "text-gray-600"
              )} />
              <div className="flex-1">
                <p className={cn(
                  "text-sm font-semibold transition-colors",
                  isDarkMode ? "text-gray-300" : "text-gray-700"
                )}>
                  Send Test Email
                </p>
                <p className={cn(
                  "text-xs transition-colors mt-1",
                  isDarkMode ? "text-gray-500" : "text-gray-500"
                )}>
                  Send this email with the selected template ({template}) to yourself for testing
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Input
                  type="email"
                  placeholder="your.email@example.com"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !sendingTest) {
                      void handleSendTestEmail();
                    }
                  }}
                  disabled={sendingTest}
                  className="w-64"
                />
                <Button
                  type="button"
                  onClick={handleSendTestEmail}
                  disabled={sendingTest || !testEmail.trim()}
                  size="sm"
                >
                  {sendingTest ? "Sending..." : "Send"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Warning/Info */}
        {showWarning && false && (
          <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
            <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <AlertDescription className="text-blue-800 dark:text-blue-200 text-xs">
              This preview shows the email exactly as generated by the backend template. Different email clients may display it slightly differently.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Enhanced Email Preview with Mobile/Desktop Toggle
 */
export function EmailPreviewEnhanced({
  subject,
  bodyHtml,
  showWarning = true,
  posterDataUrl,
}: EmailPreviewProps) {
  const [viewMode, setViewMode] = React.useState<"desktop" | "mobile">("desktop");

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Email preview</CardTitle>
          </div>
          <div className="flex items-center gap-2 rounded-lg border p-1">
            <button
              onClick={() => setViewMode("desktop")}
              className={cn(
                "px-3 py-1 text-xs rounded transition-colors",
                viewMode === "desktop"
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted"
              )}
            >
              Desktop
            </button>
            <button
              onClick={() => setViewMode("mobile")}
              className={cn(
                "px-3 py-1 text-xs rounded transition-colors",
                viewMode === "mobile"
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted"
              )}
            >
              Mobile
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Subject Preview */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Mail className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                SUBJECT
              </p>
              <p className="mt-1 font-bold text-foreground">
                {subject || "Untitled"}
              </p>
            </div>
          </div>
        </div>

        {/* Body Preview with Viewport */}
        <div className="flex justify-center">
          <div
            className={cn(
              "rounded-xl border border-border bg-white shadow-lg overflow-hidden transition-all",
              viewMode === "desktop" ? "w-full" : "w-[375px]"
            )}
          >
            {/* Email Client Chrome */}
            <div className="border-b border-gray-200 bg-gray-50 px-4 py-2 flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="h-3 w-3 rounded-full bg-red-400" />
                <div className="h-3 w-3 rounded-full bg-yellow-400" />
                <div className="h-3 w-3 rounded-full bg-green-400" />
              </div>
              <p className="text-xs text-gray-600 ml-2">
                {viewMode === "desktop" ? "Desktop" : "Mobile"} View
              </p>
            </div>

            {/* Email Body */}
            <div className="p-6 text-black min-h-[200px] max-h-[600px] overflow-y-auto">
              {bodyHtml ? (
                // eslint-disable-next-line react/no-danger
                <div
                  dangerouslySetInnerHTML={{ __html: bodyHtml }}
                  className="email-preview-content"
                />
              ) : (
                <div className="flex items-center justify-center h-full py-12">
                  <div className="text-center">
                    <Mail className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">
                      Nothing to preview yet.
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Compose your email to see the preview
                    </p>
                  </div>
                </div>
              )}

              {/* Poster Attachment Preview */}
              {posterDataUrl && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <div className="flex items-center gap-2 mb-3">
                    <ImageIcon className="h-4 w-4 text-gray-600" />
                    <p className="text-sm font-semibold text-gray-700">
                      Attached Poster
                    </p>
                  </div>
                  <div className="rounded-lg border border-gray-300 bg-gray-50 p-4">
                    <img
                      src={posterDataUrl}
                      alt="Campaign poster attachment"
                      className="w-full max-w-md mx-auto rounded-lg shadow-md"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Warning/Info */}
        {showWarning && (
          <Alert className="border-blue-200 bg-blue-50">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800 text-xs">
              This is a raw HTML preview, not a rendered-client simulation.
              Different email clients may render it differently.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
