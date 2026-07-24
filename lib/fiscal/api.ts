import type { AxiosResponse } from "axios";
import apiClient from "@/lib/api-client";
import { FiscalApis } from "@/lib/api/endpoints";
import type {
  BaseResponse,
  CbmsConfig,
  CbmsConfigInput,
  CbmsStatus,
  CreditNoteInput,
  FiscalDocument,
  FiscalDocumentList,
  FiscalDocumentListParams,
  FiscalProfile,
  FiscalProfileDraft,
  FiscalValidationResult,
  IssueFiscalDocumentInput,
  PrintAuthorization,
  PrintAuthorizationInput,
  PrintCompletionInput,
  PrintCompletionResult,
} from "./types";

function responseData<T>(response: AxiosResponse<BaseResponse<T> | T>): T {
  const body = response.data;
  if (body && typeof body === "object" && "data" in body && "status" in body) {
    return (body as BaseResponse<T>).data;
  }
  return body as T;
}

export function isMissingFiscalProfileError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    (error as { response?: { status?: number } }).response?.status === 404
  );
}

export const fiscalApi = {
  async getProfile(): Promise<FiscalProfile> {
    return responseData(await apiClient.get(FiscalApis.profile));
  },

  async getProfileOrLegacy(): Promise<FiscalProfile | null> {
    try {
      return await this.getProfile();
    } catch (error) {
      if (isMissingFiscalProfileError(error)) return null;
      throw error;
    }
  },

  async updateProfile(
    input: FiscalProfileDraft,
  ): Promise<FiscalProfile> {
    return responseData(await apiClient.put(FiscalApis.profile, input));
  },

  async validateProfile(): Promise<FiscalValidationResult> {
    return responseData(await apiClient.post(FiscalApis.validateProfile, {}));
  },

  async activateProfile(): Promise<FiscalProfile> {
    return responseData(await apiClient.post(FiscalApis.activateProfile, {}));
  },

  async getOrderDocument(orderId: number): Promise<FiscalDocument | null> {
    try {
      return responseData(
        await apiClient.get(FiscalApis.orderDocument(orderId)),
      );
    } catch (error) {
      if (isMissingFiscalProfileError(error)) return null;
      throw error;
    }
  },

  async issueOrderDocument(
    orderId: number,
    input: IssueFiscalDocumentInput = {},
  ): Promise<FiscalDocument> {
    const data = responseData<FiscalDocument | { document: FiscalDocument }>(
      await apiClient.post(FiscalApis.issueOrderDocument(orderId), input),
    );
    return "document" in data ? data.document : data;
  },

  async listDocuments(
    params: FiscalDocumentListParams = {},
  ): Promise<FiscalDocumentList> {
    const pageSize = params.page_size ?? 50;
    const page = Math.max(1, params.page ?? 1);
    const backendParams = {
      status: params.status,
      kind: params.document_type,
      date_from: params.date_from,
      date_to: params.date_to,
      skip: (page - 1) * pageSize,
      limit: pageSize,
    };
    const data = responseData<FiscalDocumentList | FiscalDocument[]>(
      await apiClient.get(FiscalApis.documents, { params: backendParams }),
    );
    return Array.isArray(data)
      ? { items: data, total: data.length, page, page_size: pageSize }
      : { ...data, page, page_size: pageSize };
  },

  async getDocument(documentId: number): Promise<FiscalDocument> {
    return responseData(await apiClient.get(FiscalApis.document(documentId)));
  },

  async authorizePrint(
    documentId: number,
    input: PrintAuthorizationInput = {},
  ): Promise<PrintAuthorization> {
    return responseData(
      await apiClient.post(FiscalApis.printAuthorizations(documentId), input),
    );
  },

  async completePrint(
    authorizationId: number,
    input: PrintCompletionInput,
  ): Promise<PrintCompletionResult> {
    return responseData(
      await apiClient.post(
        FiscalApis.completePrintAuthorization(authorizationId),
        input,
      ),
    );
  },

  async createCreditNote(
    documentId: number,
    input: CreditNoteInput,
  ): Promise<FiscalDocument> {
    const data = responseData<FiscalDocument | { document: FiscalDocument }>(
      await apiClient.post(FiscalApis.creditNotes(documentId), input),
    );
    return "document" in data ? data.document : data;
  },

  async getCbmsStatus(): Promise<CbmsStatus> {
    return responseData(await apiClient.get(FiscalApis.cbmsStatus));
  },

  async updateCbmsConfig(
    input: CbmsConfigInput,
  ): Promise<CbmsConfig> {
    return responseData(await apiClient.put(FiscalApis.cbmsConfig, input));
  },

  async reconcileCbms(): Promise<CbmsStatus> {
    return responseData(await apiClient.post(FiscalApis.cbmsReconcile, {}));
  },
};
