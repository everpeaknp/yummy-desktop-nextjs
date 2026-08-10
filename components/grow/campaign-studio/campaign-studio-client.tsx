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
} from "lucide-react";
import { toast } from "sonner";

import { CampaignPosterPreview } from "@/components/grow/campaign-studio/poster-preview";
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
  GrowthLanguage,
  GrowthMessageTemplate,
  GrowthPlaybookCode,
  GrowthSegmentPreview,
} from "@/lib/api/growth-types";
import { getApiErrorMessage } from "@/lib/api-error-message";
import {
  buildCampaignCreateInput,
  approvedImageTemplatesForLanguage,
  CAMPAIGN_PLAYBOOKS,
  CAMPAIGN_REVIEW_CAVEATS,
  campaignStudioActionPolicy,
  deterministicCampaignCopy,
  formatCampaignOffer,
  getCampaignPlaybook,
  validateCampaignOffer,
  type CampaignOfferDraft,
  type CampaignPosterTemplate,
} from "@/lib/growth/campaign-studio";
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

function readableExclusion(value: string): string {
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
  const campaignName = useCampaignStudio((state) => state.campaignName);
  const nameCustomized = useCampaignStudio((state) => state.nameCustomized);
  const offer = useCampaignStudio((state) => state.offer);
  const language = useCampaignStudio((state) => state.language);
  const headline = useCampaignStudio((state) => state.headline);
  const message = useCampaignStudio((state) => state.message);
  const copyCustomized = useCampaignStudio((state) => state.copyCustomized);
  const terms = useCampaignStudio((state) => state.terms);
  const posterTemplate = useCampaignStudio((state) => state.posterTemplate);
  const selectedMessageTemplateId = useCampaignStudio((state) => state.selectedMessageTemplateId);
  const reviewAccepted = useCampaignStudio((state) => state.reviewAccepted);
  const patchDraft = useCampaignStudio((state) => state.patch);
  const setStep = useCampaignStudio((state) => state.setStep);
  const setFurthestStep = useCampaignStudio((state) => state.setFurthestStep);
  const resetDraft = useCampaignStudio((state) => state.reset);

  const setPlaybookCode = (value: GrowthPlaybookCode) => patchDraft("playbookCode", value);
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
  const setSelectedMessageTemplateId = (value: string) =>
    patchDraft("selectedMessageTemplateId", value);
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
  const audienceRequestRef = useRef(0);
  const posterRef = useRef<HTMLDivElement>(null);

  const playbook = useMemo(
    () => getCampaignPlaybook(playbookCode),
    [playbookCode],
  );
  const offerValidation = useMemo(
    () => validateCampaignOffer(offer),
    [offer],
  );
  const actionPolicy = campaignStudioActionPolicy(
    savedCampaign?.status ?? "unsaved",
  );
  const isReadOnly = savedCampaign?.status === "review";
  const approvedMessageTemplates = useMemo(
    () => approvedImageTemplatesForLanguage(messageTemplates, language),
    [language, messageTemplates],
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
      }),
    [language, offer, playbookCode, restaurantName],
  );

  useEffect(() => {
    if (!copyCustomized) {
      setHeadline(starterCopy.headline);
      setMessage(starterCopy.message);
    }
  }, [copyCustomized, starterCopy]);

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
      .listMessageTemplates()
      .then((result) => {
        if (active) setMessageTemplates(result);
      })
      .catch(() => {
        if (active) {
          setMessageTemplates([]);
          setTemplatesError(
            "Approved WhatsApp templates could not be loaded. Review submission is disabled.",
          );
        }
      })
      .finally(() => {
        if (active) setTemplatesLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

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
      const result = await growthApi.previewSegment(playbook.segment);
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
  }, [playbook.segment]);

  useEffect(() => {
    // Wait for the persisted draft to rehydrate first, otherwise this fires
    // once for the default playbook and again once the real one loads.
    if (!hydrated) return;
    void loadAudience();
  }, [hydrated, loadAudience]);

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
      if (headline.trim().length < 3 || message.trim().length < 12) {
        setPageError("Add a clear poster headline and WhatsApp message before review.");
        return;
      }
      if (!selectedMessageTemplate) {
        setPageError(
          `No provider-approved image WhatsApp template is available for ${languageLabel(language)}. Add or approve that template before review.`,
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
      offer,
      language,
      message,
    });
    return selectedMessageTemplate
      ? { ...input, message_template_id: Number(selectedMessageTemplate.id) }
      : input;
  };

  const persistDraft = async (announce = true): Promise<GrowthCampaign | null> => {
    setPageError(null);
    if (campaignName.trim().length < 3 || !offerValidation.valid || message.trim().length < 12) {
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
             message_body: message.trim(),
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

  const renderPosterPng = async (): Promise<Blob> => {
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
    await new Promise(resolve => setTimeout(resolve, 500));

    const html2canvas = (await import("html2canvas")).default;
    
    const posterElement = posterRef.current;
    
    // Get the actual rendered size of the poster
    const rect = posterElement.getBoundingClientRect();
    const width = Math.min(rect.width, 600); // Cap at 600px max
    const height = Math.min(rect.height, 600);
    
    // Scale to 2160x2160px output
    const targetSize = 2160;
    const scale = targetSize / Math.max(width, height);
    
    try {
      const canvas = await html2canvas(posterElement, {
        scale: scale,
        useCORS: true,
        allowTaint: false,
        backgroundColor: null,
        logging: false,
        width: width,
        height: height,
        windowWidth: width,
        windowHeight: height,
        x: 0,
        y: 0,
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
    if (!offerValidation.valid || message.trim().length < 12) {
      setPageError("Offer or message validation is incomplete.");
      return;
    }
    if (!selectedMessageTemplate) {
      setPageError(
        `A provider-approved image WhatsApp template matching ${languageLabel(language)} is required. The campaign remains a draft.`,
      );
      return;
    }

    setSubmittingReview(true);
    try {
      const draft = await persistDraft(false);
      if (!draft) return;
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
      const suggestion = await growthApi.suggestCopy({
        playbook_code: playbookCode,
        language,
        offer: campaignInput().offer,
        audience_summary: `${audience?.included_count ?? 0} ${playbook.audienceLabel.toLowerCase()}`,
      });
      setHeadline(suggestion.headline);
      setMessage(suggestion.message_body);
      setCopyCustomized(true);
      if (suggestion.warnings.length) toast.info(suggestion.warnings.join(" "));
      else toast.success("Copy draft updated. Review every word before submission.");
    } catch {
      setHeadline(starterCopy.headline);
      setMessage(starterCopy.message);
      setCopyCustomized(true);
      toast.info("Copy suggestion service is unavailable; a deterministic starter was restored.");
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
      fixedSize={false}
    />
  );

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-8 pb-16">
      <section className="relative overflow-hidden rounded-xl border border-border bg-card p-8">
        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0 max-w-4xl">
            <Link href="/grow" className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
              Yummy Grow
            </Link>
            
            <div className="mt-4 flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1 w-fit">
              <FilePenLine className="h-3.5 w-3.5" />
              <span className="text-xs font-medium">Campaign Studio</span>
            </div>
            
            <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">Create a controlled return offer</h1>
            
            <p className="mt-4 text-sm text-muted-foreground sm:text-base">
              Draft a V1 playbook, inspect live consented audience, bound maximum exposure, and prepare content for separate manual review.
            </p>
          </div>
          
          <div className="flex flex-col items-stretch gap-2 sm:items-end">
            <Badge variant="outline" className="w-fit border border-border bg-card px-3 py-1.5 text-xs">
              {savedCampaign?.status === "review" ? <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> : <FilePenLine className="mr-1.5 h-3.5 w-3.5" />}
              {savedCampaign?.status === "review" ? "Awaiting review" : savedCampaign ? "Draft saved" : "Unsaved"}
            </Badge>
            <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-xs text-muted-foreground">
              <ShieldCheck className="h-4 w-4" />
              No approval or delivery from studio
            </div>
          </div>
        </div>
      </section>

      <nav className="grid grid-cols-2 gap-3 rounded-xl border border-border bg-card p-3 sm:grid-cols-4" aria-label="Campaign steps">
        {studioSteps.map((item) => {
          const Icon = item.icon;
          const active = step === item.step;
          const accessible = item.step <= furthestStep;
          return (
            <button
              key={item.step}
              type="button"
              disabled={!accessible || isReadOnly}
              onClick={() => changeStep(item.step)}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-3 text-left transition-all disabled:cursor-not-allowed disabled:opacity-45",
                active ? "bg-primary text-primary-foreground shadow-sm" : "hover:bg-muted hover:shadow-sm",
              )}
            >
              <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", active ? "bg-white/15" : "bg-muted")}>
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-[10px] font-bold uppercase tracking-wider opacity-70">Step {item.step}</span>
                <span className="block truncate text-sm font-semibold">{item.shortTitle}</span>
              </span>
            </button>
          );
        })}
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
        <div className="grid gap-8 xl:grid-cols-[1.05fr_0.95fr]">
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
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Exclusions</p>
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
        <div className="grid gap-6 xl:grid-cols-[1fr_0.75fr]">
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
              <CardHeader><CardTitle>Maximum offer exposure</CardTitle><CardDescription>Bounded by the per-redemption maximum and redemption limit.</CardDescription></CardHeader>
              <CardContent>
                <p className="text-4xl font-black">{formatMoney(offerValidation.maximum_exposure)}</p>
                <p className="mt-3 text-sm font-semibold">{formatCampaignOffer(offer)}</p>
                {audience && offer.redemption_limit > audience.included_count && (
                  <Alert className="mt-4 rounded-xl border border-border bg-card">
                    <TriangleAlert className="h-4 w-4" />
                    <AlertDescription>Redemption limit exceeds the current eligible audience. This is allowed for drafting but should be reviewed.</AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
            <Alert className="rounded-xl border border-border bg-card">
              <TriangleAlert className="h-4 w-4" />
              <AlertTitle>Profitability is not verified in this client</AlertTitle>
              <AlertDescription>Recipe coverage, contribution cost, current stock, and backend discount math must validate the economics. A bounded discount is not automatically a profitable offer.</AlertDescription>
            </Alert>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div><CardTitle>Message and poster</CardTitle><CardDescription className="mt-1">Controlled templates use the restaurant&apos;s real logo. No synthetic food image is generated.</CardDescription></div>
                <Button variant="outline" size="sm" onClick={() => void suggestCopy()} disabled={suggestingCopy || isReadOnly}>
                  {suggestingCopy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}Suggest copy
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
                <Label>Approved WhatsApp image template</Label>
                <Select
                  value={selectedMessageTemplateId}
                  disabled={isReadOnly || templatesLoading || approvedMessageTemplates.length === 0}
                  onValueChange={setSelectedMessageTemplateId}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={templatesLoading ? "Loading approved templates…" : "No approved image template"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {approvedMessageTemplates.map((template) => (
                      <SelectItem key={template.id} value={String(template.id)}>
                        {template.key} · {template.whatsapp_template_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedMessageTemplate && (
                  <p className="text-xs leading-5 text-muted-foreground">
                    Provider-approved image template. Variables: {selectedMessageTemplate.variable_names.length ? selectedMessageTemplate.variable_names.join(", ") : "none"}.
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
                    No provider-approved image WhatsApp template matches {languageLabel(language)}. You can save a draft, but Yummy will not upload or submit this campaign for review until one is available.
                  </AlertDescription>
                </Alert>
              )}
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader><div className="flex items-center justify-between gap-3"><div><CardTitle>WhatsApp-square preview</CardTitle><CardDescription>Template-based 1:1 artwork.</CardDescription></div><Button variant="outline" onClick={() => void exportPoster()} disabled={exportingPoster}>{exportingPoster ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}Export PNG</Button></div></CardHeader>
            <CardContent className="space-y-5">
              <div className="w-full flex justify-center">
                {poster}
              </div>
              <div className="space-y-2">
                <Label>Poster template</Label>
                <RadioGroup value={posterTemplate} disabled={isReadOnly} onValueChange={(value) => setPosterTemplate(value as CampaignPosterTemplate)} className="grid grid-cols-4 gap-2">
                  {(["fresh", "warm", "minimal", "ticket"] as CampaignPosterTemplate[]).map((template) => (
                    <Label key={template} htmlFor={`poster-${template}`} className={cn("flex cursor-pointer items-center gap-2 rounded-xl border p-3 capitalize", posterTemplate === template && "border-primary bg-primary/5")}><RadioGroupItem id={`poster-${template}`} value={template} />{template}</Label>
                  ))}
                </RadioGroup>
              </div>
              <p className="text-xs leading-5 text-muted-foreground">Copy suggestions are drafts only. On review submission, Yummy renders this preview as PNG, uploads it to the campaign-scoped media folder, and attaches it to the draft before creating the review candidate.</p>
            </CardContent>
          </Card>
        </div>
      )}

      {step === 4 && (
        <div className="grid gap-6 xl:grid-cols-[1fr_0.72fr]">
          <div className="space-y-5">
            <Card>
              <CardHeader><CardTitle>Final review</CardTitle><CardDescription>This screen summarizes the proposed immutable revision. It does not approve or deliver it.</CardDescription></CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-border bg-card p-4"><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Playbook</p><p className="mt-2 font-bold">{playbook.shortTitle}</p><p className="mt-1 text-sm text-muted-foreground">{playbook.audienceLabel}</p></div>
                  <div className="rounded-xl border border-border bg-card p-4"><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Live audience</p><p className="mt-2 text-2xl font-black">{audience ? audience.included_count.toLocaleString("en-NP") : "Unverified"}</p><p className="mt-1 text-sm text-muted-foreground">Not frozen until backend approval checks</p></div>
                  <div className="rounded-xl border border-border bg-card p-4"><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Offer</p><p className="mt-2 font-bold">{formatCampaignOffer(offer)}</p><p className="mt-1 text-sm text-muted-foreground">Exposure: {formatMoney(offerValidation.maximum_exposure)}</p></div>
                  <div className="rounded-xl border border-border bg-card p-4"><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Content</p><p className="mt-2 font-bold">{languageLabel(language)}</p><p className="mt-1 text-sm text-muted-foreground">Poster: {posterTemplate} · WhatsApp: {selectedMessageTemplate?.key || "Unavailable"}</p></div>
                </div>

                <div className="rounded-xl border border-border bg-card p-4"><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Approved-copy candidate</p><p className="mt-3 font-bold">{headline}</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{message}</p></div>

                <div className="space-y-2">
                  {CAMPAIGN_REVIEW_CAVEATS.map((caveat) => <div key={caveat} className="flex items-start gap-2 rounded-xl bg-muted/50 p-3 text-sm leading-5"><LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{caveat}</div>)}
                </div>

                {!isReadOnly && (
                    <Label htmlFor="review-acceptance" className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-card p-4">
                    <Checkbox id="review-acceptance" checked={reviewAccepted} onCheckedChange={(checked) => setReviewAccepted(checked === true)} />
                    <span><span className="block font-bold">I understand this creates an immutable review candidate, not a delivery.</span><span className="mt-1 block text-xs font-normal leading-5 text-muted-foreground">A separate authorized approver and backend pre-delivery consent/economics checks are still required.</span></span>
                  </Label>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div><p className="font-bold">Manual review boundary</p><p className="mt-1 text-sm text-muted-foreground">No send action exists in this studio.</p></div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  {!isReadOnly && actionPolicy.can_save_draft && <Button variant="outline" disabled={saving || submittingReview} onClick={() => void persistDraft()}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Save draft</Button>}
                  {!isReadOnly && actionPolicy.can_submit_for_review && <Button disabled={saving || submittingReview || templatesLoading || !selectedMessageTemplate || !reviewAccepted || !audience || audience.included_count <= 0} onClick={() => void submitForReview()}>{submittingReview ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileCheck2 className="mr-2 h-4 w-4" />}Submit for manual review</Button>}
                  {isReadOnly && <Button asChild><Link href="/grow" onClick={() => resetDraft()}>Return to Grow overview</Link></Button>}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="h-fit xl:sticky xl:top-4">
            <CardHeader><div className="flex items-center justify-between gap-2"><div><CardTitle>Poster review</CardTitle><CardDescription>Uploaded only when you submit this draft for review.</CardDescription></div><Button variant="outline" size="sm" onClick={() => void exportPoster()} disabled={exportingPoster}>{exportingPoster ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}Export</Button></div></CardHeader>
            <CardContent>
              <div className="w-full flex justify-center">
                {poster}
              </div>
            </CardContent>
          </Card>
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
