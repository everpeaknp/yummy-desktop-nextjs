import apiClient from "@/lib/api-client";
import { GrowthApis, PublicGrowthApis } from "@/lib/api/endpoints";
import type {
  GrowthApiEnvelope,
  GrowthBrandProfile,
  GrowthBrandUpdate,
  GrowthCampaign,
  GrowthCampaignCreateInput,
  GrowthCampaignPosterUploadInput,
  GrowthCampaignResultSummary,
  GrowthCampaignUpdateInput,
  GrowthCopySuggestion,
  GrowthCopySuggestionInput,
  GrowthCreativeAsset,
  GrowthMessageTemplate,
  GrowthOfferValidationInput,
  GrowthOfferValidationResult,
  GrowthOpportunitySummary,
  GrowthOverview,
  GrowthReadiness,
  GrowthReadinessDomain,
  GrowthScheduleInput,
  GrowthSegmentCode,
  GrowthSegmentPreview,
  GrowthSettings,
  GrowthSettingsUpdate,
  NormalizedGrowthOverview,
  PublicGrowthJoinInput,
  PublicGrowthJoinResult,
  PublicGrowthPreferences,
  PublicGrowthRestaurant,
  PublicGrowthUnsubscribeResult,
} from "@/lib/api/growth-types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function unwrapGrowthData<T>(body: GrowthApiEnvelope<T> | T): T {
  if (
    isRecord(body) &&
    Object.prototype.hasOwnProperty.call(body, "data") &&
    (Object.prototype.hasOwnProperty.call(body, "status") ||
      Object.prototype.hasOwnProperty.call(body, "message"))
  ) {
    return body.data as T;
  }
  return body as T;
}

function listOrEmpty<T>(value: T[] | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

export function normalizeGrowthOverview(
  overview: GrowthOverview,
): NormalizedGrowthOverview {
  let readiness: GrowthReadiness;
  if (Array.isArray(overview.readiness)) {
    readiness = { domains: overview.readiness };
  } else if (overview.readiness && Array.isArray(overview.readiness.domains)) {
    readiness = overview.readiness;
  } else {
    readiness = { domains: listOrEmpty(overview.readiness_domains) };
  }

  return {
    readiness,
    opportunities: listOrEmpty(overview.opportunities),
    active_campaigns: listOrEmpty(overview.active_campaigns),
    recent_results: listOrEmpty(overview.recent_results),
    summary: overview.summary ?? {},
    generated_at: overview.generated_at,
  };
}

async function getData<T>(request: Promise<{ data: GrowthApiEnvelope<T> | T }>): Promise<T> {
  const response = await request;
  return unwrapGrowthData(response.data);
}

export const growthApi = {
  async getOverview(): Promise<NormalizedGrowthOverview> {
    const data = await getData<GrowthOverview>(apiClient.get(GrowthApis.overview));
    return normalizeGrowthOverview(data);
  },

  async getReadiness(): Promise<GrowthReadiness> {
    const data = await getData<GrowthReadiness | GrowthReadinessDomain[]>(
      apiClient.get(GrowthApis.readiness),
    );
    return Array.isArray(data) ? { domains: data } : data;
  },

  async listOpportunities(): Promise<GrowthOpportunitySummary[]> {
    return getData(apiClient.get(GrowthApis.opportunities));
  },

  async refreshOpportunities(): Promise<GrowthOpportunitySummary[]> {
    return getData(apiClient.post(GrowthApis.refreshOpportunities, {}));
  },

  async previewSegment(segmentCode: GrowthSegmentCode): Promise<GrowthSegmentPreview> {
    return getData(apiClient.get(GrowthApis.segmentPreview(segmentCode)));
  },

  async listCampaigns(): Promise<GrowthCampaign[]> {
    return getData(apiClient.get(GrowthApis.campaigns));
  },

  async createCampaign(input: GrowthCampaignCreateInput): Promise<GrowthCampaign> {
    return getData(apiClient.post(GrowthApis.campaigns, input));
  },

  async getCampaign(campaignId: number | string): Promise<GrowthCampaign> {
    return getData(apiClient.get(GrowthApis.campaign(campaignId)));
  },

  async updateCampaign(
    campaignId: number | string,
    input: GrowthCampaignUpdateInput,
  ): Promise<GrowthCampaign> {
    return getData(apiClient.patch(GrowthApis.campaign(campaignId), input));
  },

  async previewCampaignAudience(
    campaignId: number | string,
  ): Promise<GrowthSegmentPreview> {
    return getData(apiClient.post(GrowthApis.campaignAudiencePreview(campaignId), {}));
  },

  async submitCampaignForReview(campaignId: number | string): Promise<GrowthCampaign> {
    return getData(apiClient.post(GrowthApis.campaignSubmitReview(campaignId), {}));
  },

  async returnCampaignToDraft(
    campaignId: number | string,
    reason: string,
  ): Promise<GrowthCampaign> {
    return getData(
      apiClient.post(GrowthApis.campaignReturnToDraft(campaignId), { reason }),
    );
  },

  async uploadCampaignPoster(
    campaignId: number | string,
    input: GrowthCampaignPosterUploadInput,
  ): Promise<GrowthCreativeAsset> {
    const form = new FormData();
    const extension =
      input.file.type === "image/jpeg"
        ? "jpg"
        : input.file.type === "image/webp"
          ? "webp"
          : "png";
    form.append("file", input.file, input.filename || `growth-poster.${extension}`);
    form.append("template_key", input.template_key);
    form.append("template_version", String(input.template_version));
    return getData(apiClient.post(GrowthApis.campaignPosterUpload(campaignId), form));
  },

  async approveCampaign(campaignId: number | string): Promise<GrowthCampaign> {
    return getData(apiClient.post(GrowthApis.campaignApprove(campaignId), {}));
  },

  async scheduleCampaign(
    campaignId: number | string,
    input: GrowthScheduleInput,
  ): Promise<GrowthCampaign> {
    return getData(apiClient.post(GrowthApis.campaignSchedule(campaignId), input));
  },

  async pauseCampaign(campaignId: number | string, reason: string): Promise<GrowthCampaign> {
    return getData(apiClient.post(GrowthApis.campaignPause(campaignId), { reason }));
  },

  async cancelCampaign(campaignId: number | string, reason: string): Promise<GrowthCampaign> {
    return getData(apiClient.post(GrowthApis.campaignCancel(campaignId), { reason }));
  },

  async getCampaignResults(
    campaignId: number | string,
  ): Promise<GrowthCampaignResultSummary> {
    return getData(apiClient.get(GrowthApis.campaignResults(campaignId)));
  },

  async getSettings(): Promise<GrowthSettings> {
    return getData(apiClient.get(GrowthApis.settings));
  },

  async updateSettings(input: GrowthSettingsUpdate): Promise<GrowthSettings> {
    return getData(apiClient.patch(GrowthApis.settings, input));
  },

  async getBrand(): Promise<GrowthBrandProfile> {
    return getData(apiClient.get(GrowthApis.brand));
  },

  async updateBrand(input: GrowthBrandUpdate): Promise<GrowthBrandProfile> {
    return getData(apiClient.patch(GrowthApis.brand, input));
  },

  async listMessageTemplates(): Promise<GrowthMessageTemplate[]> {
    return getData(apiClient.get(GrowthApis.messageTemplates));
  },

  async suggestCopy(input: GrowthCopySuggestionInput): Promise<GrowthCopySuggestion> {
    return getData(apiClient.post(GrowthApis.suggestCopy, input));
  },

  async validateOffer(input: GrowthOfferValidationInput): Promise<GrowthOfferValidationResult> {
    return getData(apiClient.post(GrowthApis.validateOffer, input));
  },

  async getPublicRestaurant(publicSlug: string): Promise<PublicGrowthRestaurant> {
    return getData(apiClient.get(PublicGrowthApis.restaurant(publicSlug)));
  },

  async joinPublicRestaurant(
    publicSlug: string,
    input: PublicGrowthJoinInput,
  ): Promise<PublicGrowthJoinResult> {
    return getData(apiClient.post(PublicGrowthApis.join(publicSlug), input));
  },

  async getPublicPreferences(signedToken: string): Promise<PublicGrowthPreferences> {
    return getData(apiClient.get(PublicGrowthApis.preferences(signedToken)));
  },

  async unsubscribePublicPreferences(
    signedToken: string,
  ): Promise<PublicGrowthUnsubscribeResult> {
    return getData(apiClient.post(PublicGrowthApis.unsubscribe(signedToken), {}));
  },
};

export type GrowthApi = typeof growthApi;
