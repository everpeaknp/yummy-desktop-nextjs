"use client";

/**
 * Email Preview Component
 * Shows how an email will render for recipients with subject and HTML body
 * Matches the backend template structure exactly
 */

import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Mail, Info, ImageIcon, Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";

export interface EmailPreviewProps {
  subject?: string;
  bodyHtml?: string;
  showWarning?: boolean;
  posterDataUrl?: string;  // Optional poster image to show as attachment
  restaurantName?: string;  // Restaurant name for template
  couponCode?: string;  // Coupon code for template
  logoUrl?: string;  // Restaurant logo URL
}

export function EmailPreview({
  subject,
  bodyHtml,
  showWarning = true,
  posterDataUrl,
  restaurantName = "Your Restaurant",
  couponCode = "H8DKRT",
  logoUrl,
}: EmailPreviewProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  // useEffect only runs on the client, so now we can safely show the UI
  React.useEffect(() => {
    setMounted(true);
  }, []);

  const isDarkMode = mounted && theme === "dark";

  // Generate complete HTML email template matching backend structure
  const completeEmailHtml = React.useMemo(() => {
    if (!bodyHtml) return null;

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f6f7fb; font-family: Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding: 32px 16px; background: #f6f7fb;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 560px; overflow: hidden; border: 1px solid #e7eaf0; border-radius: 20px; background: #ffffff;">
          <!-- Header Section -->
          <tr>
            <td style="padding: 28px 32px 20px; background: #fff7ed;">
              <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                ${logoUrl ? `<img src="${logoUrl}" alt="${restaurantName}" style="width: 40px; height: 40px; border-radius: 8px; object-fit: cover;" />` : ''}
                <div style="font-size: 13px; font-weight: 700; letter-spacing: 0.14em; color: #f97316; text-transform: uppercase;">YUMMY</div>
              </div>
              <h1 style="margin: 0; font-size: 24px; line-height: 1.3; color: #172033;">${subject || 'A special offer for you'}</h1>
            </td>
          </tr>
          
          <!-- Body Section -->
          <tr>
            <td style="padding: 28px 32px 32px;">
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
  }, [bodyHtml, restaurantName, couponCode, subject, logoUrl]);

  // Debug logging
  React.useEffect(() => {
    if (mounted) {
      console.log("=== EmailPreview Debug ===");
      console.log("Theme:", theme);
      console.log("posterDataUrl:", posterDataUrl ? "Present" : "NULL");
      console.log("completeEmailHtml:", completeEmailHtml ? "Present" : "NULL");
    }
  }, [mounted, theme, posterDataUrl, completeEmailHtml]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-muted-foreground" />
          <CardTitle>Email preview</CardTitle>
        </div>
        <CardDescription>
          How the message renders for a recipient.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Email Subject Display */}
        {subject && (
          <div className={cn(
            "rounded-xl border p-4 transition-colors",
            isDarkMode 
              ? "border-gray-700 bg-gray-800" 
              : "border-gray-200 bg-white"
          )}>
            <div className="flex items-center gap-2 mb-2">
              <span className={cn(
                "text-xs font-bold uppercase tracking-wider",
                isDarkMode ? "text-gray-400" : "text-muted-foreground"
              )}>
                Subject
              </span>
            </div>
            <p className={cn(
              "font-semibold text-base",
              isDarkMode ? "text-gray-100" : "text-foreground"
            )}>
              {subject}
            </p>
          </div>
        )}

        {/* Email Preview - Renders Complete Backend Template HTML */}
        {/* Container adapts to theme, but email content stays light (realistic) */}
        <div className={cn(
          "transition-colors overflow-hidden rounded-lg",
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
        <CardDescription>
          How the message renders for a recipient.
        </CardDescription>
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
