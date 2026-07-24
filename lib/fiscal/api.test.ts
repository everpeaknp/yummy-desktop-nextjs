import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api-client", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
}));

import apiClient from "@/lib/api-client";
import { fiscalApi } from "./api";

const mocked = vi.mocked(apiClient, true);

beforeEach(() => {
  vi.resetAllMocks();
  mocked.get.mockResolvedValue({ data: { status: "success", data: {} } });
  mocked.post.mockResolvedValue({ data: { status: "success", data: {} } });
  mocked.put.mockResolvedValue({ data: { status: "success", data: {} } });
});

describe("fiscalApi", () => {
  it("uses the fiscal profile and CBMS endpoints", async () => {
    const draft = {
      registration_type: "vat" as const,
      fiscal_billing_mode: "vat_ebilling" as const,
      seller_pan: "123456789",
    };
    const cbms = {
      username: "taxpayer",
      password: "secret",
      environment: "test" as const,
      realtime_required: true,
    };

    await fiscalApi.getProfile();
    await fiscalApi.updateProfile(draft);
    await fiscalApi.validateProfile();
    await fiscalApi.activateProfile();
    await fiscalApi.getCbmsStatus();
    await fiscalApi.updateCbmsConfig(cbms);
    await fiscalApi.reconcileCbms();

    expect(mocked.get).toHaveBeenCalledWith("/fiscal/profile");
    expect(mocked.put).toHaveBeenCalledWith("/fiscal/profile", draft);
    expect(mocked.post).toHaveBeenCalledWith(
      "/fiscal/profile/validate",
      {},
    );
    expect(mocked.post).toHaveBeenCalledWith(
      "/fiscal/profile/activate",
      {},
    );
    expect(mocked.get).toHaveBeenCalledWith("/fiscal/cbms/status");
    expect(mocked.put).toHaveBeenCalledWith("/fiscal/cbms/config", cbms);
    expect(mocked.post).toHaveBeenCalledWith(
      "/fiscal/cbms/reconcile",
      {},
    );
  });

  it("uses server-owned document issuance, printing and credit-note endpoints", async () => {
    await fiscalApi.getOrderDocument(25);
    await fiscalApi.issueOrderDocument(25, { buyer_pan: "987654321" });
    await fiscalApi.listDocuments({
      page: 2,
      page_size: 25,
      document_type: "tax_invoice",
    });
    await fiscalApi.getDocument(12);
    await fiscalApi.authorizePrint(12, { printer_name: "Counter" });
    await fiscalApi.completePrint(71, {
      authorization_token: "one-time-token",
      succeeded: true,
    });
    await fiscalApi.createCreditNote(12, { reason: "Returned meal" });

    expect(mocked.get).toHaveBeenCalledWith(
      "/fiscal/orders/25/document",
    );
    expect(mocked.post).toHaveBeenCalledWith(
      "/fiscal/orders/25/issue",
      { buyer_pan: "987654321" },
    );
    expect(mocked.get).toHaveBeenCalledWith("/fiscal/documents", {
      params: {
        status: undefined,
        kind: "tax_invoice",
        date_from: undefined,
        date_to: undefined,
        skip: 25,
        limit: 25,
      },
    });
    expect(mocked.get).toHaveBeenCalledWith("/fiscal/documents/12");
    expect(mocked.post).toHaveBeenCalledWith(
      "/fiscal/documents/12/print-authorizations",
      { printer_name: "Counter" },
    );
    expect(mocked.post).toHaveBeenCalledWith(
      "/fiscal/print-authorizations/71/complete",
      {
        authorization_token: "one-time-token",
        succeeded: true,
      },
    );
    expect(mocked.post).toHaveBeenCalledWith(
      "/fiscal/documents/12/credit-notes",
      { reason: "Returned meal" },
    );
  });

  it("treats a missing fiscal profile as legacy without hiding other failures", async () => {
    mocked.get.mockRejectedValueOnce({ response: { status: 404 } });
    await expect(fiscalApi.getProfileOrLegacy()).resolves.toBeNull();

    mocked.get.mockRejectedValueOnce({ response: { status: 500 } });
    await expect(fiscalApi.getProfileOrLegacy()).rejects.toMatchObject({
      response: { status: 500 },
    });
  });
});
