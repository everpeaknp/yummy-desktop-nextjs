"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  Download,
  Eye,
  FileCheck2,
  FilePenLine,
  ImageIcon,
  Info,
  Lightbulb,
  Loader2,
  LockKeyhole,
  RefreshCw,
  Save,
  ShieldCheck,
  Sparkles,
  Target,
  TriangleAlert,
  Users,
  WalletCards,
  Wand2,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import { CampaignPosterPreview, templateColors } from "@/components/grow/campaign-studio/poster-preview";
import { PosterEditorClient } from "@/components/grow/campaign-studio/poster-editor/PosterEditorClient";
import { EmailPreview } from "@/components/grow/campaign-studio/email-preview";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCampaignStudio, useCampaignStudioHydrated, type StudioStep } from "@/hooks/use-campaign-studio";
import { useRestaurant } from "@/hooks/use-restaurant";
import { growthApi } from "@/lib/api/growth";
import type {
  GrowthBrandProfile,
  GrowthCampaign,
  GrowthChannelCode,
  GrowthLanguage,
  GrowthMessageTemplate,
  GrowthPlaybookCode,
  GrowthSegmentPreview,
} from "@/lib/api/growth-types";
import { getApiErrorMessage } from "@/lib/api-error-message";
import {
  buildCampaignCreateInput,
  approvedTemplatesForLanguageAndChannel,
  CAMPAIGN_PLAYBOOKS,
  CAMPAIGN_REVIEW_CAVEATS,
  campaignStudioActionPolicy,
  deterministicCampaignCopy,
  formatCampaignOffer,
  getCampaignPlaybook,
  PREVIEW_COUPON_CODE,
  validateCampaignOffer,
  type CampaignOfferDraft,
  type CampaignPosterTemplate,
} from "@/lib/growth/campaign-studio";
import type { CampaignEmailTemplate } from "@/lib/growth/email-templates";
import { cn, getImageUrl } from "@/lib/utils";

const studioSteps: Array<{
  step: StudioStep;
  title: string;
  shortTitle: string;
  icon: typeof Target;
}> = [
  { step: 1, title: "Choose the observed opportunity", shortTitle: "Audience", icon: Target },
  { step: 2, title: "Bound the offer economics", shortTitle: "Offer", icon: WalletCards },
  { step: 3, title: "Prepare approved content", shortTitle: "Creative", icon: ImageIcon },
  { step: 4, title: "Review without sending", shortTitle: "Review", icon: FileCheck2 },
];

/**
 * Feature flag for the new Fabric.js poster editor
 * Phase 1: Default = false (keep existing HTML/CSS poster system)
 * Set to true to enable the new Canva-like editor
 */
const USE_FABRIC_EDITOR = false;

function readableExclusion(value: string): string {
  // User-friendly labels for restaurant staff
  const friendlyLabels: Record<string, string> = {
    'missing_valid_e164': 'Invalid phone number',
    'marketing_opted_out': 'Unsubscribed from marketing',
    'marketing_consent_missing': 'No marketing permission',
    'no_completed_orders': 'Never completed an order',
    'different_segment': 'Not in target group',
    'no_phone': 'No phone number',
    'invalid_phone': 'Invalid phone number',
    'no_email': 'No email address',
    'invalid_email': 'Invalid email address',
    'blocked': 'Blocked customer',
    'inactive': 'Inactive customer',
  };
  
  const lowercaseKey = value.toLowerCase();
  if (friendlyLabels[lowercaseKey]) {
    return friendlyLabels[lowercaseKey];
  }
  
  // Fallback: capitalize words
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function safeFilename(value: string): string {
  return (
    value
      .trim()
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase() || "yummy-grow-campaign"
  );
}

function formatMoney(value: number | null): string {
  return value == null
    ? "Not bounded yet"
    : `Rs. ${value.toLocaleString("en-NP", { maximumFractionDigits: 0 })}`;
}

function languageLabel(language: GrowthLanguage): string {
  if (language === "ne") return "Nepali";
  if (language === "ne_romanized") return "Romanized Nepali";
  return "English";
}

export function CampaignStudioClient() {
  const restaurant = useRestaurant((state) => state.restaurant);
  const restaurantName = restaurant?.name || "Your restaurant";
  const hydrated = useCampaignStudioHydrated();

  // Draft fields live in a persisted Zustand store (see use-campaign-studio.ts)
  // so an accidental refresh/navigation mid-draft doesn't lose the campaign,
  // the same protection the onboarding wizard already has. Shim setters below
  // keep every call-site elsewhere in this file unchanged.
  const step = useCampaignStudio((state) => state.step);
  const furthestStep = useCampaignStudio((state) => state.furthestStep);
  const playbookCode = useCampaignStudio((state) => state.playbookCode);
  const channel = useCampaignStudio((state) => state.channel);
  const campaignName = useCampaignStudio((state) => state.campaignName);
  const nameCustomized = useCampaignStudio((state) => state.nameCustomized);
  const offer = useCampaignStudio((state) => state.offer);
  const language = useCampaignStudio((state) => state.language);
  const headline = useCampaignStudio((state) => state.headline);
  const message = useCampaignStudio((state) => state.message);
  const copyCustomized = useCampaignStudio((state) => state.copyCustomized);
  const terms = useCampaignStudio((state) => state.terms);
  const posterTemplate = useCampaignStudio((state) => state.posterTemplate);
  const emailPosterTemplate = useCampaignStudio((state) => state.emailPosterTemplate);
  const useEmailPoster = useCampaignStudio((state) => state.useEmailPoster);
  const selectedMessageTemplateId = useCampaignStudio((state) => state.selectedMessageTemplateId);
  const emailSubject = useCampaignStudio((state) => state.emailSubject);
  const emailBodyHtml = useCampaignStudio((state) => state.emailBodyHtml);
  const reviewAccepted = useCampaignStudio((state) => state.reviewAccepted);
  const patchDraft = useCampaignStudio((state) => state.patch);
  const setStep = useCampaignStudio((state) => state.setStep);
  const setFurthestStep = useCampaignStudio((state) => state.setFurthestStep);
  const resetDraft = useCampaignStudio((state) => state.reset);

  const setPlaybookCode = (value: GrowthPlaybookCode) => patchDraft("playbookCode", value);
  const setChannel = (value: GrowthChannelCode) => {
    patchDraft("channel", value);
    patchDraft("selectedMessageTemplateId", "");
    patchDraft("reviewAccepted", false);
    patchDraft("copyCustomized", false);  // Reset copy customization when channel changes
  };
  const setCampaignName = (value: string) => patchDraft("campaignName", value);
  const setNameCustomized = (value: boolean) => patchDraft("nameCustomized", value);
  const setOffer = (
    updater: CampaignOfferDraft | ((current: CampaignOfferDraft) => CampaignOfferDraft),
  ) => patchDraft("offer", typeof updater === "function" ? updater(offer) : updater);
  const setLanguage = (value: GrowthLanguage) => patchDraft("language", value);
  const setHeadline = (value: string) => patchDraft("headline", value);
  const setMessage = (value: string) => patchDraft("message", value);
  const setCopyCustomized = (value: boolean) => patchDraft("copyCustomized", value);
  const setTerms = (value: string) => patchDraft("terms", value);
  const setPosterTemplate = (value: CampaignPosterTemplate) => patchDraft("posterTemplate", value);
  const setEmailPosterTemplate = (value: CampaignEmailTemplate) => patchDraft("emailPosterTemplate", value);
  const setUseEmailPoster = (value: boolean) => patchDraft("useEmailPoster", value);
  const setSelectedMessageTemplateId = (value: string) =>
    patchDraft("selectedMessageTemplateId", value);
  const setEmailSubject = (value: string) => patchDraft("emailSubject", value);
  const setEmailBodyHtml = (value: string) => patchDraft("emailBodyHtml", value);
  const setReviewAccepted = (value: boolean) => patchDraft("reviewAccepted", value);

  const [brand, setBrand] = useState<GrowthBrandProfile | null>(null);
  const [brandUnavailable, setBrandUnavailable] = useState(false);
  const [messageTemplates, setMessageTemplates] = useState<GrowthMessageTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [audience, setAudience] = useState<GrowthSegmentPreview | null>(null);
  const [audienceLoading, setAudienceLoading] = useState(false);
  const [audienceError, setAudienceError] = useState<string | null>(null);
  const [savedCampaign, setSavedCampaign] = useState<GrowthCampaign | null>(null);
  const [saving, setSaving] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [suggestingCopy, setSuggestingCopy] = useState(false);
  const [exportingPoster, setExportingPoster] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [posterDataUrl, setPosterDataUrl] = useState<string | null>(null);
  const audienceRequestRef = useRef(0);
  const posterRef = useRef<HTMLDivElement>(null);
  const exportPosterRef = useRef<HTMLDivElement>(null);

  const playbook = useMemo(
    () => getCampaignPlaybook(playbookCode),
    [playbookCode],
  );
  const offerValidation = useMemo(
    () => validateCampaignOffer(offer),
    [offer],
  );
  // EmailPreview/renderPosterStyleEmailHtml expect camelCase field names
  // (discountType/minimumOrderValue/percentageCap/validUntil); the draft
  // stores snake_case (type/minimum_order_value/percentage_cap/valid_until).
  // Without this mapping those fields are silently undefined in the email
  // preview even though they're filled in on the Offer step.
  const emailPreviewOffer = useMemo(
    () => ({
      discountType: (offer.type === "percentage" ? "percentage" : "flat_amount") as
        | "percentage"
        | "flat_amount",
      value: offer.value,
      percentageCap: offer.percentage_cap,
      minimumOrderValue: offer.minimum_order_value,
      validUntil: offer.valid_until,
    }),
    [offer],
  );
  const actionPolicy = campaignStudioActionPolicy(
    savedCampaign?.status ?? "unsaved",
  );
  const isReadOnly = savedCampaign?.status === "review";
  const approvedMessageTemplates = useMemo(
    () => approvedTemplatesForLanguageAndChannel(messageTemplates, language, channel),
    [channel, language, messageTemplates],
  );
  const selectedMessageTemplate = useMemo(
    () =>
      approvedMessageTemplates.find(
        (template) => String(template.id) === selectedMessageTemplateId,
      ) ?? null,
    [approvedMessageTemplates, selectedMessageTemplateId],
  );

  const starterCopy = useMemo(
    () =>
      deterministicCampaignCopy({
        restaurantName,
        playbookCode,
        language,
        offer,
        channel,
      }),
    [channel, language, offer, playbookCode, restaurantName],
  );

  useEffect(() => {
    if (copyCustomized) return;
    if (channel === "email") {
      setEmailSubject(starterCopy.headline);
      setEmailBodyHtml(starterCopy.message);
    } else {
      setHeadline(starterCopy.headline);
      setMessage(starterCopy.message);
    }
  }, [channel, copyCustomized, starterCopy]);

  useEffect(() => {
    if (!nameCustomized) {
      setCampaignName(`${playbook.shortTitle} offer`);
    }
  }, [nameCustomized, playbook.shortTitle]);

  useEffect(() => {
    let active = true;
    growthApi
      .getBrand()
      .then((result) => {
        if (!active) return;
        setBrand(result);
        if (result.default_terms_text?.trim()) {
          setTerms(result.default_terms_text.trim());
        }
      })
      .catch(() => {
        if (active) setBrandUnavailable(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    setTemplatesLoading(true);
    setTemplatesError(null);
    growthApi
      .listMessageTemplates(channel)
      .then((result) => {
        if (active) setMessageTemplates(result);
      })
      .catch(() => {
        if (active) {
          setMessageTemplates([]);
          setTemplatesError(
            `Approved ${channel === "email" ? "email" : "WhatsApp"} templates could not be loaded. Review submission is disabled.`,
          );
        }
      })
      .finally(() => {
        if (active) setTemplatesLoading(false);
      });
    return () => {
      active = false;
    };
  }, [channel]);

  useEffect(() => {
    const stillValid =
      selectedMessageTemplateId &&
      approvedMessageTemplates.some(
        (template) => String(template.id) === selectedMessageTemplateId,
      );
    if (stillValid) return;
    setSelectedMessageTemplateId(
      approvedMessageTemplates[0] ? String(approvedMessageTemplates[0].id) : "",
    );
  }, [approvedMessageTemplates, selectedMessageTemplateId]);

  const loadAudience = useCallback(async () => {
    const requestId = ++audienceRequestRef.current;
    setAudienceLoading(true);
    setAudienceError(null);
    setAudience(null);
    try {
      const result = await growthApi.previewSegment(playbook.segment, channel);
      if (requestId === audienceRequestRef.current) setAudience(result);
    } catch {
      if (requestId === audienceRequestRef.current) {
        setAudienceError(
          "The live audience could not be calculated. You may continue drafting, but review submission stays blocked until Yummy can verify an eligible audience.",
        );
      }
    } finally {
      if (requestId === audienceRequestRef.current) setAudienceLoading(false);
    }
  }, [channel, playbook.segment]);

  const renderPosterPng = useCallback(async (): Promise<Blob> => {
    if (!posterRef.current) {
      throw new Error("Campaign poster preview is unavailable");
    }

    // Wait for all images and fonts to load before capturing
    await document.fonts.ready;
    
    // Ensure all images in the poster are loaded
    const images = posterRef.current.querySelectorAll('img');
    await Promise.all(
      Array.from(images).map(
        (img) =>
          new Promise((resolve) => {
            if (img.complete) {
              resolve(true);
            } else {
              img.addEventListener('load', () => resolve(true));
              img.addEventListener('error', () => resolve(false));
            }
          })
      )
    );
    
    // Give the browser extra time to render everything
    await new Promise(resolve => setTimeout(resolve, 1000));

    const html2canvas = (await import("html2canvas")).default;
    
    const posterElement = posterRef.current;
    
    // Force fixed 600x600px for export (matching fixedSize prop)
    const posterSize = 600;
    
    // Scale to 2160x2160px output (3.6x multiplier)
    const targetSize = 2160;
    const scale = targetSize / posterSize;
    
    try {
      const canvas = await html2canvas(posterElement, {
        scale: scale,
        useCORS: true,
        allowTaint: false,
        backgroundColor: null,
        logging: false,
        width: posterSize,
        height: posterSize,
        windowWidth: posterSize,
        windowHeight: posterSize,
        x: 0,
        y: 0,
        imageTimeout: 15000,
        removeContainer: true,
        foreignObjectRendering: false,
      });
      
      return new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob?.type === "image/png") resolve(blob);
          else reject(new Error("The campaign poster could not be encoded as PNG"));
        }, "image/png", 0.95);
      });
    } catch (error) {
      console.error("Error rendering poster:", error);
      throw error;
    }
  }, []);

  useEffect(() => {
    // Wait for the persisted draft to rehydrate first, otherwise this fires
    // once for the default playbook and again once the real one loads.
    if (!hydrated) return;
    void loadAudience();
  }, [hydrated, loadAudience]);

  // Generate poster data URL for email attachment preview
  useEffect(() => {
    if (channel !== "email") {
      setPosterDataUrl(null);
      return;
    }

    const generatePosterDataUrl = async () => {
      try {
        const blob = await renderPosterPng();
        const dataUrl = URL.createObjectURL(blob);
        setPosterDataUrl(dataUrl);
        
        // Cleanup function to revoke the object URL
        return () => URL.revokeObjectURL(dataUrl);
      } catch (error) {
        console.error("Failed to generate poster preview:", error);
        setPosterDataUrl(null);
      }
    };

    void generatePosterDataUrl();
  }, [channel, posterTemplate, headline, offer, terms, restaurantName, brand, renderPosterPng]);

  const updateOffer = <K extends keyof CampaignOfferDraft>(
    key: K,
    value: CampaignOfferDraft[K],
  ) => {
    setOffer((current) => ({ ...current, [key]: value }));
  };

  const changeStep = (next: StudioStep) => {
    setPageError(null);
    setStep(next);
    if (next > furthestStep) setFurthestStep(next);
  };

  const continueFromCurrentStep = () => {
    setPageError(null);
    if (step === 1 && campaignName.trim().length < 3) {
      setPageError("Give this campaign a clear internal name before continuing.");
      return;
    }
    if (step === 2 && !offerValidation.valid) {
      setPageError("Correct the offer rules before continuing. The client will not hide an unbounded offer.");
      return;
    }
    if (step === 3) {
      if (channel === "email") {
        if (emailSubject.trim().length < 3 || emailBodyHtml.trim().length < 12) {
          setPageError("Add a clear email subject and body before review.");
          return;
        }
      } else if (headline.trim().length < 3 || message.trim().length < 12) {
        setPageError("Add a clear poster headline and WhatsApp message before review.");
        return;
      }
      if (!selectedMessageTemplate) {
        setPageError(
          `No provider-approved ${channel === "email" ? "email" : "image WhatsApp"} template is available for ${languageLabel(language)}. Add or approve that template before review.`,
        );
        return;
      }
    }
    if (step < 4) changeStep((step + 1) as StudioStep);
  };

  const campaignInput = () => {
    const input = buildCampaignCreateInput({
      name: campaignName,
      playbookCode,
      channel,
      offer,
      language,
      message,
      emailSubject,
      emailBodyHtml,
      emailTemplate: emailPosterTemplate,
    });
    return selectedMessageTemplate
      ? { ...input, message_template_id: Number(selectedMessageTemplate.id) }
      : input;
  };

  const persistDraft = async (announce = true): Promise<GrowthCampaign | null> => {
    setPageError(null);
    const contentReady =
      channel === "email"
        ? emailSubject.trim().length >= 3 && emailBodyHtml.trim().length >= 12
        : message.trim().length >= 12;
    if (campaignName.trim().length < 3 || !offerValidation.valid || !contentReady) {
      setPageError("Complete the campaign name, bounded offer, and message before saving a draft.");
      return null;
    }

    setSaving(true);
    try {
      const campaign = savedCampaign
        ? await growthApi.updateCampaign(savedCampaign.id, {
            name: campaignName.trim(),
             offer: campaignInput().offer,
             language,
             message_body: channel === "whatsapp" ? message.trim() : undefined,
             email_subject: channel === "email" ? emailSubject.trim() : undefined,
             email_body_html: channel === "email" ? emailBodyHtml.trim() : undefined,
             email_template: channel === "email" ? emailPosterTemplate : undefined,
             message_template_id: selectedMessageTemplate
               ? Number(selectedMessageTemplate.id)
               : undefined,
           })
        : await growthApi.createCampaign(campaignInput());
      setSavedCampaign(campaign);
      if (announce) {
        toast.success("Campaign draft saved. No approval, schedule, or delivery was created.");
      }
      return campaign;
    } catch (error) {
      setPageError(
        getApiErrorMessage(
          error,
          "The draft could not be saved. Nothing was approved, scheduled, or sent.",
        ),
      );
      return null;
    } finally {
      setSaving(false);
    }
  };

  const submitForReview = async () => {
    setPageError(null);
    if (!reviewAccepted) {
      setPageError("Confirm the immutable economics, consent checks, and manual approval boundary first.");
      return;
    }
    if (!audience || audience.included_count <= 0) {
      setPageError("A verified live audience with at least one eligible customer is required for review.");
      return;
    }
    const contentReady =
      channel === "email"
        ? emailSubject.trim().length >= 3 && emailBodyHtml.trim().length >= 12
        : message.trim().length >= 12;
    if (!offerValidation.valid || !contentReady) {
      setPageError("Offer or message validation is incomplete.");
      return;
    }
    if (!selectedMessageTemplate) {
      setPageError(
        `A provider-approved ${channel === "email" ? "email" : "image WhatsApp"} template matching ${languageLabel(language)} is required. The campaign remains a draft.`,
      );
      return;
    }

    setSubmittingReview(true);
    try {
      const draft = await persistDraft(false);
      if (!draft) return;
      if (channel === "whatsapp") {
        const posterBlob = await renderPosterPng();
        const asset = await growthApi.uploadCampaignPoster(draft.id, {
          file: posterBlob,
          filename: `${safeFilename(campaignName)}-whatsapp-poster.png`,
          template_key: posterTemplate,
          template_version: 1,
        });
        const reviewed = await growthApi.submitCampaignForReview(draft.id);
        setSavedCampaign(reviewed);
        toast.success(
          `Poster #${asset.id} attached and submitted for manual review. It has not been approved, scheduled, or sent.`,
        );
      } else {
        const reviewed = await growthApi.submitCampaignForReview(draft.id);
        setSavedCampaign(reviewed);
        toast.success(
          "Submitted for manual review. It has not been approved, scheduled, or sent.",
        );
      }
    } catch (error) {
      setPageError(
        getApiErrorMessage(
          error,
          "The campaign could not be submitted for review. It has not been approved or sent.",
        ),
      );
    } finally {
      setSubmittingReview(false);
    }
  };

  const suggestCopy = async () => {
    setSuggestingCopy(true);
    setPageError(null);
    
    try {
      // Check if AI copy is enabled in settings
      const settings = await growthApi.getSettings();
      
      if (!settings.ai_copy_enabled) {
        // AI is disabled - use system templates directly
        const freshCopy = deterministicCampaignCopy({
          restaurantName,
          playbookCode,
          language,
          offer,
          channel,
        });
        if (channel === "email") {
          setEmailSubject(freshCopy.headline);
          setEmailBodyHtml(freshCopy.message);
        } else {
          setHeadline(freshCopy.headline);
          setMessage(freshCopy.message);
        }
        setCopyCustomized(true);
        toast.success("System template applied! Click again for another variation.");
        setSuggestingCopy(false);
        return;
      }
      
      // AI is enabled - try to use AI
      const suggestion = await growthApi.suggestCopy({
        playbook_code: playbookCode,
        language,
        offer: campaignInput().offer,
        audience_summary: `${audience?.included_count ?? 0} ${playbook.audienceLabel.toLowerCase()}`,
      });
      if (channel === "email") {
        setEmailSubject(suggestion.headline);
        setEmailBodyHtml(suggestion.message_body);
      } else {
        setHeadline(suggestion.headline);
        setMessage(suggestion.message_body);
      }
      setCopyCustomized(true);
      if (suggestion.warnings.length) toast.info(suggestion.warnings.join(" "));
      else toast.success("AI-generated copy applied. Review every word before submission.");
    } catch {
      // AI failed or errored - fallback to system templates
      const freshCopy = deterministicCampaignCopy({
        restaurantName,
        playbookCode,
        language,
        offer,
        channel,
      });
      if (channel === "email") {
        setEmailSubject(freshCopy.headline);
        setEmailBodyHtml(freshCopy.message);
      } else {
        setHeadline(freshCopy.headline);
        setMessage(freshCopy.message);
      }
      setCopyCustomized(true);
      toast.success("Template applied! Click again for another variation.");
    } finally {
      setSuggestingCopy(false);
    }
  };

  const exportPoster = async () => {
    setExportingPoster(true);
    try {
      const blob = await renderPosterPng();
      const anchor = document.createElement("a");
      const objectUrl = URL.createObjectURL(blob);
      anchor.href = objectUrl;
      anchor.download = `${safeFilename(campaignName)}-whatsapp-poster.png`;
      anchor.click();
      URL.revokeObjectURL(objectUrl);
      toast.success("Poster exported locally. It was not uploaded or attached to a campaign.");
    } catch {
      toast.error("The poster could not be exported. Check whether the restaurant logo allows image export.");
    } finally {
      setExportingPoster(false);
    }
  };

  if (!hydrated) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const poster = (
    <CampaignPosterPreview
      ref={posterRef}
      template={posterTemplate}
      restaurantName={restaurantName}
      logoUrl={brand?.logo_url || getImageUrl(restaurant?.profile_picture || "")}
      primaryColor={brand?.primary_color}
      headline={headline}
      offerLabel={formatCampaignOffer(offer)}
      expiresOn={offer.valid_until}
      terms={terms}
      fixedSize={true}
    />
  );

  return (
    <div className="dashboard-ui relative flex flex-col gap-10 max-w-full xl:max-w-[1600px] mx-auto pb-32 px-4 overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3 mb-2">
            <Link href="/grow" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
              <ArrowLeft className="h-4 w-4" />
              Back to Yummy Grow
            </Link>
          </div>
          <h1 className="dc-page-title">Create Campaign</h1>
          <p className="dc-page-subtitle">
            Draft a playbook, inspect audience, bound offer, and prepare content for review
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="outline" className={cn(
            "text-xs font-semibold gap-1.5",
            savedCampaign?.status === "review" 
              ? "border-green-500/20 bg-green-500/10 text-green-600"
              : savedCampaign
                ? "border-blue-500/20 bg-blue-500/10 text-blue-600"
                : "border-border bg-muted text-muted-foreground"
          )}>
            {savedCampaign?.status === "review" ? (
              <><CheckCircle2 className="h-3.5 w-3.5" />Awaiting review</>
            ) : savedCampaign ? (
              <><Save className="h-3.5 w-3.5" />Draft saved</>
            ) : (
              <><FilePenLine className="h-3.5 w-3.5" />Unsaved</>
            )}
          </Badge>
        </div>
      </div>

      <nav className="dc-card p-4" aria-label="Campaign steps">
        <div className="flex items-center justify-between gap-2">
          {studioSteps.map((item, index) => {
            const Icon = item.icon;
            const active = step === item.step;
            const accessible = item.step <= furthestStep;
            const completed = item.step < step;
            
            return (
              <div key={item.step} className="flex flex-1 items-center">
                <button
                  type="button"
                  disabled={!accessible || isReadOnly}
                  onClick={() => changeStep(item.step)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left transition-all disabled:cursor-not-allowed disabled:opacity-45",
                    active 
                      ? "bg-primary text-primary-foreground" 
                      : "hover:bg-muted",
                  )}
                >
                  <span 
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                      active 
                        ? "bg-white/20" 
                        : completed
                          ? "bg-primary/10"
                          : "bg-muted"
                    )}
                  >
                    {completed ? (
                      <CheckCircle2 className={cn("h-4 w-4", "text-primary")} />
                    ) : (
                      <Icon className={cn(
                        "h-4 w-4",
                        active ? "text-primary-foreground" : "text-muted-foreground"
                      )} />
                    )}
                  </span>
                  
                  <span className="hidden min-w-0 flex-1 sm:block">
                    <span className={cn(
                      "block text-[10px] font-medium uppercase tracking-wider opacity-70"
                    )}>
                      Step {item.step}
                    </span>
                    <span className={cn("block truncate text-xs font-semibold")}>
                      {item.shortTitle}
                    </span>
                  </span>
                </button>
                
                {/* Arrow between steps */}
                {index < studioSteps.length - 1 && (
                  <ArrowRight 
                    className={cn(
                      "mx-1 h-4 w-4 shrink-0 transition-colors",
                      completed ? "text-primary" : "text-muted-foreground/30"
                    )} 
                  />
                )}
              </div>
            );
          })}
        </div>
      </nav>

      {pageError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Campaign needs attention</AlertTitle>
          <AlertDescription className="whitespace-pre-line">{pageError}</AlertDescription>
        </Alert>
      )}

      {isReadOnly && (
        <Alert className="rounded-xl border border-border bg-card">
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>Submitted for manual review</AlertTitle>
          <AlertDescription>
            This revision is read-only here. No delivery was scheduled or sent. An authorized approver must use the future approval workflow.
          </AlertDescription>
        </Alert>
      )}

      {step === 1 && (
        <div className="grid gap-8 xl:grid-cols-[1.05fr_0.95fr] overflow-x-hidden">
          <Card className="rounded-xl border border-border bg-card transition-all hover:shadow-md">
            <CardHeader className="space-y-3">
              <CardTitle className="text-xl">Choose one V1 playbook</CardTitle>
              <CardDescription className="text-sm">Observed rules only. Predictive churn and custom segments are outside V1.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="campaign-name">Internal campaign name</Label>
                <Input
                  id="campaign-name"
                  value={campaignName}
                  maxLength={120}
                  disabled={isReadOnly}
                  onChange={(event) => {
                    setCampaignName(event.target.value);
                    setNameCustomized(true);
                  }}
                />
                <p className="text-xs text-muted-foreground">Customers do not see this internal name.</p>
              </div>

              <div className="space-y-2">
                <Label>Delivery channel</Label>
                <RadioGroup
                  value={channel}
                  onValueChange={(value) => setChannel(value as GrowthChannelCode)}
                  className="grid gap-3 sm:grid-cols-2"
                  disabled={isReadOnly}
                >
                  <Label
                    htmlFor="channel-whatsapp"
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-xl border border-border p-4",
                      channel === "whatsapp" && "border-primary bg-primary/5",
                    )}
                  >
                    <RadioGroupItem id="channel-whatsapp" value="whatsapp" />
                    <span>
                      <span className="block font-bold">WhatsApp</span>
                      <span className="text-xs font-normal text-muted-foreground">Poster image + message</span>
                    </span>
                  </Label>
                  <Label
                    htmlFor="channel-email"
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-xl border border-border p-4",
                      channel === "email" && "border-primary bg-primary/5",
                    )}
                  >
                    <RadioGroupItem id="channel-email" value="email" />
                    <span>
                      <span className="block font-bold">Email</span>
                      <span className="text-xs font-normal text-muted-foreground">Subject + HTML body</span>
                    </span>
                  </Label>
                </RadioGroup>
              </div>

              <RadioGroup
                value={playbookCode}
                onValueChange={(value) => {
                  setPlaybookCode(value as GrowthPlaybookCode);
                  setReviewAccepted(false);
                }}
                className="gap-3"
                disabled={isReadOnly}
              >
                {CAMPAIGN_PLAYBOOKS.map((item) => (
                  <Label
                    key={item.code}
                    htmlFor={`playbook-${item.code}`}
                    className={cn(
                      "flex cursor-pointer items-start gap-4 rounded-2xl border p-4 transition-colors",
                      playbookCode === item.code && "border-primary bg-primary/5",
                    )}
                  >
                    <RadioGroupItem id={`playbook-${item.code}`} value={item.code} className="mt-1" />
                    <span>
                      <span className="block font-bold">{item.title}</span>
                      <span className="mt-1 block text-sm font-normal leading-5 text-muted-foreground">{item.description}</span>
                      <span className="mt-2 block text-xs font-semibold text-primary">Audience: {item.audienceLabel}</span>
                    </span>
                  </Label>
                ))}
              </RadioGroup>
            </CardContent>
          </Card>

          <Card className="rounded-xl border border-border bg-card transition-all hover:shadow-md">
            <CardHeader className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-xl">Live audience preview</CardTitle>
                  <CardDescription className="mt-1 text-sm">Aggregate counts. Not frozen or approved.</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => void loadAudience()} disabled={audienceLoading} className="rounded-xl border border-border">
                  <RefreshCw className={cn("mr-2 h-4 w-4", audienceLoading && "animate-spin")} />Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {audienceLoading ? (
                <div className="flex min-h-56 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>
              ) : audienceError ? (
                <Alert className="rounded-xl border border-border bg-card">
                  <TriangleAlert className="h-4 w-4" />
                  <AlertTitle>Audience unavailable</AlertTitle>
                  <AlertDescription>{audienceError}</AlertDescription>
                </Alert>
              ) : audience ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-border bg-muted p-4">
                      <Users className="h-5 w-5" />
                      <p className="mt-3 text-3xl font-black">{audience.included_count.toLocaleString("en-NP")}</p>
                      <p className="text-xs font-semibold text-muted-foreground">Currently eligible</p>
                    </div>
                    <div className="rounded-xl border border-border bg-muted p-4">
                      <ShieldCheck className="h-5 w-5" />
                      <p className="mt-3 text-3xl font-black">{audience.excluded_count.toLocaleString("en-NP")}</p>
                      <p className="text-xs font-semibold text-muted-foreground">Excluded safely</p>
                    </div>
                  </div>
                  <div className="rounded-2xl border p-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Why this audience</p>
                    <p className="mt-2 text-sm leading-6">{playbook.observedFact}</p>
                  </div>
                  {Object.keys(audience.exclusions || {}).length > 0 && (
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Why some customers can't receive this</p>
                      <p className="mt-1 text-xs text-muted-foreground">These customers are excluded for legal or technical reasons:</p>
                      <div className="mt-2 space-y-2">
                        {Object.entries(audience.exclusions).map(([reason, count]) => (
                          <div key={reason} className="flex items-center justify-between rounded-xl bg-muted/50 px-3 py-2 text-sm">
                            <span>{readableExclusion(reason)}</span><span className="font-bold">{count.toLocaleString("en-NP")}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <p className="text-xs leading-5 text-muted-foreground">Consent, phone validity, frequency caps, returns, merge state, and channel status must be checked again before any future delivery.</p>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      )}

      {step === 2 && (
        <div className="grid gap-6 xl:grid-cols-[1fr_0.75fr] overflow-x-hidden">
          <Card>
            <CardHeader>
              <CardTitle>Offer rules</CardTitle>
              <CardDescription>V1 supports fixed or capped-percentage discounts only. Backend order calculation remains authoritative.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <RadioGroup
                value={offer.type}
                onValueChange={(value) => updateOffer("type", value as CampaignOfferDraft["type"])}
                className="grid gap-3 sm:grid-cols-2"
                disabled={isReadOnly}
              >
                <Label htmlFor="offer-fixed" className={cn("flex cursor-pointer items-center gap-3 rounded-xl border border-border p-4", offer.type === "fixed" && "border-primary bg-primary/5")}>
                  <RadioGroupItem id="offer-fixed" value="fixed" />
                  <span><span className="block font-bold">Fixed amount</span><span className="text-xs font-normal text-muted-foreground">A bounded rupee discount</span></span>
                </Label>
                <Label htmlFor="offer-percentage" className={cn("flex cursor-pointer items-center gap-3 rounded-xl border border-border p-4", offer.type === "percentage" && "border-primary bg-primary/5")}>
                  <RadioGroupItem id="offer-percentage" value="percentage" />
                  <span><span className="block font-bold">Percentage</span><span className="text-xs font-normal text-muted-foreground">Requires a rupee cap</span></span>
                </Label>
              </RadioGroup>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="offer-value">{offer.type === "fixed" ? "Discount amount (Rs.)" : "Discount percentage"}</Label>
                  <Input id="offer-value" type="number" min="1" max={offer.type === "percentage" ? "100" : undefined} value={offer.value} disabled={isReadOnly} onChange={(event) => updateOffer("value", Number(event.target.value))} />
                  {offerValidation.errors.value && <p className="text-xs text-destructive">{offerValidation.errors.value}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="offer-minimum">Minimum order value (Rs.)</Label>
                  <Input id="offer-minimum" type="number" min="1" value={offer.minimum_order_value} disabled={isReadOnly} onChange={(event) => updateOffer("minimum_order_value", Number(event.target.value))} />
                  {offerValidation.errors.minimum_order_value && <p className="text-xs text-destructive">{offerValidation.errors.minimum_order_value}</p>}
                </div>
                {offer.type === "percentage" && (
                  <div className="space-y-2">
                    <Label htmlFor="offer-cap">Maximum discount per redemption (Rs.)</Label>
                    <Input id="offer-cap" type="number" min="1" value={offer.percentage_cap ?? ""} disabled={isReadOnly} onChange={(event) => updateOffer("percentage_cap", event.target.value ? Number(event.target.value) : null)} />
                    {offerValidation.errors.percentage_cap && <p className="text-xs text-destructive">{offerValidation.errors.percentage_cap}</p>}
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="offer-limit">Maximum redemptions</Label>
                  <Input id="offer-limit" type="number" min="1" step="1" value={offer.redemption_limit} disabled={isReadOnly} onChange={(event) => updateOffer("redemption_limit", Number(event.target.value))} />
                  {offerValidation.errors.redemption_limit && <p className="text-xs text-destructive">{offerValidation.errors.redemption_limit}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="offer-start">Starts</Label>
                  <Input id="offer-start" type="date" value={offer.valid_from} disabled={isReadOnly} onChange={(event) => updateOffer("valid_from", event.target.value)} />
                  {offerValidation.errors.valid_from && <p className="text-xs text-destructive">{offerValidation.errors.valid_from}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="offer-expiry">Expires</Label>
                  <Input id="offer-expiry" type="date" value={offer.valid_until} disabled={isReadOnly} onChange={(event) => updateOffer("valid_until", event.target.value)} />
                  {offerValidation.errors.valid_until && <p className="text-xs text-destructive">{offerValidation.errors.valid_until}</p>}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader><CardTitle>Maximum Cost</CardTitle><CardDescription>Total cost if all customers use this offer</CardDescription></CardHeader>
              <CardContent>
                <p className="text-4xl font-black">{formatMoney(offerValidation.maximum_exposure)}</p>
                <p className="mt-3 text-sm font-semibold">{formatCampaignOffer(offer)}</p>
                {audience && offer.redemption_limit > audience.included_count && (
                  <Alert className="mt-4 rounded-xl border-amber-500/40 bg-amber-500/5">
                    <TriangleAlert className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="text-amber-800 dark:text-amber-300">You set more redemptions than eligible customers. Double-check this number.</AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
            <div className="flex gap-2.5 rounded-xl border border-dashed border-border px-3.5 py-3 text-muted-foreground">
              <Info className="h-4 w-4 shrink-0 translate-y-0.5" />
              <p className="text-xs leading-relaxed">
                <span className="font-medium text-foreground">Check if this offer is profitable.</span>{" "}
                Make sure your menu prices and food costs can support this discount.
              </p>
            </div>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr] overflow-x-hidden">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle>{channel === "email" ? "Email content" : "Message and poster"}</CardTitle>
                  <CardDescription className="mt-1">
                    {channel === "email"
                      ? "Approved templates only. No synthetic content is generated."
                      : "Controlled templates use the restaurant's real logo. No synthetic food image is generated."}
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => void suggestCopy()} disabled={suggestingCopy || isReadOnly}>
                  {suggestingCopy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Lightbulb className="mr-2 h-4 w-4" />}Suggest copy
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {brandUnavailable && (
                <Alert className="rounded-xl border border-border bg-card"><TriangleAlert className="h-4 w-4" /><AlertDescription>Growth brand settings are unavailable. The preview uses a safe template and the restaurant profile logo when available.</AlertDescription></Alert>
              )}
              <div className="space-y-2">
                <Label>Language</Label>
                <Select value={language} disabled={isReadOnly} onValueChange={(value) => { setLanguage(value as GrowthLanguage); setCopyCustomized(false); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="en">English</SelectItem><SelectItem value="ne">Nepali</SelectItem><SelectItem value="ne_romanized">Romanized Nepali</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Approved {channel === "email" ? "email" : "WhatsApp image"} template</Label>
                <Select
                  value={selectedMessageTemplateId}
                  disabled={isReadOnly || templatesLoading || approvedMessageTemplates.length === 0}
                  onValueChange={setSelectedMessageTemplateId}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={templatesLoading ? "Loading approved templates…" : "No approved template"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {approvedMessageTemplates.map((template) => (
                      <SelectItem key={template.id} value={String(template.id)}>
                        {template.key} · {template.provider_template_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedMessageTemplate && (
                  <p className="text-xs leading-5 text-muted-foreground">
                    Provider-approved template. Variables: {selectedMessageTemplate.variable_names.length ? selectedMessageTemplate.variable_names.join(", ") : "none"}.
                  </p>
                )}
              </div>
              {templatesError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{templatesError}</AlertDescription>
                </Alert>
              )}
              {!templatesLoading && !templatesError && approvedMessageTemplates.length === 0 && (
                <Alert className="rounded-xl border border-border bg-card">
                  <TriangleAlert className="h-4 w-4" />
                  <AlertDescription>
                    No provider-approved {channel === "email" ? "email" : "image WhatsApp"} template matches {languageLabel(language)}. You can save a draft, but Yummy will not submit this campaign for review until one is available.
                  </AlertDescription>
                </Alert>
              )}
              {channel === "email" ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="email-subject">Email subject</Label>
                    <Input id="email-subject" value={emailSubject} maxLength={255} disabled={isReadOnly} onChange={(event) => { setEmailSubject(event.target.value); setCopyCustomized(true); }} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email-body">Email body (HTML)</Label>
                    <Textarea id="email-body" value={emailBodyHtml} maxLength={20000} rows={12} disabled={isReadOnly} onChange={(event) => { setEmailBodyHtml(event.target.value); setCopyCustomized(true); }} />
                    <div className="flex justify-between text-xs text-muted-foreground"><span><code>{"{{customer_name}}"}</code> is personalized per recipient.</span><span>{emailBodyHtml.length}/20000</span></div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email-terms">Visible terms</Label>
                    <Textarea id="email-terms" value={terms} maxLength={240} rows={3} disabled={isReadOnly} onChange={(event) => setTerms(event.target.value)} />
                    <p className="text-xs text-muted-foreground">Shown in the poster-style email preview when &quot;Use poster template&quot; is enabled below.</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="poster-headline">Poster headline</Label>
                    <Input id="poster-headline" value={headline} maxLength={90} disabled={isReadOnly} onChange={(event) => { setHeadline(event.target.value); setCopyCustomized(true); }} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="whatsapp-message">WhatsApp message</Label>
                    <Textarea id="whatsapp-message" value={message} maxLength={1024} rows={7} disabled={isReadOnly} onChange={(event) => { setMessage(event.target.value); setCopyCustomized(true); }} />
                    <div className="flex justify-between text-xs text-muted-foreground"><span><code>{"{{customer_name}}"}</code> is personalized by the backend template.</span><span>{message.length}/1024</span></div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="poster-terms">Visible terms</Label>
                    <Textarea id="poster-terms" value={terms} maxLength={240} rows={3} disabled={isReadOnly} onChange={(event) => setTerms(event.target.value)} />
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {channel === "email" ? (
            <EmailPreview
              subject={emailSubject}
              bodyHtml={emailBodyHtml}
              usePosterTemplate={useEmailPoster}
              template={emailPosterTemplate}
              offer={emailPreviewOffer}
              terms={terms}
              restaurantName={restaurantName}
              logoUrl={brand?.logo_url || getImageUrl(restaurant?.profile_picture || "")}
              primaryColor={brand?.primary_color || undefined}
              contactText={brand?.approved_contact_text || undefined}
              footerText={brand?.approved_footer_text || undefined}
              couponCode={PREVIEW_COUPON_CODE}
              showWarning={true}
              posterDataUrl={posterDataUrl || undefined}
              isReadOnly={isReadOnly}
              onUsePosterTemplateChange={setUseEmailPoster}
              onTemplateChange={setEmailPosterTemplate}
            />
          ) : (
            <Card>
              <CardHeader><div className="flex items-center justify-between gap-3"><div><CardTitle>WhatsApp-square preview</CardTitle><CardDescription>Template-based 1:1 artwork.</CardDescription></div><Button variant="outline" onClick={() => void exportPoster()} disabled={exportingPoster}>{exportingPoster ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}Export PNG</Button></div></CardHeader>
              <CardContent className="space-y-5">
                {USE_FABRIC_EDITOR ? (
                  <>
                    <Alert className="rounded-xl border border-emerald-200 bg-emerald-50">
                      <Sparkles className="h-4 w-4 text-emerald-600" />
                      <AlertTitle className="text-emerald-900">New Fabric.js Editor (Phase 1)</AlertTitle>
                      <AlertDescription className="text-emerald-800">
                        The new Canva-like poster editor is active. This is a preview-only foundation. Full template migration happens in Phase 2.
                      </AlertDescription>
                    </Alert>
                    <div className="w-full">
                      <PosterEditorClient
                        templateConfig={{
                          restaurantName: restaurantName,
                          logoUrl: brand?.logo_url || getImageUrl(restaurant?.profile_picture || ""),
                          primaryColor: brand?.primary_color || "#047857",
                          secondaryColor: "#10b981",
                          headline: headline,
                          offerLabel: formatCampaignOffer(offer),
                          expiresOn: offer.valid_until || "",
                          terms: terms,
                        }}
                        onExport={(blob) => {
                          const anchor = document.createElement("a");
                          const objectUrl = URL.createObjectURL(blob);
                          anchor.href = objectUrl;
                          anchor.download = `${safeFilename(campaignName)}-fabric-poster.png`;
                          anchor.click();
                          URL.revokeObjectURL(objectUrl);
                          toast.success("Fabric poster exported locally.");
                        }}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-full flex justify-center">
                      {poster}
                    </div>
                    <div className="flex items-center gap-4">
                      <Label className="whitespace-nowrap font-semibold">Poster template</Label>
                      <Select value={posterTemplate} disabled={isReadOnly} onValueChange={(value) => setPosterTemplate(value as CampaignPosterTemplate)}>
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Choose a template" />
                        </SelectTrigger>
                        <SelectContent>
                          <div className="px-2 pb-2">
                            <input
                              type="text"
                              placeholder="Search templates..."
                              className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                              onChange={(e) => {
                                const search = e.target.value.toLowerCase();
                                const items = e.target.closest('[role="listbox"]')?.querySelectorAll('[role="option"]');
                                items?.forEach((item) => {
                                  const text = item.textContent?.toLowerCase() || '';
                                  (item as HTMLElement).style.display = text.includes(search) ? '' : 'none';
                                });
                              }}
                              onKeyDown={(e) => e.stopPropagation()}
                            />
                          </div>
                          {(["vibrant", "fresh", "warm", "modern", "luxury", "elegant", "bold", "minimal", "ticket", "grid", "sunset", "ocean", "forest", "royal", "neon", "pastel", "midnight", "coral", "mint", "crimson", "slate", "amber", "teal", "lavender", "rose", "emerald", "sapphire", "bronze", "ruby", "platinum", "gold", "minimalist", "geometric", "artistic", "expressive", "maximalist"] as CampaignPosterTemplate[]).map((template) => (
                            <SelectItem key={template} value={template} className="capitalize">
                              {template}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        {templateColors[posterTemplate] ? (
                          <span className="flex items-center gap-2">
                            <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: templateColors[posterTemplate].primary }} />
                            <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: templateColors[posterTemplate].secondary }} />
                            <span className="capitalize">{posterTemplate} template</span>
                          </span>
                        ) : null}
                      </p>
                    </div>
                    <p className="text-xs leading-5 text-muted-foreground">Copy suggestions are drafts only. On review submission, Yummy renders this preview as PNG, uploads it to the campaign-scoped media folder, and attaches it to the draft before creating the review candidate.</p>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {step === 4 && (
        <div className="grid gap-6 xl:grid-cols-[1fr_0.72fr] overflow-x-hidden pb-8">
          <div className="space-y-5 min-w-0">
            <Card>
              <CardHeader>
                <CardTitle>Campaign Summary</CardTitle>
                <CardDescription>Review your campaign before submitting</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Campaign Type</p>
                    <p className="text-xl font-bold">{playbook.shortTitle}</p>
                    <p className="text-sm text-muted-foreground">{playbook.audienceLabel}</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Who Will Receive</p>
                    <p className="text-3xl font-bold tabular-nums">{audience ? audience.included_count.toLocaleString("en-NP") : "..."}</p>
                    <p className="text-sm text-muted-foreground">customers</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Offer</p>
                    <p className="text-lg font-bold">{formatCampaignOffer(offer)}</p>
                    <p className="text-sm text-muted-foreground">Max cost: {formatMoney(offerValidation.maximum_exposure)}</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Language & Channel</p>
                    <p className="text-lg font-bold">{languageLabel(language)} · {channel === "email" ? "Email" : "WhatsApp"}</p>
                    <p className="text-sm text-muted-foreground">{channel === "email" ? selectedMessageTemplate?.key || "No template" : `${posterTemplate} poster`}</p>
                  </div>
                </div>

                <div className="border-t pt-6 space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Message Preview</p>
                  {channel === "email" ? (
                    <div className="space-y-2">
                      <p className="text-base font-semibold">{emailSubject}</p>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{emailBodyHtml}</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-base font-semibold">{headline}</p>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{message}</p>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  {CAMPAIGN_REVIEW_CAVEATS.map((caveat) => (
                    <div key={caveat} className="flex items-start gap-3 rounded-lg bg-muted/40 p-3.5 text-sm leading-relaxed">
                      <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span className="text-muted-foreground">{caveat}</span>
                    </div>
                  ))}
                </div>

                {!isReadOnly && (
                  <Label htmlFor="review-acceptance" className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-4 hover:bg-muted/20 transition-colors">
                    <Checkbox id="review-acceptance" checked={reviewAccepted} onCheckedChange={(checked) => setReviewAccepted(checked === true)} />
                    <span className="space-y-1">
                      <span className="block font-semibold text-sm">I understand this sends the campaign for approval</span>
                      <span className="block text-sm text-muted-foreground">This does NOT send messages to customers. A manager must approve first.</span>
                    </span>
                  </Label>
                )}
              </CardContent>
            </Card>

            {!isReadOnly ? (
              <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between relative z-10 bg-background">
                <Button variant="outline" onClick={() => changeStep(3)}>
                  <ChevronLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <div className="flex flex-col sm:flex-row gap-2">
                  {actionPolicy.can_save_draft && (
                    <Button variant="outline" disabled={saving || submittingReview} onClick={() => void persistDraft()}>
                      {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                      Save draft
                    </Button>
                  )}
                  {actionPolicy.can_submit_for_review && (
                    <Button 
                      disabled={saving || submittingReview || templatesLoading || !selectedMessageTemplate || !reviewAccepted || !audience || audience.included_count <= 0} 
                      onClick={() => void submitForReview()}
                    >
                      {submittingReview ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileCheck2 className="mr-2 h-4 w-4" />}
                      Submit for review
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <Button asChild>
                <Link href="/grow" onClick={() => resetDraft()}>Return to Grow overview</Link>
              </Button>
            )}
          </div>

          {channel === "email" ? (
            <Card className="h-fit">
              <CardHeader><CardTitle>Email review</CardTitle><CardDescription>This copy becomes immutable once submitted for review.</CardDescription></CardHeader>
              <CardContent>
                <EmailPreview
                  subject={emailSubject}
                  bodyHtml={emailBodyHtml}
                  usePosterTemplate={useEmailPoster}
                  template={emailPosterTemplate}
                  offer={emailPreviewOffer}
                  terms={terms}
                  restaurantName={restaurantName}
                  logoUrl={brand?.logo_url || getImageUrl(restaurant?.profile_picture || "")}
                  primaryColor={brand?.primary_color || undefined}
                  contactText={brand?.approved_contact_text || undefined}
                  footerText={brand?.approved_footer_text || undefined}
                  couponCode={PREVIEW_COUPON_CODE}
                  showWarning={false}
                  posterDataUrl={posterDataUrl || undefined}
                  isReadOnly={isReadOnly}
                  onUsePosterTemplateChange={setUseEmailPoster}
                  onTemplateChange={setEmailPosterTemplate}
                />
              </CardContent>
            </Card>
          ) : (
            <Card className="h-fit">
              <CardHeader><div className="flex items-center justify-between gap-2"><div><CardTitle>Poster review</CardTitle><CardDescription>Uploaded only when you submit this draft for review.</CardDescription></div><Button variant="outline" size="sm" onClick={() => void exportPoster()} disabled={exportingPoster}>{exportingPoster ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}Export</Button></div></CardHeader>
              <CardContent>
                <div className="w-full flex justify-center">
                  {poster}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {!isReadOnly && step < 4 && (
        <div className="flex items-center justify-between border-t pt-5">
          <Button variant="outline" disabled={step === 1} onClick={() => changeStep((step - 1) as StudioStep)}><ChevronLeft className="mr-2 h-4 w-4" />Back</Button>
          <div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex"><Eye className="h-4 w-4" />Nothing is saved until you choose Save draft or Submit for manual review.</div>
          <Button onClick={continueFromCurrentStep}>Continue<ArrowRight className="ml-2 h-4 w-4" /></Button>
        </div>
      )}
    </div>
  );
}
