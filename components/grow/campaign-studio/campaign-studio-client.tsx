"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
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
  MessageSquareText,
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
  GrowthOpportunitySummary,
  GrowthPlaybookCode,
  GrowthSegmentPreview,
  GrowthSettings,
  GrowthSmsEstimate,
  GrowthSmsTemplate,
  GrowthSmsWallet,
} from "@/lib/api/growth-types";
import { getApiErrorMessage } from "@/lib/api-error-message";
import {
  buildCampaignCreateInput,
  approvedTemplatesForLanguageAndChannel,
  CAMPAIGN_PLAYBOOKS,
  CAMPAIGN_REVIEW_CAVEATS,
  campaignRecommendationHref,
  campaignStudioActionPolicy,
  deterministicCampaignCopy,
  formatCampaignOffer,
  getCampaignPlaybook,
  getSmartCampaignSuggestion,
  PREVIEW_COUPON_CODE,
  recommendedCampaignChannel,
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
  { step: 1, title: "Choose customers", shortTitle: "Customers", icon: Target },
  { step: 2, title: "Create the offer", shortTitle: "Offer", icon: WalletCards },
  { step: 3, title: "Prepare the message", shortTitle: "Message", icon: ImageIcon },
  { step: 4, title: "Review and continue", shortTitle: "Review", icon: FileCheck2 },
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

function audienceBlockerGuidance(
  exclusions: Record<string, number>,
  channel: GrowthChannelCode,
): string {
  if (channel === "sms" && (exclusions.missing_valid_e164 || exclusions.no_phone || exclusions.invalid_phone)) {
    return "Add a valid customer phone number before sending a text offer.";
  }
  if (channel === "email" && (exclusions.missing_valid_email || exclusions.no_email || exclusions.invalid_email)) {
    return "Collect a valid customer email. Customers who sign in to Yummy Menu can add one to their restaurant profile.";
  }
  if (exclusions.marketing_consent_missing || exclusions.marketing_opted_out) {
    return `Customers must enable ${channel === "sms" ? "SMS" : "Email"} offers in Yummy Menu before they can receive marketing.`;
  }
  if (exclusions.frequency_capped) {
    return "These customers recently received a promotion. Wait for the window to end or change the restaurant limit in Grow settings.";
  }
  if (exclusions.different_segment || exclusions.segment_rule_not_met) {
    return "Choose a playbook that matches current customer order activity, or wait until customers qualify.";
  }
  return "Refresh the audience after customer contact details, consent, or order activity changes.";
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
  const searchParams = useSearchParams();
  const restaurant = useRestaurant((state) => state.restaurant);
  const restaurantName = restaurant?.name || "Your restaurant";
  const hydrated = useCampaignStudioHydrated();
  const smartSuggestion = getSmartCampaignSuggestion(searchParams.get("signal"));
  const isFavouriteItemSuggestion = searchParams.get("personalization") === "favourite_item";

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
  const selectedSmsTemplateCode = useCampaignStudio((state) => state.selectedSmsTemplateCode);
  const emailSubject = useCampaignStudio((state) => state.emailSubject);
  const emailBodyHtml = useCampaignStudio((state) => state.emailBodyHtml);
  const reviewAccepted = useCampaignStudio((state) => state.reviewAccepted);
  const customAudienceAll = useCampaignStudio((state) => state.customAudienceAll);
  const audienceCustomerIds = useCampaignStudio((state) => state.audienceCustomerIds);
  const patchDraft = useCampaignStudio((state) => state.patch);
  const setStep = useCampaignStudio((state) => state.setStep);
  const setFurthestStep = useCampaignStudio((state) => state.setFurthestStep);
  const resetDraft = useCampaignStudio((state) => state.reset);
  const appliedGoalRef = useRef<string | null>(null);

  useEffect(() => {
    if (!hydrated) return;
    const requestedGoal = searchParams.get("goal") as GrowthPlaybookCode | null;
    const requestedSignal = searchParams.get("signal") || "";
    const requestKey = `${requestedGoal || ""}:${requestedSignal}:${searchParams.get("channel") || ""}:${searchParams.get("customers") || ""}`;
    if (
      !requestedGoal ||
      appliedGoalRef.current === requestKey ||
      !["second_visit", "win_back", "slow_day", "custom"].includes(requestedGoal)
    ) return;
    appliedGoalRef.current = requestKey;
    patchDraft("playbookCode", requestedGoal);
    if (requestedGoal === "custom") {
      const selectedCustomers = (searchParams.get("customers") || "")
        .split(",")
        .map((value) => Number.parseInt(value, 10))
        .filter((value) => Number.isSafeInteger(value) && value > 0)
        .slice(0, 500);
      patchDraft("customAudienceAll", selectedCustomers.length === 0);
      patchDraft("audienceCustomerIds", selectedCustomers);
      if (smartSuggestion && selectedCustomers.length) {
        patchDraft("offer", { ...offer, redemption_limit: selectedCustomers.length });
      }
    }
    if (isFavouriteItemSuggestion || smartSuggestion) {
      patchDraft("copyCustomized", false);
    }
    const requestedChannel = searchParams.get("channel");
    if (requestedChannel === "email" || requestedChannel === "sms") {
      patchDraft("channel", requestedChannel);
      patchDraft("selectedMessageTemplateId", "");
      patchDraft("selectedSmsTemplateCode", "");
    }
    setStep(1);
    setFurthestStep(1);
    if (!nameCustomized) {
      patchDraft("campaignName", smartSuggestion?.title || searchParams.get("name") || getCampaignPlaybook(requestedGoal).title);
    }
  }, [hydrated, isFavouriteItemSuggestion, nameCustomized, offer, patchDraft, searchParams, setFurthestStep, setStep, smartSuggestion]);

  const setPlaybookCode = (value: GrowthPlaybookCode) => patchDraft("playbookCode", value);
  const setChannel = (value: GrowthChannelCode) => {
    const activeValue: GrowthChannelCode = value === "whatsapp" ? "email" : value;
    patchDraft("channel", activeValue);
    patchDraft("selectedMessageTemplateId", "");
    patchDraft("selectedSmsTemplateCode", "");
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
  const setSelectedSmsTemplateCode = (value: string) =>
    patchDraft("selectedSmsTemplateCode", value);
  const setEmailSubject = (value: string) => patchDraft("emailSubject", value);
  const setEmailBodyHtml = (value: string) => patchDraft("emailBodyHtml", value);
  const setReviewAccepted = (value: boolean) => patchDraft("reviewAccepted", value);
  const setCustomAudienceAll = (value: boolean) => patchDraft("customAudienceAll", value);
  const setAudienceCustomerIds = (value: number[]) => patchDraft("audienceCustomerIds", value);

  const [brand, setBrand] = useState<GrowthBrandProfile | null>(null);
  const [brandUnavailable, setBrandUnavailable] = useState(false);
  const [messageTemplates, setMessageTemplates] = useState<GrowthMessageTemplate[]>([]);
  const [smsTemplates, setSmsTemplates] = useState<GrowthSmsTemplate[]>([]);
  const [smsTemplatesLoading, setSmsTemplatesLoading] = useState(true);
  const [smsTemplatesError, setSmsTemplatesError] = useState<string | null>(null);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [audience, setAudience] = useState<GrowthSegmentPreview | null>(null);
  const [audienceLoading, setAudienceLoading] = useState(false);
  const [audienceError, setAudienceError] = useState<string | null>(null);
  const [customCandidates, setCustomCandidates] = useState<NonNullable<GrowthSegmentPreview["customers"]>>([]);
  const [recommendations, setRecommendations] = useState<GrowthOpportunitySummary[]>([]);
  const [recommendationsLoading, setRecommendationsLoading] = useState(true);
  const [showAllRecommendations, setShowAllRecommendations] = useState(false);
  const [growthSettings, setGrowthSettings] = useState<GrowthSettings | null>(null);
  const [savedCampaign, setSavedCampaign] = useState<GrowthCampaign | null>(null);
  const [saving, setSaving] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [suggestingCopy, setSuggestingCopy] = useState(false);
  const [exportingPoster, setExportingPoster] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [posterDataUrl, setPosterDataUrl] = useState<string | null>(null);
  const [smsEstimate, setSmsEstimate] = useState<GrowthSmsEstimate | null>(null);
  const [smsWallet, setSmsWallet] = useState<GrowthSmsWallet | null>(null);
  const audienceRequestRef = useRef(0);
  const posterRef = useRef<HTMLDivElement>(null);
  const exportPosterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (channel === "whatsapp") setChannel("email");
  }, [channel]);

  const playbook = useMemo(
    () => getCampaignPlaybook(playbookCode),
    [playbookCode],
  );
  const offerValidation = useMemo(
    () => validateCampaignOffer(offer),
    [offer],
  );
  const smsCreditsNeeded = smsEstimate?.required_credits ?? 0;
  const smsCreditsAvailable = smsWallet?.available_credits ?? null;
  const smsCreditShortfall = smsCreditsAvailable === null
    ? null
    : Math.max(0, smsCreditsNeeded - smsCreditsAvailable);
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
  const selectedSmsTemplate = useMemo(
    () => smsTemplates.find((template) => template.code === selectedSmsTemplateCode) ?? null,
    [selectedSmsTemplateCode, smsTemplates],
  );

  const starterCopy = useMemo(
    () => {
      const copy = deterministicCampaignCopy({
        restaurantName,
        playbookCode,
        language,
        offer,
        channel,
      });
      if (smartSuggestion && channel === "email") {
        return {
          headline: smartSuggestion.emailCopy.headline,
          message: smartSuggestion.emailCopy.message(
            restaurantName,
            formatCampaignOffer(offer),
            offer.valid_until,
          ),
        };
      }
      if (!isFavouriteItemSuggestion || channel !== "email") return copy;
      return {
        headline: `A favourite is waiting at ${restaurantName}`,
        message: `Hi {{customer_name}}, your favourite, {{favourite_item}}, is waiting at ${restaurantName}. ${copy.message}`,
      };
    },
    [channel, isFavouriteItemSuggestion, language, offer, playbookCode, restaurantName, smartSuggestion],
  );

  useEffect(() => {
    if (channel === "sms") return;
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
    if (channel !== "sms" || !selectedSmsTemplate) return;
    setMessage(selectedSmsTemplate.message_body);
  }, [channel, selectedSmsTemplate]);

  useEffect(() => {
    if (!nameCustomized) {
      setCampaignName(smartSuggestion?.title || `${playbook.shortTitle} offer`);
    }
  }, [nameCustomized, playbook.shortTitle, smartSuggestion]);

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
    if (channel === "sms") {
      setMessageTemplates([]);
      setTemplatesError(null);
      setTemplatesLoading(false);
      return () => { active = false; };
    }
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
            `Approved email templates could not be loaded. Review submission is disabled.`,
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
    let active = true;
    setSmsTemplatesLoading(true);
    setSmsTemplatesError(null);
    growthApi
      .listSmsTemplates()
      .then((result) => {
        if (active) setSmsTemplates(result);
      })
      .catch(() => {
        if (!active) return;
        setSmsTemplates([]);
        setSmsTemplatesError("Yummy SMS templates could not be loaded.");
      })
      .finally(() => {
        if (active) setSmsTemplatesLoading(false);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    growthApi.getSettings().then((result) => {
      if (active) setGrowthSettings(result);
    }).catch(() => {
      if (active) setGrowthSettings(null);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    // Recalculate signals when opening the studio. A favourite-item signal is
    // derived from newly completed orders, so a cached/stale opportunity list
    // must not hide it until the overview is manually refreshed.
    growthApi
      .refreshOpportunities()
      .catch(() => growthApi.listOpportunities())
      .then((result) => {
        if (active) setRecommendations(result);
      })
      .catch(() => {
        if (active) setRecommendations([]);
      })
      .finally(() => {
        if (active) setRecommendationsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const recommendedAudiences = useMemo(
    () => recommendations
      .filter((opportunity) =>
        opportunity.status !== "dismissed" &&
        opportunity.status !== "converted" &&
        opportunity.status !== "expired",
      ),
    [recommendations],
  );
  const visibleRecommendedAudiences = useMemo(
    () => showAllRecommendations
      ? recommendedAudiences
      : recommendedAudiences.slice(0, 3),
    [recommendedAudiences, showAllRecommendations],
  );
  const hasFavouriteItemRecommendation = recommendedAudiences.some(
    (opportunity) => opportunity.id === "signal:favourite_items",
  );

  useEffect(() => {
    if (channel !== "sms" || smsTemplatesLoading) return;
    if (isFavouriteItemSuggestion) {
      const favouriteTemplate = smsTemplates.find((template) => template.code === "favourite_item_offer");
      if (favouriteTemplate && selectedSmsTemplateCode !== favouriteTemplate.code) {
        setSelectedSmsTemplateCode(favouriteTemplate.code);
      }
      return;
    }
    const valid = smsTemplates.some((template) => template.code === selectedSmsTemplateCode);
    if (!valid) setSelectedSmsTemplateCode(smsTemplates[0]?.code ?? "");
  }, [channel, isFavouriteItemSuggestion, selectedSmsTemplateCode, smsTemplates, smsTemplatesLoading]);

  useEffect(() => {
    if (channel !== "sms" || message.trim().length === 0) {
      setSmsEstimate(null);
      return;
    }
    let active = true;
    const timer = window.setTimeout(() => {
      Promise.allSettled([
        growthApi.estimateSms(message.trim(), audience?.included_count ?? 0),
        growthApi.getSmsWallet(),
      ]).then(([estimateResult, walletResult]) => {
        if (active) {
          setSmsEstimate(estimateResult.status === "fulfilled" ? estimateResult.value : null);
          setSmsWallet(walletResult.status === "fulfilled" ? walletResult.value : null);
        }
      }).catch(() => {
        if (active) {
          setSmsEstimate(null);
          setSmsWallet(null);
        }
      });
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [audience?.included_count, channel, message]);

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
      let result: GrowthSegmentPreview;
      if (playbook.code === "custom") {
        const pool = await growthApi.previewSegment("all", channel);
        if (requestId === audienceRequestRef.current) setCustomCandidates(pool.customers ?? []);
        const eligibleIds = new Set((pool.customers ?? []).map((customer) => Number(customer.id)));
        const validSelectedIds = audienceCustomerIds.filter((id) => eligibleIds.has(id));
        if (validSelectedIds.length !== audienceCustomerIds.length) {
          patchDraft("audienceCustomerIds", validSelectedIds);
        }
        result = customAudienceAll
          ? pool
          : await growthApi.previewSegment("all", channel, validSelectedIds);
      } else {
        setCustomCandidates([]);
        result = await growthApi.previewSegment(playbook.segment, channel);
      }
      if (requestId === audienceRequestRef.current) setAudience(result);
    } catch (error) {
      if (requestId === audienceRequestRef.current) {
        setAudienceError(
          getApiErrorMessage(
            error,
            "Customers could not be checked right now. You can continue editing, but must try again before requesting approval.",
          ),
        );
      }
    } finally {
      if (requestId === audienceRequestRef.current) setAudienceLoading(false);
    }
  }, [audienceCustomerIds, channel, customAudienceAll, patchDraft, playbook.code, playbook.segment]);

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
    if (step === 1 && playbookCode === "custom" && !customAudienceAll && !audienceCustomerIds.length) {
      setPageError("Select at least one eligible customer, or choose all eligible subscribers.");
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
        if (isFavouriteItemSuggestion && !emailBodyHtml.includes("{{favourite_item}}")) {
          setPageError("Keep {{favourite_item}} in the email so each customer receives their own favourite-item message.");
          return;
        }
      } else if (!selectedSmsTemplate) {
        setPageError("Choose a Yummy SMS template before review.");
        return;
      } else if (isFavouriteItemSuggestion && selectedSmsTemplate.code !== "favourite_item_offer") {
        setPageError("Choose the Favourite item offer SMS template so every customer receives their own favourite item.");
        return;
      }
      if (channel !== "sms" && !selectedMessageTemplate) {
        setPageError(
          `No approved email style is available in ${languageLabel(language)}. Save the draft and contact Yummy support.`,
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
      smsTemplateCode: selectedSmsTemplateCode,
      emailSubject,
      emailBodyHtml,
      emailTemplate: emailPosterTemplate,
      personalizationKind: isFavouriteItemSuggestion ? "favourite_item" : undefined,
      audienceCustomerIds: customAudienceAll ? [] : audienceCustomerIds,
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
        : Boolean(selectedSmsTemplate);
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
             sms_template_code: channel === "sms" ? selectedSmsTemplateCode : undefined,
             email_subject: channel === "email" ? emailSubject.trim() : undefined,
             email_body_html: channel === "email" ? emailBodyHtml.trim() : undefined,
             email_template: channel === "email" ? emailPosterTemplate : undefined,
             personalization_kind: isFavouriteItemSuggestion ? "favourite_item" : undefined,
             audience_customer_ids:
               playbookCode === "custom"
                 ? (customAudienceAll ? [] : audienceCustomerIds)
                 : [],
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
      setPageError("Confirm that the campaign details are ready for manager approval.");
      return;
    }
    if (!audience || audience.included_count <= 0) {
      setPageError("At least 1 customer must be able to receive this campaign before approval.");
      return;
    }
    const contentReady =
      channel === "email"
        ? emailSubject.trim().length >= 3 && emailBodyHtml.trim().length >= 12
        : Boolean(selectedSmsTemplate);
    if (!offerValidation.valid || !contentReady) {
      setPageError("Offer or message validation is incomplete.");
      return;
    }
    if (channel !== "sms" && !selectedMessageTemplate) {
      setPageError(
        `No approved email style is available in ${languageLabel(language)}. The campaign remains a draft.`,
      );
      return;
    }

    setSubmittingReview(true);
    try {
      const draft = await persistDraft(false);
      if (!draft) return;
      const reviewed = await growthApi.submitCampaignForReview(draft.id);
      setSavedCampaign(reviewed);
      toast.success(
        "Campaign sent for manager approval. No messages have been scheduled or sent.",
      );
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
    if (channel === "sms") return;
    if (smartSuggestion) {
      if (channel === "email") {
        setEmailSubject(starterCopy.headline);
        setEmailBodyHtml(starterCopy.message);
      }
      setCopyCustomized(true);
      toast.success("Points reminder copy applied. Review it before submission.");
      return;
    }
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
      anchor.download = `${safeFilename(campaignName)}-campaign-poster.png`;
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
    <main className="mx-auto flex w-full max-w-[1500px] flex-col gap-6 overflow-x-hidden px-4 pb-32">
      {/* Header */}
      <header className="flex flex-col gap-4 border-b border-border pb-6 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3 mb-2">
            <Link href="/grow" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-primary focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <ArrowLeft aria-hidden="true" className="h-4 w-4" />
              Grow
            </Link>
          </div>
          <h1 className="text-pretty text-3xl font-black tracking-tight">Create a Campaign</h1>
          <p className="text-sm text-muted-foreground">
            Choose customers, build an offer, prepare the message, and send it for approval.
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
      </header>

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
                    "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
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
                    <span className="block text-[10px] font-medium opacity-70">
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
                    aria-hidden="true"
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
          <AlertTitle>Sent for approval</AlertTitle>
          <AlertDescription>
            This campaign cannot be edited while it waits for a manager. No messages have been scheduled or sent.
          </AlertDescription>
        </Alert>
      )}

      {step === 1 && (
        <div className="grid gap-8 xl:grid-cols-[1.05fr_0.95fr] overflow-x-hidden">
          <Card className="rounded-xl border border-border bg-card transition-all hover:shadow-md">
            <CardHeader className="space-y-3">
              <CardTitle className="text-xl">What do you want this campaign to do?</CardTitle>
              <CardDescription className="text-sm">Start with a recommendation, choose a campaign goal, or select customers yourself.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <section className="space-y-3" aria-labelledby="recommended-audiences-title">
                <div>
                  <h3 id="recommended-audiences-title" className="text-sm font-bold">Recommended audiences</h3>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">Based on completed customer activity and current delivery permission.</p>
                </div>
                {recommendationsLoading ? (
                  <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-3 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />Finding suitable audiences…
                  </div>
                ) : recommendedAudiences.length ? (
                  <div className="space-y-2">
                    {visibleRecommendedAudiences.map((opportunity) => {
                      const recommendedChannel = recommendedCampaignChannel(opportunity, growthSettings);
                      const canReceiveNow = opportunity.eligible_customer_count > 0;
                      return (
                        <div key={String(opportunity.id)} className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
                          <div className="min-w-0">
                            <p className="font-semibold leading-5">{opportunity.title}</p>
                            <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{opportunity.explanation || "A customer group is ready for a relevant offer."}</p>
                            <p className={cn("mt-1 text-xs font-medium", canReceiveNow ? "text-primary" : "text-muted-foreground")}>
                              {canReceiveNow
                                ? `${opportunity.eligible_customer_count.toLocaleString("en-NP")} can receive it · ${recommendedChannel.toUpperCase()}`
                                : "Matches found · no customer can receive it right now"}
                            </p>
                          </div>
                          {isReadOnly || !canReceiveNow ? (
                            <Button size="sm" variant="outline" disabled className="shrink-0">{canReceiveNow ? "Use" : "Not ready"}</Button>
                          ) : (
                            <Button asChild size="sm" variant="outline" className="shrink-0">
                              <Link href={campaignRecommendationHref(opportunity, recommendedChannel)}>Use</Link>
                            </Button>
                          )}
                        </div>
                      );
                    })}
                    {recommendedAudiences.length > 3 && (
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        className="h-auto px-0 text-primary"
                        onClick={() => setShowAllRecommendations((current) => !current)}
                        aria-expanded={showAllRecommendations}
                      >
                        {showAllRecommendations
                          ? "Show fewer suggestions"
                          : `View all ${recommendedAudiences.length} suggestions`}
                      </Button>
                    )}
                    {!hasFavouriteItemRecommendation && (
                      <p className="pt-1 text-xs leading-5 text-muted-foreground">
                        Favourite-item suggestions appear after the same menu item is on 2 completed orders for the same customer in the last 90 days.
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="rounded-xl border border-dashed border-border px-3 py-3 text-sm text-muted-foreground">No data-backed recommendation yet. Choose a campaign goal or create your own audience below.</p>
                )}
              </section>

              <div className="space-y-2">
                <Label>Delivery channel</Label>
                <RadioGroup
                  value={channel}
                  onValueChange={(value) => setChannel(value as GrowthChannelCode)}
                  className="grid gap-3 sm:grid-cols-2"
                  disabled={isReadOnly}
                >
                  <Label
                    htmlFor="channel-sms"
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-xl border border-border p-4",
                      channel === "sms" && "border-primary bg-primary/5",
                    )}
                  >
                    <RadioGroupItem id="channel-sms" value="sms" />
                    <span>
                      <span className="block font-bold">SMS</span>
                      <span className="text-xs font-normal text-muted-foreground">Text message + credit estimate</span>
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
                      <span className="text-xs font-normal text-muted-foreground">Email subject and message</span>
                    </span>
                  </Label>
                </RadioGroup>
              </div>

              <section className="space-y-3" aria-labelledby="campaign-goals-title">
                <div>
                  <h3 id="campaign-goals-title" className="text-sm font-bold">Campaign goals</h3>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">Use a simple, proven goal when you do not need a tailored audience.</p>
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
                {CAMPAIGN_PLAYBOOKS.filter((item) => item.code !== "custom").map((item) => (
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
              </section>

              <section className="space-y-3 border-t border-border pt-5" aria-labelledby="manual-audience-title">
                <div>
                  <h3 id="manual-audience-title" className="text-sm font-bold">Choose customers yourself</h3>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">Send an offer to everyone eligible, or select the people you want to reach.</p>
                </div>
                <button
                  type="button"
                  aria-pressed={playbookCode === "custom"}
                  disabled={isReadOnly}
                  onClick={() => {
                    setPlaybookCode("custom");
                    setReviewAccepted(false);
                  }}
                  className={cn(
                    "flex w-full items-start gap-4 rounded-2xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60",
                    playbookCode === "custom" && "border-primary bg-primary/5",
                  )}
                >
                  <Users aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <span>
                    <span className="block font-bold">Choose your audience</span>
                    <span className="mt-1 block text-sm font-normal leading-5 text-muted-foreground">Reach everyone eligible, or select specific customers yourself.</span>
                  </span>
                </button>
              </section>

              {playbookCode === "custom" && (
                <div className="space-y-3 border-t border-border pt-5">
                  {smartSuggestion && !isFavouriteItemSuggestion && (
                    <Alert className="border-primary/30 bg-primary/5">
                      <Sparkles aria-hidden="true" className="h-4 w-4 text-primary" />
                      <AlertTitle>{smartSuggestion.title}</AlertTitle>
                      <AlertDescription>{smartSuggestion.audienceExplanation}</AlertDescription>
                    </Alert>
                  )}
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="custom-audience-all"
                      checked={customAudienceAll}
                      disabled={isReadOnly}
                      onCheckedChange={(checked) => {
                        setCustomAudienceAll(checked === true);
                        setReviewAccepted(false);
                      }}
                    />
                    <Label htmlFor="custom-audience-all" className="cursor-pointer leading-5">
                      <span className="block font-bold">Everyone Who Can Receive It</span>
                      <span className="text-xs font-normal text-muted-foreground">
                        Includes everyone who currently passes consent and contact checks.
                      </span>
                    </Label>
                  </div>
                  {!customAudienceAll && (
                    <fieldset className="space-y-2" disabled={isReadOnly}>
                      <legend className="text-sm font-bold">Select customers</legend>
                      {customCandidates.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No customers can receive offers through this channel yet.</p>
                      ) : (
                        <div className="max-h-64 divide-y divide-border overflow-y-auto rounded-xl border border-border">
                          {customCandidates.map((customer) => {
                            const id = Number(customer.id);
                            const checked = audienceCustomerIds.includes(id);
                            return (
                              <Label
                                key={id}
                                htmlFor={`audience-customer-${id}`}
                                className="flex cursor-pointer items-center gap-3 px-3 py-3 [contain-intrinsic-size:0_48px] [content-visibility:auto]"
                              >
                                <Checkbox
                                  id={`audience-customer-${id}`}
                                  checked={checked}
                                  onCheckedChange={(value) => {
                                    setAudienceCustomerIds(
                                      value === true
                                        ? [...audienceCustomerIds, id]
                                        : audienceCustomerIds.filter((customerId) => customerId !== id),
                                    );
                                    setReviewAccepted(false);
                                  }}
                                />
                                <span className="min-w-0">
                                  <span className="block truncate font-semibold">{customer.display_name || `Customer #${id}`}</span>
                                  <span className="block text-xs text-muted-foreground">{customer.destination_masked || "Contact protected"}</span>
                                </span>
                              </Label>
                            );
                          })}
                        </div>
                      )}
                      {!audienceCustomerIds.length && (
                        <p className="text-xs text-amber-600">Select at least one customer to continue.</p>
                      )}
                    </fieldset>
                  )}
                </div>
              )}

              <div className="space-y-2 border-t border-border pt-5">
                <Label htmlFor="campaign-name">Campaign name</Label>
                <Input
                  id="campaign-name"
                  name="campaign_name"
                  autoComplete="off"
                  value={campaignName}
                  maxLength={120}
                  disabled={isReadOnly}
                  onChange={(event) => {
                    setCampaignName(event.target.value);
                    setNameCustomized(true);
                  }}
                />
                <p className="text-xs text-muted-foreground">A name is suggested automatically. Only your team sees it.</p>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl border border-border bg-card transition-all hover:shadow-md">
            <CardHeader className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-xl">Customers who can receive it</CardTitle>
                  <CardDescription className="mt-1 text-sm">This estimate updates as customer permissions and contact details change.</CardDescription>
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
                  {audience.included_count === 0 && (
                    <Alert className="border-amber-500/40 bg-amber-500/5">
                      <TriangleAlert aria-hidden="true" className="h-4 w-4 text-amber-600" />
                      <AlertTitle>No customers can receive this campaign yet</AlertTitle>
                      <AlertDescription>
                        {audienceBlockerGuidance(audience.exclusions || {}, channel)} At least 1 customer must be available before requesting approval.
                      </AlertDescription>
                    </Alert>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-border bg-muted p-4">
                      <Users className="h-5 w-5" />
                      <p className="mt-3 text-3xl font-black">{audience.included_count.toLocaleString("en-NP")}</p>
                      <p className="text-xs font-semibold text-muted-foreground">Can receive it</p>
                    </div>
                    <div className="rounded-xl border border-border bg-muted p-4">
                      <ShieldCheck className="h-5 w-5" />
                      <p className="mt-3 text-3xl font-black">{audience.excluded_count.toLocaleString("en-NP")}</p>
                      <p className="text-xs font-semibold text-muted-foreground">Cannot receive</p>
                    </div>
                  </div>
                  <div className="rounded-2xl border p-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Why this audience</p>
                    <p className="mt-2 text-sm leading-6">{smartSuggestion?.audienceExplanation || playbook.observedFact}</p>
                  </div>
                  {Object.keys(audience.exclusions || {}).length > 0 && (
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Why some customers can’t receive this</p>
                      <p className="mt-1 text-xs text-muted-foreground">These customers are left out because they cannot receive this promotion:</p>
                      <div className="mt-2 space-y-2">
                        {Object.entries(audience.exclusions).map(([reason, count]) => (
                          <div key={reason} className="flex items-center justify-between rounded-xl bg-muted/50 px-3 py-2 text-sm">
                            <span>{readableExclusion(reason)}</span><span className="font-bold">{count.toLocaleString("en-NP")}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <p className="text-xs leading-5 text-muted-foreground">Yummy checks permission, contact details, and recent promotions again before sending.</p>
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
              <CardTitle>{smartSuggestion ? `Offer for ${smartSuggestion.title.toLowerCase()}` : "Offer rules"}</CardTitle>
              <CardDescription>
                {smartSuggestion
                  ? "Choose the thank-you offer that will accompany this customer reminder."
                  : "Choose a fixed discount or a percentage with a maximum discount amount."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {smartSuggestion && (
                <Alert className="border-primary/30 bg-primary/5">
                  <Info aria-hidden="true" className="h-4 w-4 text-primary" />
                  <AlertTitle>Keep the points reminder meaningful</AlertTitle>
                  <AlertDescription>{smartSuggestion.offerGuidance}</AlertDescription>
                </Alert>
              )}
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
                  <Input id="offer-value" name="offer_value" autoComplete="off" type="number" inputMode="decimal" min="1" max={offer.type === "percentage" ? "100" : undefined} value={offer.value} disabled={isReadOnly} onChange={(event) => updateOffer("value", Number(event.target.value))} />
                  {offerValidation.errors.value && <p className="text-xs text-destructive">{offerValidation.errors.value}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="offer-minimum">Minimum order value (Rs.)</Label>
                  <Input id="offer-minimum" name="minimum_order_value" autoComplete="off" type="number" inputMode="decimal" min="1" value={offer.minimum_order_value} disabled={isReadOnly} onChange={(event) => updateOffer("minimum_order_value", Number(event.target.value))} />
                  {offerValidation.errors.minimum_order_value && <p className="text-xs text-destructive">{offerValidation.errors.minimum_order_value}</p>}
                </div>
                {offer.type === "percentage" && (
                  <div className="space-y-2">
                    <Label htmlFor="offer-cap">Maximum discount per redemption (Rs.)</Label>
                    <Input id="offer-cap" name="maximum_discount" autoComplete="off" type="number" inputMode="decimal" min="1" value={offer.percentage_cap ?? ""} disabled={isReadOnly} onChange={(event) => updateOffer("percentage_cap", event.target.value ? Number(event.target.value) : null)} />
                    {offerValidation.errors.percentage_cap && <p className="text-xs text-destructive">{offerValidation.errors.percentage_cap}</p>}
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="offer-limit">Maximum redemptions</Label>
                  <Input id="offer-limit" name="maximum_redemptions" autoComplete="off" type="number" inputMode="numeric" min="1" step="1" value={offer.redemption_limit} disabled={isReadOnly} onChange={(event) => updateOffer("redemption_limit", Number(event.target.value))} />
                  {offerValidation.errors.redemption_limit && <p className="text-xs text-destructive">{offerValidation.errors.redemption_limit}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="offer-start">Offer starts</Label>
                  <Input id="offer-start" name="offer_start_date" autoComplete="off" type="date" value={offer.valid_from} disabled={isReadOnly} onChange={(event) => updateOffer("valid_from", event.target.value)} />
                  {offerValidation.errors.valid_from && <p className="text-xs text-destructive">{offerValidation.errors.valid_from}</p>}
                  {!offerValidation.errors.valid_from && <p className="text-xs text-muted-foreground">The campaign cannot be sent before this date.</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="offer-expiry">Offer expires</Label>
                  <Input id="offer-expiry" name="offer_expiry_date" autoComplete="off" type="date" value={offer.valid_until} disabled={isReadOnly} onChange={(event) => updateOffer("valid_until", event.target.value)} />
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
                  <CardTitle>{channel === "email" ? "Email content" : channel === "sms" ? "SMS message" : "Message and poster"}</CardTitle>
                  <CardDescription className="mt-1">
                    {channel === "email"
                      ? "Choose an approved style, then review the subject and message."
                      : channel === "sms"
                        ? "Choose an approved text message and check the credits needed."
                      : "Controlled templates use the restaurant's real logo. No synthetic food image is generated."}
                  </CardDescription>
                </div>
                {channel === "email" && <Button variant="outline" size="sm" onClick={() => void suggestCopy()} disabled={suggestingCopy || isReadOnly}>
                  {suggestingCopy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Lightbulb className="mr-2 h-4 w-4" />}Suggest copy
                </Button>}
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {brandUnavailable && (
                <Alert className="rounded-xl border border-border bg-card"><TriangleAlert className="h-4 w-4" /><AlertDescription>Growth brand settings are unavailable. The preview uses a safe template and the restaurant profile logo when available.</AlertDescription></Alert>
              )}
              <div className="space-y-2">
                  <Label>Language</Label>
                  <Select value={language} disabled={isReadOnly} onValueChange={(value) => { setLanguage(value as GrowthLanguage); setCopyCustomized(false); }}>
                  <SelectTrigger aria-label="Campaign language"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="en">English</SelectItem><SelectItem value="ne">Nepali</SelectItem><SelectItem value="ne_romanized">Romanized Nepali</SelectItem></SelectContent>
                </Select>
              </div>
              {channel !== "sms" && <div className="space-y-2">
                <Label>Email Style</Label>
                <Select
                  value={selectedMessageTemplateId}
                  disabled={isReadOnly || templatesLoading || approvedMessageTemplates.length === 0}
                  onValueChange={setSelectedMessageTemplateId}
                >
                  <SelectTrigger aria-label="Email style">
                    <SelectValue
                      placeholder={templatesLoading ? "Loading approved templates…" : "No approved template"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {approvedMessageTemplates.map((template) => (
                      <SelectItem key={template.id} value={String(template.id)}>
                        {template.key.replaceAll("_", " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedMessageTemplate && (
                  <p className="text-xs leading-5 text-muted-foreground">
                    This approved email style is ready to personalize for each customer.
                  </p>
                )}
              </div>}
              {channel !== "sms" && templatesError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{templatesError}</AlertDescription>
                </Alert>
              )}
              {channel !== "sms" && !templatesLoading && !templatesError && approvedMessageTemplates.length === 0 && (
                <Alert className="rounded-xl border border-border bg-card">
                  <TriangleAlert className="h-4 w-4" />
                  <AlertDescription>
                    No approved email style is available in {languageLabel(language)}. Save the draft and contact Yummy support for help.
                  </AlertDescription>
                </Alert>
              )}
              {channel === "email" ? (
                <>
                  {smartSuggestion && (
                    <Alert className="border-primary/30 bg-primary/5">
                      <Sparkles aria-hidden="true" className="h-4 w-4 text-primary" />
                      <AlertTitle>Points reminder email</AlertTitle>
                      <AlertDescription>
                        This message explains that the selected customers have points ready to use, then includes the offer you set. It does not disclose a customer&apos;s exact balance in the subject line.
                      </AlertDescription>
                    </Alert>
                  )}
                  {isFavouriteItemSuggestion && (
                    <Alert className="border-primary/30 bg-primary/5">
                      <Sparkles aria-hidden="true" className="h-4 w-4 text-primary" />
                      <AlertTitle>Personalized for each customer</AlertTitle>
                      <AlertDescription>
                        Keep <code>{"{{favourite_item}}"}</code> in this email. Yummy uses a customer&apos;s saved favourite when available, or an item they ordered on at least two completed visits. It freezes that choice before sending, so every customer receives their own message and offer code.
                      </AlertDescription>
                    </Alert>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="email-subject">Email subject</Label>
                    <Input id="email-subject" name="email_subject" autoComplete="off" value={emailSubject} maxLength={255} disabled={isReadOnly} onChange={(event) => { setEmailSubject(event.target.value); setCopyCustomized(true); }} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email-body">Email Message</Label>
                    <Textarea id="email-body" name="email_message" autoComplete="off" value={emailBodyHtml} maxLength={20000} rows={12} disabled={isReadOnly} onChange={(event) => { setEmailBodyHtml(event.target.value); setCopyCustomized(true); }} />
                    <div className="flex justify-end text-xs text-muted-foreground"><span>{emailBodyHtml.length.toLocaleString("en-NP")}/20,000</span></div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email-terms">Visible terms</Label>
                    <Textarea id="email-terms" name="offer_terms" autoComplete="off" value={terms} maxLength={240} rows={3} disabled={isReadOnly} onChange={(event) => setTerms(event.target.value)} />
                    <p className="text-xs text-muted-foreground">Shown in the poster-style email preview when &quot;Use poster template&quot; is enabled below.</p>
                  </div>
                </>
              ) : channel === "sms" ? (
                <>
                  {smartSuggestion && (
                    <Alert className="border-amber-500/40 bg-amber-500/5">
                      <Info aria-hidden="true" className="h-4 w-4" />
                      <AlertTitle>Choose the approved SMS template that matches this campaign</AlertTitle>
                      <AlertDescription>
                        Select <strong>New reward</strong> for unused-points campaigns. The approved SMS template can name the reward, but it does not expose a customer&apos;s exact points balance.
                      </AlertDescription>
                    </Alert>
                  )}
                  {isFavouriteItemSuggestion && (
                    <Alert className="border-amber-500/40 bg-amber-500/5">
                      <Info aria-hidden="true" className="h-4 w-4" />
                      <AlertTitle>Use the approved Favourite item offer template</AlertTitle>
                      <AlertDescription>
                        Select <strong>Favourite item offer</strong>. Yummy uses a customer&apos;s saved favourite when available, or an item they ordered on at least two completed visits. It freezes that choice before scheduling and sends their own item and offer code. No food name is inserted into a generic template.
                      </AlertDescription>
                    </Alert>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="sms-template">Yummy SMS template</Label>
                    <Select
                      value={selectedSmsTemplateCode}
                      disabled={isReadOnly || smsTemplatesLoading || smsTemplates.length === 0}
                      onValueChange={setSelectedSmsTemplateCode}
                    >
                      <SelectTrigger id="sms-template" aria-label="SMS message">
                        <SelectValue placeholder={smsTemplatesLoading ? "Loading templates…" : "Choose a template"} />
                      </SelectTrigger>
                      <SelectContent>
                        {smsTemplates.map((template) => (
                          <SelectItem key={template.code} value={template.code}>
                            {template.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedSmsTemplate && (
                      <p className="text-xs leading-5 text-muted-foreground">
                        {selectedSmsTemplate.description}
                      </p>
                    )}
                  </div>
                  {smsTemplatesError && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{smsTemplatesError}</AlertDescription>
                    </Alert>
                  )}
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Message preview</p>
                    <div className="min-h-28 rounded-xl border bg-muted/30 p-4 text-sm leading-6 text-foreground">
                      {selectedSmsTemplate?.message_body || "Choose a Yummy SMS template."}
                    </div>
                    <p className="text-xs leading-5 text-muted-foreground">This approved message cannot be edited, but customer and offer details are added automatically.</p>
                  </div>
                  <div className="overflow-hidden rounded-xl border">
                    <div className="border-b bg-muted/30 px-4 py-3">
                      <p className="font-semibold">SMS Credit Check</p>
                      <p className="mt-1 text-xs text-muted-foreground">Based on the current message and customers who can receive it.</p>
                    </div>
                    <div className="grid grid-cols-2 divide-x sm:grid-cols-3">
                      <div className="p-4"><p className="text-xs text-muted-foreground">Customers</p><p className="mt-1 text-xl font-black tabular-nums">{smsEstimate?.recipient_count.toLocaleString("en-NP") ?? "—"}</p></div>
                      <div className="p-4"><p className="text-xs text-muted-foreground">Credits Needed</p><p className="mt-1 text-xl font-black tabular-nums">{smsEstimate?.required_credits.toLocaleString("en-NP") ?? "—"}</p></div>
                      <div className="col-span-2 border-t p-4 sm:col-span-1 sm:border-t-0"><p className="text-xs text-muted-foreground">Available</p><p className="mt-1 text-xl font-black tabular-nums">{smsWallet?.available_credits.toLocaleString("en-NP") ?? "Unavailable"}</p></div>
                    </div>
                  </div>
                  {smsCreditShortfall !== null && smsCreditShortfall > 0 ? (
                    <Alert className="border-amber-500/40 bg-amber-500/5">
                      <TriangleAlert aria-hidden="true" className="h-4 w-4" />
                      <AlertTitle>Add {smsCreditShortfall.toLocaleString("en-NP")} More Credits</AlertTitle>
                      <AlertDescription className="space-y-3">
                        <p>You can save and request approval now, but you will need more credits before scheduling this campaign.</p>
                        <Button asChild type="button" variant="outline" size="sm"><Link href="/grow/settings#grow-sms-credits">Buy SMS Credits</Link></Button>
                      </AlertDescription>
                    </Alert>
                  ) : smsEstimate && smsWallet ? (
                    <Alert className="border-emerald-500/30 bg-emerald-500/5">
                      <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
                      <AlertTitle>Enough Credits Available</AlertTitle>
                      <AlertDescription>Your current balance covers this campaign estimate.</AlertDescription>
                    </Alert>
                  ) : null}
                </>
              ) : null}
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
              restaurantAddress={restaurant?.address}
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
          ) : channel === "sms" ? (
            <Card>
              <CardHeader><CardTitle>SMS preview</CardTitle><CardDescription>Text shown to each eligible, opted-in customer.</CardDescription></CardHeader>
              <CardContent>
                <div className="mx-auto max-w-sm rounded-[2rem] border-8 border-slate-900 bg-muted p-5 shadow-sm">
                  <div className="mb-4 text-center text-xs font-semibold text-muted-foreground">{restaurantName}</div>
                  <div className="rounded-2xl rounded-tl-sm bg-background p-4 text-sm leading-6 shadow-sm whitespace-pre-wrap">{message || "Your SMS message will appear here."}</div>
                </div>
              </CardContent>
            </Card>
          ) : null}
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
                    <p className="text-3xl font-bold tabular-nums">{audience ? audience.included_count.toLocaleString("en-NP") : "—"}</p>
                    <p className="text-sm text-muted-foreground">customers</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Offer</p>
                    <p className="text-lg font-bold">{formatCampaignOffer(offer)}</p>
                    <p className="text-sm text-muted-foreground">Max cost: {formatMoney(offerValidation.maximum_exposure)}</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Language & Channel</p>
                    <p className="text-lg font-bold">{languageLabel(language)} · {channel === "sms" ? "SMS" : "Email"}</p>
                    <p className="text-sm text-muted-foreground">{channel === "email" ? selectedMessageTemplate?.key || "No template" : selectedSmsTemplate?.name || "No SMS template"}</p>
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
                      <span className="block font-semibold text-sm">Send this campaign for manager approval</span>
                      <span className="block text-sm text-muted-foreground">This will not send messages to customers yet.</span>
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
                      disabled={saving || submittingReview || (channel === "sms" ? (smsTemplatesLoading || !selectedSmsTemplate) : (templatesLoading || !selectedMessageTemplate)) || !reviewAccepted || !audience || audience.included_count <= 0}
                      onClick={() => void submitForReview()}
                    >
                      {submittingReview ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileCheck2 className="mr-2 h-4 w-4" />}
                      Send for Approval
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
              <CardHeader><CardTitle>Email Review</CardTitle><CardDescription>Confirm what customers will see before requesting approval.</CardDescription></CardHeader>
              <CardContent>
                <EmailPreview
                  subject={emailSubject}
                  bodyHtml={emailBodyHtml}
                  usePosterTemplate={useEmailPoster}
                  template={emailPosterTemplate}
                  offer={emailPreviewOffer}
                  terms={terms}
                  restaurantName={restaurantName}
                  restaurantAddress={restaurant?.address}
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
          ) : channel === "sms" ? (
            <Card className="h-fit">
              <CardHeader><CardTitle>SMS Review</CardTitle><CardDescription>Confirm the customer message and available credits.</CardDescription></CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-2xl border bg-muted/40 p-4 text-sm leading-6 whitespace-pre-wrap">{message}</div>
                {smsEstimate && (
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-xl border p-3"><p className="text-muted-foreground">Credits Needed</p><p className="text-lg font-bold tabular-nums">{smsEstimate.required_credits.toLocaleString("en-NP")}</p></div>
                    <div className="rounded-xl border p-3"><p className="text-muted-foreground">Credits Available</p><p className="text-lg font-bold tabular-nums">{smsWallet?.available_credits.toLocaleString("en-NP") ?? "Unavailable"}</p></div>
                  </div>
                )}
                {smsCreditShortfall !== null && smsCreditShortfall > 0 && <Alert className="border-amber-500/40 bg-amber-500/5"><TriangleAlert aria-hidden="true" className="h-4 w-4" /><AlertDescription>Add {smsCreditShortfall.toLocaleString("en-NP")} more credits before scheduling. Sending for approval does not use credits.</AlertDescription></Alert>}
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
          <div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex"><Eye className="h-4 w-4" />Your progress is saved on this device.</div>
          <Button onClick={continueFromCurrentStep}>{step === 1 ? "Set Offer" : step === 2 ? "Prepare Message" : "Review Campaign"}<ArrowRight className="ml-2 h-4 w-4" /></Button>
        </div>
      )}
    </main>
  );
}
