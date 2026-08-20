"use client";

import { useMemo, useState, useEffect } from "react";
import { FileImage, Mail, ZoomIn, Loader2 } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { GrowthCampaign, GrowthMessageTemplate, GrowthCreativeAsset } from "@/lib/api/growth-types";
import { cn, getImageUrl } from "@/lib/utils";
import apiClient from "@/lib/api-client";
import { getEmailTemplateDefinition, DEFAULT_EMAIL_TEMPLATE, type CampaignEmailTemplate } from "@/lib/growth/email-templates";
import { renderPosterStyleEmailHtml } from "@/lib/growth/email-poster-html";
import { PREVIEW_COUPON_CODE } from "@/lib/growth/campaign-studio";
import { useRestaurant } from "@/hooks/use-restaurant";

interface TemplatePreviewProps {
  campaign: GrowthCampaign;
  template?: GrowthMessageTemplate | null;
}

export function TemplatePreview({ campaign, template }: TemplatePreviewProps) {
  const restaurant = useRestaurant((state) => state.restaurant);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [selectedTab, setSelectedTab] = useState<"message" | "template" | "asset">("message");
  const [creativeAsset, setCreativeAsset] = useState<GrowthCreativeAsset | null>(null);
  const [loadingAsset, setLoadingAsset] = useState(false);

  const isEmail = campaign.channel === "email";

  // The backend already flattens the approved snapshot to a plain string for
  // both channels (the email body HTML, or the WhatsApp message text) -- it
  // is never sent as an object with nested fields.
  const snapshot = campaign.approved_message_snapshot || "";
  const emailSubject = campaign.email_subject || "";
  const emailBody = snapshot;
  const messageBody = snapshot;
  const emailTemplateId = (campaign.email_template as CampaignEmailTemplate) || DEFAULT_EMAIL_TEMPLATE;
  const emailDesign = getEmailTemplateDefinition(emailTemplateId);

  // The actual design, not just the raw approved copy -- mirrors exactly
  // how growth_campaign_delivery_service.py renders the real send, so this
  // preview is honest about what the recipient will see.
  const posterHtml = useMemo(() => {
    if (!isEmail || !campaign.offer) return null;
    return renderPosterStyleEmailHtml({
      template: emailTemplateId,
      restaurantName: restaurant?.name || "Your restaurant",
      logoUrl: restaurant?.profile_picture ? getImageUrl(restaurant.profile_picture) : undefined,
      headline: emailSubject || undefined,
      description: emailBody || undefined,
      discountType: campaign.offer.type === "percentage" ? "percentage" : "flat_amount",
      value: Number(campaign.offer.value),
      percentageCap: campaign.offer.percentage_cap ?? undefined,
      minimumOrderValue: campaign.offer.minimum_order_value ?? undefined,
      validUntil: campaign.offer.valid_until ?? undefined,
      couponCode: PREVIEW_COUPON_CODE,
    });
  }, [isEmail, campaign.offer, emailTemplateId, restaurant, emailSubject, emailBody]);

  // Fetch creative asset when component mounts or creative_asset_id changes
  useEffect(() => {
    async function fetchCreativeAsset() {
      if (!campaign.creative_asset_id) return;
      
      setLoadingAsset(true);
      try {
        const response = await apiClient.get(`/growth/campaigns/${campaign.id}/creative-assets/${campaign.creative_asset_id}`);
        setCreativeAsset(response.data?.data || response.data);
      } catch (error) {
        console.error("Failed to fetch creative asset:", error);
        setCreativeAsset(null);
      } finally {
        setLoadingAsset(false);
      }
    }

    void fetchCreativeAsset();
  }, [campaign.id, campaign.creative_asset_id]);

  return (
    <>
      <Card className="dc-card">
        <CardHeader className="pb-4 border-b border-black/[0.08] dark:border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-muted border border-black/[0.08] dark:border-white/15">
              {isEmail ? <Mail className="h-4 w-4 text-blue-500" /> : <FaWhatsapp className="h-4 w-4 text-green-500" />}
            </div>
            <div>
              <CardTitle className="dc-card-title">Campaign Content</CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-1">
                What customers will see in their {isEmail ? "inbox" : "WhatsApp"}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
            {/* Left Column - Template Info */}
            <div className="space-y-4">
              {/* Template Details */}
              <div className="rounded-lg border border-border bg-muted/50 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                  {isEmail ? "Email" : "WhatsApp"} Template
                </p>
                <p className="text-sm font-bold mb-2">
                  {template?.provider_template_name || "No template selected"}
                </p>
                {template && (
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 h-5">
                      {template.language}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] px-1.5 py-0.5 h-5",
                        template.provider_status === "approved"
                          ? "border-green-500/30 bg-green-500/10 text-green-700"
                          : "border-amber-500/30 bg-amber-500/10 text-amber-700"
                      )}
                    >
                      {template.provider_status}
                    </Badge>
                  </div>
                )}
              </div>

              {/* Subject Line (Email only) */}
              {isEmail && emailSubject && (
                <div className="rounded-lg border border-border bg-card p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                    Subject Line
                  </p>
                  <p className="text-sm font-medium leading-relaxed">{emailSubject}</p>
                </div>
              )}

              {/* Message Content */}
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  Message
                </p>
                <div className="rounded-lg p-3 border border-black/[0.08] dark:border-white/10 max-h-40 overflow-y-auto">
                  <p 
                    className="text-xs leading-relaxed"
                    dangerouslySetInnerHTML={{ 
                      __html: isEmail ? (emailBody || "No message") : (messageBody || "No message") 
                    }}
                  />
                </div>
                {template && (
                  <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-[10px]">
                    <span className="text-muted-foreground">Template</span>
                    <span className="font-semibold">#{template.id}</span>
                  </div>
                )}
              </div>

              {/* Preview Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedTab("message");
                  setPreviewOpen(true);
                }}
                className="w-full h-9 gap-2 rounded-xl"
              >
                <ZoomIn className="h-4 w-4" />
                Preview Full Message
              </Button>
            </div>

            {/* Right Column - Visual Preview */}
            <div className="flex flex-col">
              {isEmail ? (
                posterHtml ? (
                  <div className="relative rounded-xl border border-border bg-gray-50 overflow-auto min-h-[520px] max-h-[520px] scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
                    <div
                      className="p-4"
                      dangerouslySetInnerHTML={{ __html: posterHtml }}
                    />
                  </div>
                ) : (
                  <div className="flex items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 min-h-[520px]">
                    <div className="text-center text-muted-foreground">
                      <Mail className="mx-auto h-10 w-10 mb-2" />
                      <p className="text-xs">No email content available</p>
                    </div>
                  </div>
                )
              ) : (
                <div className="rounded-xl border border-border bg-gradient-to-br from-green-50 to-white p-5 overflow-auto min-h-[520px] max-h-[520px] scrollbar-thin scrollbar-thumb-green-300 scrollbar-track-green-100">
                  <div className="rounded-lg bg-white border border-border p-4 shadow-sm space-y-4">
                    {/* Image if available */}
                    {loadingAsset ? (
                      <div className="flex items-center justify-center h-48 rounded-md bg-muted">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : creativeAsset?.secure_url ? (
                      <div className="rounded-md overflow-hidden">
                        <img
                          src={creativeAsset.secure_url}
                          alt="Campaign poster"
                          className="w-full h-auto"
                        />
                      </div>
                    ) : null}
                    
                    {/* Message Text */}
                    {messageBody ? (
                      <p className="whitespace-pre-wrap text-base leading-relaxed">
                        {messageBody}
                      </p>
                    ) : !creativeAsset?.secure_url ? (
                      <div className="flex items-center justify-center min-h-[400px]">
                        <p className="text-sm text-muted-foreground text-center">
                          No message content
                        </p>
                      </div>
                    ) : null}
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Full Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Campaign Content Preview</DialogTitle>
            <DialogDescription>
              This is what customers will see when they receive this campaign
            </DialogDescription>
          </DialogHeader>

          <Tabs value={selectedTab} onValueChange={(v) => setSelectedTab(v as typeof selectedTab)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="message">Message</TabsTrigger>
              <TabsTrigger value="template">Template Info</TabsTrigger>
              {!isEmail && campaign.creative_asset_id && (
                <TabsTrigger value="asset">Poster</TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="message" className="space-y-4 mt-4">
              {isEmail ? (
                <div className="space-y-4">
                  {/* Email Subject */}
                  {emailSubject && (
                    <div className="rounded-xl border border-border bg-muted/50 p-4">
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Subject Line
                      </p>
                      <p className="mt-2 text-base font-semibold">{emailSubject}</p>
                    </div>
                  )}

                  {/* Full rendered design -- exactly what growth_campaign_delivery_service.py
                      sends, not just the raw approved copy. */}
                  {posterHtml ? (
                    <div className="rounded-xl border border-border overflow-hidden">
                      <div className="flex items-center justify-between bg-muted/50 px-4 py-2 border-b border-border">
                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          {emailDesign.label} design
                        </p>
                        {!campaign.email_template && (
                          <span className="text-[11px] text-muted-foreground">Default — none chosen</span>
                        )}
                      </div>
                      <div className="max-h-[600px] overflow-y-auto bg-gray-50 p-4">
                        <div
                          className="mx-auto"
                          style={{ maxWidth: 600 }}
                          dangerouslySetInnerHTML={{ __html: posterHtml }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-border bg-muted/30 p-8 text-center">
                      <Mail className="mx-auto h-12 w-12 text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">No email content available</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {/* WhatsApp Message with Image */}
                  <div className="mx-auto max-w-md">
                    <div className="rounded-xl border border-border bg-gradient-to-br from-green-50 to-white p-6">
                      <div className="flex items-center gap-2 mb-4">
                        <FaWhatsapp className="h-5 w-5 text-green-600" />
                        <span className="font-semibold text-green-700">WhatsApp Message</span>
                      </div>
                      
                      {/* WhatsApp Message Bubble */}
                      <div className="rounded-lg bg-white p-4 shadow-sm space-y-3">
                        {/* Image if available */}
                        {creativeAsset?.secure_url && (
                          <div className="rounded-md overflow-hidden border border-border">
                            <img
                              src={creativeAsset.secure_url}
                              alt="Campaign poster"
                              className="w-full h-auto"
                            />
                          </div>
                        )}
                        
                        {/* Message Text */}
                        {messageBody && (
                          <p className="whitespace-pre-wrap text-sm leading-relaxed">
                            {messageBody}
                          </p>
                        )}
                        
                        {!messageBody && !creativeAsset?.secure_url && (
                          <p className="text-sm text-muted-foreground text-center">
                            No message content
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="template" className="space-y-4 mt-4">
              {template ? (
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-xl border border-border bg-muted/50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Template Name
                      </p>
                      <p className="mt-2 text-sm font-medium">
                        {template.provider_template_name}
                      </p>
                    </div>
                    <div className="rounded-xl border border-border bg-muted/50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Language
                      </p>
                      <p className="mt-2 text-sm font-medium">{template.language}</p>
                    </div>
                    <div className="rounded-xl border border-border bg-muted/50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Status
                      </p>
                      <Badge
                        variant="outline"
                        className={cn(
                          "mt-2",
                          template.provider_status === "approved"
                            ? "border-green-200 bg-green-50 text-green-700"
                            : "border-amber-200 bg-amber-50 text-amber-700"
                        )}
                      >
                        {template.provider_status}
                      </Badge>
                    </div>
                    <div className="rounded-xl border border-border bg-muted/50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Channel
                      </p>
                      <p className="mt-2 text-sm font-medium capitalize">{template.channel}</p>
                    </div>
                    {isEmail && (
                      <div className="rounded-xl border border-border bg-muted/50 p-4 md:col-span-2">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Design
                        </p>
                        <p className="mt-2 text-sm font-medium">
                          {emailDesign.label}
                          {!campaign.email_template && (
                            <span className="ml-2 text-xs font-normal text-muted-foreground">(default, none chosen)</span>
                          )}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">{emailDesign.tagline} · {emailDesign.category}</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border bg-muted/30 p-8 text-center">
                  <p className="text-sm text-muted-foreground">No template information available</p>
                </div>
              )}
            </TabsContent>

            {!isEmail && campaign.creative_asset_id && (
              <TabsContent value="asset" className="mt-4">
                <div className="space-y-4">
                  {/* Asset Info */}
                  <div className="rounded-xl border border-border bg-muted/50 p-4">
                    <div className="grid gap-3 md:grid-cols-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Asset ID
                        </p>
                        <p className="mt-1 text-sm font-medium">{campaign.creative_asset_id}</p>
                      </div>
                      {creativeAsset && (
                        <>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                              Dimensions
                            </p>
                            <p className="mt-1 text-sm font-medium">
                              {creativeAsset.width_px} × {creativeAsset.height_px} px
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                              Format
                            </p>
                            <p className="mt-1 text-sm font-medium uppercase">{creativeAsset.asset_format}</p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Full-size Image */}
                  {loadingAsset ? (
                    <div className="flex items-center justify-center rounded-xl border border-border bg-muted/30 p-12">
                      <div className="text-center">
                        <Loader2 className="mx-auto h-12 w-12 animate-spin text-muted-foreground mb-3" />
                        <p className="text-sm text-muted-foreground">Loading image...</p>
                      </div>
                    </div>
                  ) : creativeAsset?.secure_url ? (
                    <div className="rounded-xl border border-border overflow-hidden bg-white">
                      <div className="p-4 border-b border-border bg-muted/50">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Campaign Poster (Full Size)
                        </p>
                      </div>
                      <div className="p-6 flex items-center justify-center bg-gray-50">
                        <img
                          src={creativeAsset.secure_url}
                          alt="Campaign poster full size"
                          className="max-w-full h-auto rounded-lg shadow-lg"
                          style={{ maxHeight: "70vh" }}
                        />
                      </div>
                      <div className="p-3 border-t border-border bg-muted/30 text-center">
                        <a
                          href={creativeAsset.secure_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline"
                        >
                          Open in new tab
                        </a>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 p-12">
                      <div className="text-center text-muted-foreground">
                        <FileImage className="mx-auto h-16 w-16 mb-3" />
                        <p className="text-sm font-medium">Image not available</p>
                        <p className="text-xs mt-1">Asset ID: {campaign.creative_asset_id}</p>
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>
            )}
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
}
