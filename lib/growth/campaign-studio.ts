import type {
  GrowthCampaignCreateInput,
  GrowthCampaignStatus,
  GrowthLanguage,
  GrowthMessageTemplate,
  GrowthOfferInput,
  GrowthPlaybookCode,
  GrowthSegmentCode,
} from "@/lib/api/growth-types";

export type CampaignPosterTemplate = "fresh" | "warm" | "minimal";

export function approvedImageTemplatesForLanguage(
  templates: GrowthMessageTemplate[],
  language: GrowthLanguage,
): GrowthMessageTemplate[] {
  return templates.filter(
    (template) =>
      template.language === language &&
      template.provider_status === "approved" &&
      template.media_type === "image",
  );
}

export interface CampaignPlaybookDefinition {
  code: GrowthPlaybookCode;
  segment: GrowthSegmentCode;
  title: string;
  shortTitle: string;
  description: string;
  observedFact: string;
  audienceLabel: string;
}

export const CAMPAIGN_PLAYBOOKS: readonly CampaignPlaybookDefinition[] = [
  {
    code: "second_visit",
    segment: "new",
    title: "Encourage a second visit",
    shortTitle: "Second Visit",
    description: "Invite customers who completed exactly one recent order to return.",
    observedFact: "These customers have one completed order in the configured lookback.",
    audienceLabel: "New customers",
  },
  {
    code: "win_back",
    segment: "lapsed",
    title: "Welcome regulars back",
    shortTitle: "Win Back",
    description: "Reach repeat customers who have not completed an order within the configured lapse period.",
    observedFact: "These customers previously met the repeat threshold and have been absent.",
    audienceLabel: "Lapsed customers",
  },
  {
    code: "slow_day",
    segment: "regular",
    title: "Strengthen a slow daypart",
    shortTitle: "Slow Day",
    description: "Invite active regulars during a restaurant-selected quiet period.",
    observedFact: "The audience is based on regular-customer history, not predicted behavior.",
    audienceLabel: "Regular customers",
  },
] as const;

export function getCampaignPlaybook(
  code: GrowthPlaybookCode,
): CampaignPlaybookDefinition {
  const playbook = CAMPAIGN_PLAYBOOKS.find((candidate) => candidate.code === code);
  if (!playbook) throw new Error(`Unsupported Growth playbook: ${code}`);
  return playbook;
}

export interface CampaignOfferDraft {
  type: "fixed" | "percentage";
  value: number;
  minimum_order_value: number;
  percentage_cap: number | null;
  valid_from: string;
  valid_until: string;
  redemption_limit: number;
}

export type CampaignOfferField =
  | "value"
  | "minimum_order_value"
  | "percentage_cap"
  | "valid_from"
  | "valid_until"
  | "redemption_limit";

export interface CampaignOfferValidation {
  valid: boolean;
  errors: Partial<Record<CampaignOfferField, string>>;
  maximum_exposure: number | null;
}

function finitePositive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

export function validateCampaignOffer(
  offer: CampaignOfferDraft,
): CampaignOfferValidation {
  const errors: CampaignOfferValidation["errors"] = {};

  if (!finitePositive(offer.value)) {
    errors.value = "Offer value must be greater than zero.";
  } else if (offer.type === "percentage" && offer.value > 100) {
    errors.value = "Percentage discount cannot exceed 100%.";
  }

  if (!finitePositive(offer.minimum_order_value)) {
    errors.minimum_order_value = "A positive minimum order value is required in V1.";
  } else if (
    offer.type === "fixed" &&
    finitePositive(offer.value) &&
    offer.value >= offer.minimum_order_value
  ) {
    errors.minimum_order_value = "Minimum order value must be higher than the fixed discount.";
  }

  if (offer.type === "percentage") {
    if (offer.percentage_cap == null || !finitePositive(offer.percentage_cap)) {
      errors.percentage_cap = "A positive rupee cap is required for percentage offers.";
    } else if (
      finitePositive(offer.minimum_order_value) &&
      offer.percentage_cap >= offer.minimum_order_value
    ) {
      errors.percentage_cap = "The rupee cap must remain below the minimum order value.";
    }
  }

  if (!Number.isInteger(offer.redemption_limit) || offer.redemption_limit <= 0) {
    errors.redemption_limit = "Maximum redemptions must be a positive whole number.";
  }

  if (!offer.valid_from) errors.valid_from = "Choose when the offer starts.";
  if (!offer.valid_until) errors.valid_until = "Choose when the offer expires.";
  if (
    offer.valid_from &&
    offer.valid_until &&
    offer.valid_until < offer.valid_from
  ) {
    errors.valid_until = "Expiry must be on or after the start date.";
  }

  let maximumExposure: number | null = null;
  if (Number.isInteger(offer.redemption_limit) && offer.redemption_limit > 0) {
    if (offer.type === "fixed" && finitePositive(offer.value)) {
      maximumExposure = offer.value * offer.redemption_limit;
    } else if (
      offer.type === "percentage" &&
      offer.percentage_cap != null &&
      finitePositive(offer.percentage_cap)
    ) {
      maximumExposure = offer.percentage_cap * offer.redemption_limit;
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    maximum_exposure: maximumExposure,
  };
}

export function toGrowthOfferInput(offer: CampaignOfferDraft): GrowthOfferInput {
  return {
    type: offer.type,
    value: offer.value,
    minimum_order_value: offer.minimum_order_value,
    percentage_cap: offer.type === "percentage" ? offer.percentage_cap : null,
    valid_from: offer.valid_from,
    valid_until: offer.valid_until,
    redemption_limit: offer.redemption_limit,
  };
}

export function formatCampaignOffer(offer: CampaignOfferDraft): string {
  if (offer.type === "fixed") {
    return `Rs. ${offer.value.toLocaleString("en-NP")} off above Rs. ${offer.minimum_order_value.toLocaleString("en-NP")}`;
  }
  const cap = offer.percentage_cap
    ? `, up to Rs. ${offer.percentage_cap.toLocaleString("en-NP")}`
    : "";
  return `${offer.value}% off above Rs. ${offer.minimum_order_value.toLocaleString("en-NP")}${cap}`;
}

export function deterministicCampaignCopy({
  restaurantName,
  playbookCode,
  language,
  offer,
}: {
  restaurantName: string;
  playbookCode: GrowthPlaybookCode;
  language: GrowthLanguage;
  offer: CampaignOfferDraft;
}): { headline: string; message: string } {
  const playbook = getCampaignPlaybook(playbookCode);
  const offerText = formatCampaignOffer(offer);

  if (language === "ne") {
    const headline =
      playbookCode === "second_visit"
        ? "फेरि भेटौँ"
        : playbookCode === "win_back"
          ? "हामीले तपाईंलाई सम्झिरहेका छौँ"
          : "यो शान्त समयमा विशेष स्वाद";
    return {
      headline,
      message: `नमस्ते {{customer_name}}, ${restaurantName} मा तपाईंका लागि ${offerText}। अफर ${offer.valid_until} सम्म मान्य छ। सर्तहरू लागू हुन्छन्।`,
    };
  }

  if (language === "ne_romanized") {
    const headline =
      playbookCode === "second_visit"
        ? "Feri bhetaula"
        : playbookCode === "win_back"
          ? "Hami tapailai samjhi raheka chhau"
          : "Shanta samayako lagi khas offer";
    return {
      headline,
      message: `Namaste {{customer_name}}, ${restaurantName} ma tapaiko lagi ${offerText}. Offer ${offer.valid_until} samma manya cha. Sartharu lagu hunchhan.`,
    };
  }

  const headline =
    playbookCode === "second_visit"
      ? "We would love to welcome you back"
      : playbookCode === "win_back"
        ? "It has been a while"
        : "A little something for a quieter time";
  return {
    headline,
    message: `Hi {{customer_name}}, enjoy ${offerText} at ${restaurantName}. Valid until ${offer.valid_until}. Terms apply.`,
  };
}

export function buildCampaignCreateInput({
  name,
  playbookCode,
  offer,
  language,
  message,
}: {
  name: string;
  playbookCode: GrowthPlaybookCode;
  offer: CampaignOfferDraft;
  language: GrowthLanguage;
  message: string;
}): GrowthCampaignCreateInput {
  const playbook = getCampaignPlaybook(playbookCode);
  return {
    name: name.trim(),
    playbook_code: playbook.code,
    segment_code: playbook.segment,
    offer: toGrowthOfferInput(offer),
    language,
    message_body: message.trim(),
  };
}

export interface CampaignStudioActionPolicy {
  can_save_draft: boolean;
  can_submit_for_review: boolean;
  can_approve: false;
  can_schedule: false;
  can_send: false;
  requires_separate_manual_approval: true;
}

export function campaignStudioActionPolicy(
  status: GrowthCampaignStatus | "unsaved",
): CampaignStudioActionPolicy {
  return {
    can_save_draft: status === "unsaved" || status === "draft",
    can_submit_for_review: status === "unsaved" || status === "draft",
    can_approve: false,
    can_schedule: false,
    can_send: false,
    requires_separate_manual_approval: true,
  };
}

export const CAMPAIGN_REVIEW_CAVEATS = [
  "The audience preview is live and is not frozen until backend approval rules run.",
  "Consent, frequency caps, channel status, and offer validity must be checked again before every delivery.",
  "Offer economics and approved copy become immutable snapshots after review; material changes require a new revision.",
  "Saving or submitting this campaign does not approve, schedule, or send any message.",
] as const;
