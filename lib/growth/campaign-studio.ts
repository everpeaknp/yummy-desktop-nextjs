import type {
  GrowthCampaignCreateInput,
  GrowthCampaignStatus,
  GrowthChannelCode,
  GrowthLanguage,
  GrowthMessageTemplate,
  GrowthOfferInput,
  GrowthPlaybookCode,
  GrowthSegmentCode,
} from "@/lib/api/growth-types";

export type CampaignPosterTemplate =
  | "fresh" | "warm" | "minimal" | "ticket" | "premium" | "grid" | "bold" | "elegant"
  | "modern" | "luxury" | "vibrant" | "sunset" | "ocean" | "forest"
  | "royal" | "neon" | "pastel" | "midnight" | "coral" | "mint"
  | "crimson" | "slate" | "amber" | "teal" | "lavender" | "rose"
  | "emerald" | "sapphire" | "bronze" | "ruby" | "platinum" | "gold"
  | "minimalist" | "geometric" | "artistic" | "expressive" | "maximalist";

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

export function approvedTemplatesForLanguageAndChannel(
  templates: GrowthMessageTemplate[],
  language: GrowthLanguage,
  channel: GrowthChannelCode,
): GrowthMessageTemplate[] {
  if (channel === "email") {
    return templates.filter(
      (template) =>
        template.language === language &&
        template.provider_status === "approved" &&
        template.channel === "email",
    );
  }
  return approvedImageTemplatesForLanguage(templates, language);
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

// Real offer codes are generated per-recipient only when a campaign is
// approved, so drafting/preview has nothing real to show yet. This is the
// one placeholder every preview surface (starter copy text and the poster
// template's coupon box) shares, so they never show two different fake
// codes side by side.
export const PREVIEW_COUPON_CODE = "H8DKRT";

export function deterministicCampaignCopy({
  restaurantName,
  playbookCode,
  language,
  offer,
  channel,
  couponCode = PREVIEW_COUPON_CODE,
}: {
  restaurantName: string;
  playbookCode: GrowthPlaybookCode;
  language: GrowthLanguage;
  offer: CampaignOfferDraft;
  channel?: GrowthChannelCode;
  couponCode?: string;
}): { headline: string; message: string } {
  const playbook = getCampaignPlaybook(playbookCode);
  const offerText = formatCampaignOffer(offer);

  // Use timestamp to ensure variety on each call (now supports 6 templates)
  const randomIndex = Math.floor((Date.now() / 1000) % 6);

  // Email channel: Generate just the message body text (not full HTML template)
  // The backend will wrap this in the branded template
  if (channel === "email") {
    let headline = "";
    let messageBody = "";

    if (playbookCode === "second_visit") {
      // New customer - encourage second visit
      const headlines = [
        "Thanks for trying us out!",
        "We'd love to see you again",
        "Come back and taste more",
        "Your next meal is on us",
        "Ready for round two?",
        "Welcome back for more flavors",
      ];
      const messages = [
        `Thanks for trying ${restaurantName}! Enjoy ${offerText}, valid for the next 30 days. Use the coupon code shown below at checkout.`,
        `We loved having you at ${restaurantName}. Here's ${offerText} for your next visit, valid until ${offer.valid_until}. Show this coupon at checkout.`,
        `As one of our newest guests, enjoy ${offerText} on your next order at ${restaurantName}. Valid until ${offer.valid_until}. Present the coupon code during checkout.`,
        `Hope you enjoyed your first meal! Come back and try more with ${offerText} at ${restaurantName}, valid until ${offer.valid_until}. Show the coupon below at checkout.`,
        `We noticed you tried us recently - thanks! Here's ${offerText} to bring you back to ${restaurantName}. Valid until ${offer.valid_until}. Use the code shown below.`,
        `Your first visit was just the beginning! Explore more of our menu with ${offerText}, valid until ${offer.valid_until}. Present this coupon during your next visit.`,
      ];
      headline = headlines[randomIndex];
      messageBody = messages[randomIndex];
    } else if (playbookCode === "win_back") {
      // Lapsed customer - win them back
      const headlines = [
        "We miss you!",
        "It's been too long",
        "Ready to come back?",
        "Your table is waiting",
        "We haven't forgotten you",
        "Time to reconnect over a meal",
      ];
      const messages = [
        `We haven't seen you at ${restaurantName} in a while and we miss you! Here's ${offerText} to welcome you back, valid until ${offer.valid_until}. Use the coupon code below at checkout.`,
        `It's been a while since your last visit to ${restaurantName}. Come back and enjoy ${offerText}, valid until ${offer.valid_until}. Show this coupon during checkout.`,
        `We'd love to have you back at ${restaurantName}! Enjoy ${offerText} on your return visit, valid until ${offer.valid_until}. Present the coupon code shown below at checkout.`,
        `Your favorite dishes are waiting for you at ${restaurantName}! Come back with ${offerText}, valid until ${offer.valid_until}. Use the code shown below.`,
        `We noticed it's been a while since we've seen you. Here's ${offerText} to welcome you back to ${restaurantName}, valid until ${offer.valid_until}. Show this coupon at checkout.`,
        `Life gets busy, we understand. When you're ready to return, enjoy ${offerText} at ${restaurantName}, valid until ${offer.valid_until}. Present the coupon code below.`,
      ];
      headline = headlines[randomIndex];
      messageBody = messages[randomIndex];
    } else {
      // Slow day - regular customers
      const headlines = [
        "A midweek treat, just for our regulars",
        "Special offer during our quiet hours",
        "Your favorite table is waiting",
        "Beat the rush with this exclusive offer",
        "Enjoy a peaceful meal on us",
        "Our quiet hours are better with you",
      ];
      const messages = [
        `As one of our regulars, enjoy ${offerText} at ${restaurantName} during our quieter hours, valid until ${offer.valid_until}. Use the coupon code below at checkout.`,
        `We have some quiet spots to fill and thought of you! Here's ${offerText}, valid until ${offer.valid_until}. Show this coupon during checkout.`,
        `Skip the rush hour crowd and enjoy ${offerText} during our quiet period at ${restaurantName}. Valid until ${offer.valid_until}. Present the coupon code shown below.`,
        `Thanks for being a regular! Enjoy ${offerText} when you visit during our quieter hours, valid until ${offer.valid_until}. Use the code shown below at checkout.`,
        `Want to avoid the crowds? Come during our quiet hours and get ${offerText} at ${restaurantName}, valid until ${offer.valid_until}. Show this coupon.`,
        `We appreciate your loyalty! Here's ${offerText} for visits during our off-peak times, valid until ${offer.valid_until}. Present the coupon code below.`,
      ];
      headline = headlines[randomIndex];
      messageBody = messages[randomIndex];
    }

    return { headline, message: messageBody };
  }

  // WhatsApp message (original logic with slight enhancements)
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
  channel,
  offer,
  language,
  message,
  emailSubject,
  emailBodyHtml,
  emailTemplate,
}: {
  name: string;
  playbookCode: GrowthPlaybookCode;
  channel: GrowthChannelCode;
  offer: CampaignOfferDraft;
  language: GrowthLanguage;
  message: string;
  emailSubject?: string;
  emailBodyHtml?: string;
  emailTemplate?: string;
}): GrowthCampaignCreateInput {
  const playbook = getCampaignPlaybook(playbookCode);
  return {
    name: name.trim(),
    playbook_code: playbook.code,
    segment_code: playbook.segment,
    channel,
    offer: toGrowthOfferInput(offer),
    language,
    message_body: channel === "whatsapp" ? message.trim() : null,
    email_subject: channel === "email" ? (emailSubject || "").trim() : null,
    email_body_html: channel === "email" ? (emailBodyHtml || "").trim() : null,
    email_template: channel === "email" ? (emailTemplate || "").trim() || null : null,
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
  "Customer list updates automatically until final approval",
  "All settings will be verified again before sending",
  "After review, major changes need a new campaign",
  "This does NOT send anything - approval happens separately",
] as const;
