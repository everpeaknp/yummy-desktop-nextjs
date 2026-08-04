import { afterEach, describe, expect, it, vi } from "vitest";

import apiClient from "@/lib/api-client";
import { GrowthApis, PublicGrowthApis } from "@/lib/api/endpoints";
import { growthApi, normalizeGrowthOverview, unwrapGrowthData } from "@/lib/api/growth";
import type { GrowthOverview } from "@/lib/api/growth-types";

describe("growth API contract helpers", () => {
  afterEach(() => vi.restoreAllMocks());

  it("unwraps the backend BaseResponse convention", () => {
    expect(
      unwrapGrowthData({ status: "success", message: "ok", data: { value: 7 } }),
    ).toEqual({ value: 7 });
  });

  it("keeps an unwrapped response unchanged", () => {
    const body = { value: 7 };
    expect(unwrapGrowthData(body)).toBe(body);
  });

  it("normalizes partial overview payloads without inventing readiness", () => {
    const overview: GrowthOverview = {
      readiness_domains: [
        {
          domain: "customers",
          status: "partial",
          coverage_percent: 28,
        },
      ],
      opportunities: [],
    };

    expect(normalizeGrowthOverview(overview)).toEqual({
      readiness: { domains: overview.readiness_domains },
      opportunities: [],
      active_campaigns: [],
      recent_results: [],
      summary: {},
      generated_at: undefined,
    });
  });

  it("encodes public slugs and signed preference tokens", () => {
    expect(PublicGrowthApis.restaurant("cafe / one")).toBe(
      "/public/growth/restaurants/cafe%20%2F%20one",
    );
    expect(PublicGrowthApis.preferences("signed/token+value")).toBe(
      "/public/growth/preferences/signed%2Ftoken%2Bvalue",
    );
    expect(GrowthApis.segmentPreview("new customers")).toBe(
      "/growth/segments/new%20customers/preview",
    );
  });

  it("sends backend-aligned Growth settings field names", async () => {
    const patch = vi.spyOn(apiClient, "patch").mockResolvedValue({
      data: { status: "success", data: {} },
    } as never);
    await growthApi.updateSettings({
      regular_min_completed_orders: 3,
      lapsed_after_days: 45,
      promotion_frequency_cap_days: 7,
      quiet_hours_start: "21:00:00",
      quiet_hours_end: "08:00:00",
    });
    expect(patch).toHaveBeenCalledWith(GrowthApis.settings, {
      regular_min_completed_orders: 3,
      lapsed_after_days: 45,
      promotion_frequency_cap_days: 7,
      quiet_hours_start: "21:00:00",
      quiet_hours_end: "08:00:00",
    });
  });

  it("sends the exact public consent snapshot contract", async () => {
    const post = vi.spyOn(apiClient, "post").mockResolvedValue({
      data: {
        status: "success",
        data: { accepted: true, preference_token: "signed-preference-token" },
      },
    } as never);
    const payload = {
      name: "Suman",
      phone: "+9779812345678",
      preferred_language: "en" as const,
      whatsapp_marketing_opt_in: false,
      policy_version: "2026-08-v1",
      consent_text_hash: "0".repeat(64),
    };
    await growthApi.joinPublicRestaurant("himalayan-cafe", payload);
    expect(post).toHaveBeenCalledWith(
      PublicGrowthApis.join("himalayan-cafe"),
      payload,
    );
  });

  it("uploads a campaign poster as browser-owned multipart data", async () => {
    const post = vi.spyOn(apiClient, "post").mockResolvedValue({
      data: { status: "success", data: { id: 7 } },
    } as never);
    const png = new Blob(["png-bytes"], { type: "image/png" });

    await growthApi.uploadCampaignPoster(91, {
      file: png,
      filename: "second-visit.png",
      template_key: "fresh",
      template_version: 1,
    });

    expect(post).toHaveBeenCalledTimes(1);
    const [url, body] = post.mock.calls[0];
    expect(url).toBe(GrowthApis.campaignPosterUpload(91));
    expect(body).toBeInstanceOf(FormData);
    const form = body as FormData;
    expect(form.get("template_key")).toBe("fresh");
    expect(form.get("template_version")).toBe("1");
    const file = form.get("file") as File;
    expect(file.name).toBe("second-visit.png");
    expect(file.type).toBe("image/png");
  });

  it("records reasons for reviewer and sender state transitions", async () => {
    const post = vi.spyOn(apiClient, "post").mockResolvedValue({
      data: { status: "success", data: { id: 17 } },
    } as never);

    await growthApi.returnCampaignToDraft(17, "Template wording needs correction");
    await growthApi.pauseCampaign(17, "Provider incident under investigation");
    await growthApi.cancelCampaign(17, "Restaurant requested campaign cancellation");

    expect(post).toHaveBeenNthCalledWith(
      1,
      GrowthApis.campaignReturnToDraft(17),
      { reason: "Template wording needs correction" },
    );
    expect(post).toHaveBeenNthCalledWith(
      2,
      GrowthApis.campaignPause(17),
      { reason: "Provider incident under investigation" },
    );
    expect(post).toHaveBeenNthCalledWith(
      3,
      GrowthApis.campaignCancel(17),
      { reason: "Restaurant requested campaign cancellation" },
    );
  });

  it("uses the POS offer-code validation contract without client-calculated totals", async () => {
    const post = vi.spyOn(apiClient, "post").mockResolvedValue({
      data: { status: "success", data: { valid: false } },
    } as never);
    const payload = {
      offer_code: "AbCdEf0123456789_-xy",
      order_id: 88,
      customer_id: 12,
    };

    await growthApi.validateOffer(payload);

    expect(post).toHaveBeenCalledWith(GrowthApis.validateOffer, payload);
  });
});
