import apiClient from "@/lib/api-client";
import type {
  FinanceSalesDocument,
  FinanceSalesDocumentList,
  FinanceSalesInvoiceInput,
  FinanceSalesReturnInput,
  OrderSettlementReplacementInput,
} from "@/types/finance-sales";

type ApiResponse<T> = { data: T; message?: string };

export const financeSalesApi = {
  list: async (
    restaurantId: number,
    params?: { kind?: "invoice" | "credit_note"; date_from?: string; date_to?: string; limit?: number },
  ): Promise<FinanceSalesDocumentList> => {
    const response = await apiClient.get<ApiResponse<FinanceSalesDocumentList>>(
      "/finance/sales-documents",
      { params: { restaurant_id: restaurantId, ...params } },
    );
    return response.data.data;
  },

  createInvoice: async (payload: FinanceSalesInvoiceInput): Promise<FinanceSalesDocument> => {
    const response = await apiClient.post<ApiResponse<FinanceSalesDocument>>(
      "/finance/sales-documents/invoices",
      payload,
    );
    return response.data.data;
  },

  getByOrder: async (restaurantId: number, orderId: number): Promise<FinanceSalesDocument> => {
    const response = await apiClient.get<ApiResponse<FinanceSalesDocument>>(
      `/finance/sales-documents/orders/${orderId}`,
      { params: { restaurant_id: restaurantId } },
    );
    return response.data.data;
  },

  createReturn: async (payload: FinanceSalesReturnInput): Promise<FinanceSalesDocument> => {
    const response = await apiClient.post<ApiResponse<FinanceSalesDocument>>(
      "/finance/sales-documents/returns",
      payload,
    );
    return response.data.data;
  },

  replaceOrderSettlement: async (orderId: number, payload: OrderSettlementReplacementInput) => {
    const response = await apiClient.put<ApiResponse<unknown>>(
      `/orders/${orderId}/settlement`,
      payload,
    );
    return response.data.data;
  },
};
