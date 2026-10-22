import apiClient from "@/lib/api-client";
import type {
  FinanceSalesDocument,
  FinanceSalesDocumentList,
  FinanceSalesDocumentSettlement,
  FinanceOrderSettlementSummary,
  FinanceSalesInvoiceInput,
  FinanceSalesReturnInput,
  OrderSettlementReplacementInput,
} from "@/types/finance-sales";

type ApiResponse<T> = { data: T; message?: string };

export const financeSalesApi = {
  list: async (
    restaurantId: number,
    params?: {
      kind?: "invoice" | "credit_note";
      customer_id?: number;
      date_from?: string;
      date_to?: string;
      limit?: number;
    },
  ): Promise<FinanceSalesDocumentList> => {
    const response = await apiClient.get<ApiResponse<FinanceSalesDocumentList>>(
      "/finance/sales-documents",
      { params: { restaurant_id: restaurantId, ...params } },
    );
    return response.data.data;
  },

  createInvoice: async (
    payload: FinanceSalesInvoiceInput,
  ): Promise<FinanceSalesDocument> => {
    const response = await apiClient.post<ApiResponse<FinanceSalesDocument>>(
      "/finance/sales-documents/invoices",
      payload,
    );
    return response.data.data;
  },

  getByOrder: async (
    restaurantId: number,
    orderId: number,
  ): Promise<FinanceSalesDocument> => {
    const response = await apiClient.get<ApiResponse<FinanceSalesDocument>>(
      `/finance/sales-documents/orders/${orderId}`,
      { params: { restaurant_id: restaurantId } },
    );
    return response.data.data;
  },

  get: async (
    restaurantId: number,
    documentId: number,
  ): Promise<FinanceSalesDocument> => {
    const response = await apiClient.get<ApiResponse<FinanceSalesDocument>>(
      `/finance/sales-documents/${documentId}`,
      { params: { restaurant_id: restaurantId } },
    );
    return response.data.data;
  },

  getSettlement: async (
    restaurantId: number,
    documentId: number,
  ): Promise<FinanceSalesDocumentSettlement> => {
    const response = await apiClient.get<
      ApiResponse<FinanceSalesDocumentSettlement>
    >(`/finance/sales-documents/${documentId}/settlement`, {
      params: { restaurant_id: restaurantId },
    });
    return response.data.data;
  },

  getOrderSettlements: async (
    restaurantId: number,
    orderIds: number[],
  ): Promise<FinanceOrderSettlementSummary[]> => {
    if (!orderIds.length) return [];
    const search = new URLSearchParams({ restaurant_id: String(restaurantId) });
    orderIds.forEach((orderId) => search.append("order_ids", String(orderId)));
    const response = await apiClient.get<
      ApiResponse<FinanceOrderSettlementSummary[]>
    >(`/finance/sales-documents/order-settlements?${search.toString()}`);
    return response.data.data;
  },

  createReturn: async (
    payload: FinanceSalesReturnInput,
  ): Promise<FinanceSalesDocument> => {
    const response = await apiClient.post<ApiResponse<FinanceSalesDocument>>(
      "/finance/sales-documents/returns",
      payload,
    );
    return response.data.data;
  },

  replaceOrderSettlement: async (
    orderId: number,
    payload: OrderSettlementReplacementInput,
  ) => {
    const response = await apiClient.put<ApiResponse<unknown>>(
      `/orders/${orderId}/settlement`,
      payload,
    );
    return response.data.data;
  },
};
