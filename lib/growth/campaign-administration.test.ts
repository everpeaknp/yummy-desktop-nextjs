import { describe, expect, it } from "vitest";

import type { GrowthCampaign, GrowthMessageTemplate } from "@/lib/api/growth-types";
import {
  buildGrowthScheduleInput,
  campaignActions,
  campaignApprovalChecks,
  isCampaignApprovalReady,
} from "@/lib/growth/campaign-administration";

describe("Growth campaign administration", () => {
  it("keeps review, approval, and scheduling as separate permissioned transitions", () => {
    expect(
      campaignActions("draft", { manage: true, approve: false, send: false }),
    ).toMatchObject({ submitReview: true, approve: false, schedule: false });
    expect(
      campaignActions("review", { manage: true, approve: true, send: false }),
    ).toMatchObject({ submitReview: false, returnToDraft: true, approve: true, schedule: false });
    expect(
      campaignActions("approved", { manage: false, approve: false, send: true }),
    ).toMatchObject({ approve: false, schedule: true, pause: false });
    expect(
      campaignActions("approved", { manage: false, approve: false, send: true }),
    ).not.toHaveProperty("sendNow");
  });

  it("only allows pausing a scheduled or sending campaign", () => {
    const permissions = { manage: false, approve: false, send: true };
    expect(campaignActions("scheduled", permissions).pause).toBe(true);
    expect(campaignActions("sending", permissions).pause).toBe(true);
    expect(campaignActions("completed", permissions)).toMatchObject({
      pause: false,
      cancel: false,
    });
  });

  it("requires the complete review bundle before enabling approval", () => {
    const campaign = {
      id: 7,
      name: "Win back",
      playbook_code: "win_back",
      segment_code: "lapsed",
      status: "review",
      audience_count: 0,
      offer: { id: 3 },
      approved_message_snapshot: "We miss you",
      creative_asset_id: 8,
      message_template_id: 9,
    } as GrowthCampaign;
    const templates = [
      {
        id: 9,
        key: "win_back_en",
        channel: "whatsapp",
        whatsapp_template_name: "win_back_en",
        provider_template_name: "win_back_en",
        language: "en",
        category: "marketing",
        provider_status: "approved",
        variable_names: [],
      },
    ] satisfies GrowthMessageTemplate[];

    expect(isCampaignApprovalReady(campaignApprovalChecks(campaign, templates))).toBe(true);
    expect(
      isCampaignApprovalReady(
        campaignApprovalChecks({ ...campaign, creative_asset_id: null }, templates),
      ),
    ).toBe(false);
  });

  it("sends an explicit Nepal offset with the restaurant IANA timezone", () => {
    expect(buildGrowthScheduleInput("2026-08-04T18:30", "Asia/Kathmandu")).toEqual({
      scheduled_at: "2026-08-04T18:30:00+05:45",
      timezone: "Asia/Kathmandu",
    });
  });

  it("rejects malformed local schedule values", () => {
    expect(() => buildGrowthScheduleInput("2026-02-30T18:30", "Asia/Kathmandu")).toThrow(
      "valid local date",
    );
  });
});
