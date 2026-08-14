import { describe, expect, it } from "vitest";

import type { GrowthMessageTemplate } from "@/lib/api/growth-types";
import {
  approvedImageTemplatesForLanguage,
  buildCampaignCreateInput,
  campaignStudioActionPolicy,
  getCampaignPlaybook,
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
        message: "Hi {{customer_name}}",
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
