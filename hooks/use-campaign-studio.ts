import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { useEffect, useState } from "react";
import type {
  GrowthChannelCode,
  GrowthLanguage,
  GrowthPlaybookCode,
} from "@/lib/api/growth-types";
import type { CampaignOfferDraft, CampaignPosterTemplate } from "@/lib/growth/campaign-studio";
import type { CampaignEmailTemplate } from "@/lib/growth/email-templates";

export type StudioStep = 1 | 2 | 3 | 4;

const CAMPAIGN_STUDIO_STORAGE_KEY = "yummy:campaign-studio-draft:v1";

function localDate(offsetDays = 0): string {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + offsetDays);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function defaultOffer(): CampaignOfferDraft {
  return {
    type: "fixed",
    value: 100,
    minimum_order_value: 600,
    percentage_cap: null,
    valid_from: localDate(1),
    valid_until: localDate(10),
    redemption_limit: 25,
  };
}

interface CampaignStudioDraft {
  step: StudioStep;
  furthestStep: StudioStep;
  playbookCode: GrowthPlaybookCode;
  channel: GrowthChannelCode;
  campaignName: string;
  nameCustomized: boolean;
  offer: CampaignOfferDraft;
  language: GrowthLanguage;
  headline: string;
  message: string;
  copyCustomized: boolean;
  terms: string;
  posterTemplate: CampaignPosterTemplate;
  emailPosterTemplate: CampaignEmailTemplate;
  useEmailPoster: boolean;
  selectedMessageTemplateId: string;
  emailSubject: string;
  emailBodyHtml: string;
  reviewAccepted: boolean;
}

function createInitialDraft(): CampaignStudioDraft {
  return {
    step: 1,
    furthestStep: 1,
    playbookCode: "second_visit",
    channel: "whatsapp",
    campaignName: "Second Visit offer",
    nameCustomized: false,
    offer: defaultOffer(),
    language: "en",
    headline: "",
    message: "",
    copyCustomized: false,
    terms:
      "One use per eligible customer. Minimum order and campaign terms apply. Cannot be combined with another offer.",
    posterTemplate: "vibrant",
    emailPosterTemplate: "modern",
    useEmailPoster: false,
    selectedMessageTemplateId: "",
    emailSubject: "",
    emailBodyHtml: "",
    reviewAccepted: false,
  };
}

interface CampaignStudioState extends CampaignStudioDraft {
  setStep: (step: StudioStep) => void;
  setFurthestStep: (step: StudioStep) => void;
  patch: <K extends keyof CampaignStudioDraft>(key: K, value: CampaignStudioDraft[K]) => void;
  reset: () => void;
}

export const useCampaignStudio = create<CampaignStudioState>()(
  persist(
    (set) => ({
      ...createInitialDraft(),

      setStep: (step) => set({ step }),
      setFurthestStep: (step) => set({ furthestStep: step }),
      patch: (key, value) => set({ [key]: value } as Partial<CampaignStudioDraft>),
      reset: () => set(createInitialDraft()),
    }),
    {
      name: CAMPAIGN_STUDIO_STORAGE_KEY,
      storage: createJSONStorage(() => {
        if (typeof window === "undefined") {
          return {
            getItem: () => null,
            setItem: () => undefined,
            removeItem: () => undefined,
          };
        }
        return window.localStorage;
      }),
      partialize: (state) => ({
        step: state.step,
        furthestStep: state.furthestStep,
        playbookCode: state.playbookCode,
        channel: state.channel,
        campaignName: state.campaignName,
        nameCustomized: state.nameCustomized,
        offer: state.offer,
        language: state.language,
        headline: state.headline,
        message: state.message,
        copyCustomized: state.copyCustomized,
        terms: state.terms,
        posterTemplate: state.posterTemplate,
        emailPosterTemplate: state.emailPosterTemplate,
        useEmailPoster: state.useEmailPoster,
        selectedMessageTemplateId: state.selectedMessageTemplateId,
        emailSubject: state.emailSubject,
        emailBodyHtml: state.emailBodyHtml,
        reviewAccepted: state.reviewAccepted,
      }),
    },
  ),
);

/** Wait for zustand-persist rehydration before trusting the resumed draft. */
export function useCampaignStudioHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const persistApi = useCampaignStudio.persist;
    if (!persistApi) {
      setHydrated(true);
      return;
    }
    if (persistApi.hasHydrated()) {
      setHydrated(true);
      return;
    }
    return persistApi.onFinishHydration(() => setHydrated(true));
  }, []);

  return hydrated;
}
