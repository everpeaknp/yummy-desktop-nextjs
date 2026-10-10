import { describe, expect, it } from "vitest";

import type { GrowthMessageTemplate, GrowthSettings } from "@/lib/api/growth-types";
import {
  approvedImageTemplatesForLanguage,
  buildCampaignCreateInput,
  campaignRecommendationHref,
  campaignStudioActionPolicy,
  getCampaignPlaybook,
  getSmartCampaignSuggestion,
  recommendedCampaignChannel,
  validateCampaignOffer,
  type CampaignOfferDraft,
} from "@/lib/growth/campaign-studio";

describe("Campaign Studio WhatsApp templates", () => {
  it("offers only provider-approved image templates in the selected language", () => {
    const templates: GrowthMessageTemplate[] = [
      { id: 1, key: "en-image", channel: "whatsapp", whatsapp_template_name: "en_image", provider_template_name: "en_image", language: "en", category: "marketing", provider_status: "approved", variable_names: [], media_type: "image" },
      { id: 2, key: "en-text", channel: "whatsapp", whatsapp_template_name: "en_text", provider_template_name: "en_text", language: "en", category: "marketing", provider_status: "approved", variable_names: [], media_type: "none" },
      { id: 3, key: "ne-image", channel: "whatsapp", whatsapp_template_name: "ne_image", provider_template_name: "ne_image", language: "ne", category: "marketing", provider_status: "approved", variable_names: [], media_type: "image" },
      { id: 4, key: "pending", channel: "whatsapp", whatsapp_template_name: "pending", provider_template_name: "pending", language: "en", category: "marketing", provider_status: "pending", variable_names: [], media_type: "image" },
    ];

    expect(approvedImageTemplatesForLanguage([...templates], "en")).toEqual([
      templates[0],
    ]);
  });
});

const validFixedOffer: CampaignOfferDraft = {
  type: "fixed",
  value: 100,
  minimum_order_value: 600,
  percentage_cap: null,
  valid_from: "2026-08-04",
  valid_until: "2026-08-14",
  redemption_limit: 25,
};

describe("Campaign Studio playbooks", () => {
  it.each([
    ["second_visit", "new"],
    ["win_back", "lapsed"],
    ["slow_day", "regular"],
  ] as const)("maps %s to the authoritative %s segment", (playbook, segment) => {
    expect(getCampaignPlaybook(playbook).segment).toBe(segment);
    expect(
      buildCampaignCreateInput({
        name: "August offer",
        playbookCode: playbook,
        channel: "whatsapp",
        offer: validFixedOffer,
        language: "en",
      }).segment_code,
    ).toBe(segment);
  });
});

describe("Campaign Studio offer validation", () => {
  it("calculates bounded exposure for a valid fixed offer", () => {
    expect(validateCampaignOffer(validFixedOffer)).toEqual({
      valid: true,
      errors: {},
      maximum_exposure: 2500,
    });
  });

  it("requires a rupee cap for percentage offers", () => {
    const result = validateCampaignOffer({
      ...validFixedOffer,
      type: "percentage",
      value: 15,
      percentage_cap: null,
    });
    expect(result.valid).toBe(false);
    expect(result.errors.percentage_cap).toMatch(/rupee cap/i);
    expect(result.maximum_exposure).toBeNull();
  });

  it("rejects unsafe or internally inconsistent economics", () => {
    const result = validateCampaignOffer({
      ...validFixedOffer,
      value: 700,
      minimum_order_value: 600,
      redemption_limit: 0,
      valid_until: "2026-08-01",
    });
    expect(result.valid).toBe(false);
    expect(result.errors.minimum_order_value).toBeTruthy();
    expect(result.errors.redemption_limit).toBeTruthy();
    expect(result.errors.valid_until).toBeTruthy();
  });
});

describe("Campaign Studio action boundary", () => {
  it("supports draft/review but never approval, scheduling, or sending", () => {
    const policy = campaignStudioActionPolicy("draft");
    expect(policy.can_save_draft).toBe(true);
    expect(policy.can_submit_for_review).toBe(true);
    expect(policy.requires_separate_manual_approval).toBe(true);
    expect(policy.can_approve).toBe(false);
    expect(policy.can_schedule).toBe(false);
    expect(policy.can_send).toBe(false);
  });

  it("removes editing actions after review submission", () => {
    const policy = campaignStudioActionPolicy("review");
    expect(policy.can_save_draft).toBe(false);
    expect(policy.can_submit_for_review).toBe(false);
    expect(policy.can_send).toBe(false);
  });
});

describe("Campaign Studio SMS drafts", () => {
  it("persists only the selected Yummy SMS template code", () => {
    const input = buildCampaignCreateInput({
      name: "SMS return offer",
      playbookCode: "win_back",
      channel: "sms",
      offer: validFixedOffer,
      language: "en",
      smsTemplateCode: "welcome_back",
    });

    expect(input.channel).toBe("sms");
    expect(input.sms_template_code).toBe("welcome_back");
    expect(input.message_body).toBeNull();
    expect(input.email_subject).toBeNull();
    expect(input.creative_asset_id).toBeUndefined();
    expect(input.message_template_id).toBeUndefined();
  });
});

describe("Campaign Studio favourite-item personalization", () => {
  it("marks only email drafts as favourite-item personalized", () => {
    const input = buildCampaignCreateInput({
      name: "Favourite item offer",
      playbookCode: "custom",
      channel: "email",
      offer: validFixedOffer,
      language: "en",
      emailSubject: "Your favourite is waiting",
      emailBodyHtml: "Hi {{customer_name}}, enjoy {{favourite_item}} with {{offer_code}}.",
      personalizationKind: "favourite_item",
      audienceCustomerIds: [3],
    });

    expect(input.personalization_kind).toBe("favourite_item");
  });
});

describe("Campaign Studio smart suggestions", () => {
  it("preserves the selected audience and favourite-item intent when opening a recommendation", () => {
    const href = campaignRecommendationHref({
      id: "signal:favourite_items",
      playbook_code: "custom",
      title: "Promote favourite items",
      eligible_customer_count: 2,
      audience_customer_ids: [7, 12],
      readiness_status: "ready",
    }, "sms");

    expect(href).toContain("goal=custom");
    expect(href).toContain("channel=sms");
    expect(href).toContain("customers=7%2C12");
    expect(href).toContain("personalization=favourite_item");
  });

  it("does not point staff to SMS when restaurant SMS is disabled", () => {
    const channel = recommendedCampaignChannel({
      id: "signal:frequent_visitors",
      playbook_code: "custom",
      title: "Thank frequent visitors",
      eligible_customer_count: 3,
      email_eligible_customer_count: 3,
      sms_eligible_customer_count: 3,
      recommended_channel: "sms",
      readiness_status: "ready",
    }, {
      email_enabled: true,
      sms_enabled: false,
    } as GrowthSettings);

    expect(channel).toBe("email");
  });

  it("keeps the unused-points intent and its email copy together", () => {
    const suggestion = getSmartCampaignSuggestion("unused_points");

    expect(suggestion?.title).toBe("Customers with unused points");
    expect(suggestion?.emailCopy.headline).toBe("Your points are ready to use");
    expect(
      suggestion?.emailCopy.message("Yummy", "Rs. 100 off above Rs. 600", "2026-10-17"),
    ).toContain("points ready to use at Yummy");
  });

  it("does not treat an unknown query value as a smart suggestion", () => {
    expect(getSmartCampaignSuggestion("unknown")).toBeNull();
  });
});
