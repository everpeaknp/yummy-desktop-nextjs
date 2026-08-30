import apiClient from "@/lib/api-client";
import {
  FinanceReportingHeadRead,
  FinanceReportingTreeNode,
  FinanceReportingHeadCreate,
  FinanceReportingGroupCreate,
  FinanceReportingHeadUpdate,
  FinanceReportingBindingRead,
  OpeningBalanceCreate,
  FinanceReportingEntryRead,
  FinanceHeadType,
  FinanceReportingAccountLedgerRead,
  FinanceReportingProfitLossRead,
  FinanceReportingTrialBalanceRead,
  FinanceCustodyReconciliationRead,
  FinanceReportingBalanceSheetRead,
  FinanceReportingPartyBalancesRead,
  FinanceReportingCashFlowRead,
  FinanceReportingHeadActivityRead,
  ManualJournalCreate,
  ManualJournalListRead,
  ManualJournalReverse,
} from "@/types/finance-reporting";

export interface ApiResponse<T> {
  message?: string;
  data: T;
}

export const financeReportingApi = {
  getTree: async (restaurantId: number): Promise<FinanceReportingTreeNode[]> => {
    const res = await apiClient.get<ApiResponse<FinanceReportingTreeNode[]>>(
      "/finance/reporting-heads/tree",
      { params: { restaurant_id: restaurantId } }
    );
    return res.data.data;
  },

  listHeads: async (
    restaurantId: number,
    params?: {
      head_type?: FinanceHeadType;
      parent_id?: number;
      is_postable?: boolean;
      is_active?: boolean;
      business_line?: string;
      station?: string;
      search?: string;
    }
  ): Promise<FinanceReportingHeadRead[]> => {
    const res = await apiClient.get<ApiResponse<FinanceReportingHeadRead[]>>(
      "/finance/reporting-heads",
      {
        params: {
          restaurant_id: restaurantId,
          ...params,
        },
      }
    );
    return res.data.data;
  },

  getEligibleLeaves: async (
    restaurantId: number,
    params?: {
      head_type?: FinanceHeadType;
      business_line?: string;
      station?: string;
    }
  ): Promise<FinanceReportingHeadRead[]> => {
    const res = await apiClient.get<ApiResponse<FinanceReportingHeadRead[]>>(
      "/finance/reporting-heads/eligible-leaves",
      {
        params: {
          restaurant_id: restaurantId,
          ...params,
        },
      }
    );
    return res.data.data;
  },

  createHead: async (
    payload: FinanceReportingHeadCreate
  ): Promise<FinanceReportingHeadRead> => {
    const res = await apiClient.post<ApiResponse<FinanceReportingHeadRead>>(
      "/finance/reporting-heads",
      payload
    );
    return res.data.data;
  },

  createGroup: async (
    payload: FinanceReportingGroupCreate
  ): Promise<FinanceReportingHeadRead> => {
    const res = await apiClient.post<ApiResponse<FinanceReportingHeadRead>>(
      "/finance/reporting-heads/groups",
      payload
    );
    return res.data.data;
  },

  updateHead: async (
    headId: number,
    payload: FinanceReportingHeadUpdate
  ): Promise<FinanceReportingHeadRead> => {
    const res = await apiClient.patch<ApiResponse<FinanceReportingHeadRead>>(
      `/finance/reporting-heads/${headId}`,
      payload
    );
    return res.data.data;
  },

  listBindings: async (
    restaurantId: number
  ): Promise<FinanceReportingBindingRead[]> => {
    const res = await apiClient.get<ApiResponse<FinanceReportingBindingRead[]>>(
      "/finance/reporting-heads/bindings",
      { params: { restaurant_id: restaurantId } }
    );
    return res.data.data;
  },

  setBinding: async (
    systemRole: string,
    reportingHeadId: number
  ): Promise<FinanceReportingBindingRead> => {
    const res = await apiClient.put<ApiResponse<FinanceReportingBindingRead>>(
      `/finance/reporting-heads/bindings/${systemRole}`,
      { reporting_head_id: reportingHeadId }
    );
    return res.data.data;
  },

  seedDefaultHeads: async (): Promise<FinanceReportingHeadRead[]> => {
    const res = await apiClient.post<ApiResponse<FinanceReportingHeadRead[]>>(
      "/finance/reporting-heads/seed"
    );
    return res.data.data;
  },

  postOpeningBalances: async (
    payload: OpeningBalanceCreate
  ): Promise<FinanceReportingEntryRead> => {
    const res = await apiClient.post<ApiResponse<FinanceReportingEntryRead>>(
      "/finance/reporting-heads/opening-balances",
      payload
    );
    return res.data.data;
  },

  reverseOpeningBalance: async (
    entryId: number,
    reason?: string
  ): Promise<FinanceReportingEntryRead> => {
    const res = await apiClient.post<ApiResponse<FinanceReportingEntryRead>>(
      `/finance/reporting-heads/opening-balances/${entryId}/reverse`,
      {},
      { params: reason ? { reason } : undefined }
    );
    return res.data.data;
  },

  listManualJournals: async (params?: {
    date_from?: string;
    date_to?: string;
    limit?: number;
    offset?: number;
  }): Promise<ManualJournalListRead> => {
    const res = await apiClient.get<ApiResponse<ManualJournalListRead>>(
      "/finance/reporting-heads/journals",
      { params }
    );
    return res.data.data;
  },

  postManualJournal: async (
    payload: ManualJournalCreate
  ): Promise<FinanceReportingEntryRead> => {
    const res = await apiClient.post<ApiResponse<FinanceReportingEntryRead>>(
      "/finance/reporting-heads/journals",
      payload
    );
    return res.data.data;
  },

  reverseManualJournal: async (
    entryId: number,
    payload: ManualJournalReverse
  ): Promise<FinanceReportingEntryRead> => {
    const res = await apiClient.post<ApiResponse<FinanceReportingEntryRead>>(
      `/finance/reporting-heads/journals/${entryId}/reverse`,
      payload
    );
    return res.data.data;
  },

  getProfitAndLoss: async (params?: {
    date_from?: string;
    date_to?: string;
    business_line?: string;
    station?: string;
  }): Promise<FinanceReportingProfitLossRead> => {
    const res = await apiClient.get<ApiResponse<FinanceReportingProfitLossRead>>(
      "/finance/reporting-reports/profit-and-loss",
      { params }
    );
    return res.data.data;
  },

  getTrialBalance: async (params?: {
    date_from?: string;
    date_to?: string;
    business_line?: string;
    station?: string;
    include_zero?: boolean;
  }): Promise<FinanceReportingTrialBalanceRead> => {
    const res = await apiClient.get<ApiResponse<FinanceReportingTrialBalanceRead>>(
      "/finance/reporting-reports/trial-balance",
      { params }
    );
    return res.data.data;
  },

  getAccountLedger: async (
    headId: number,
    params?: {
      date_from?: string;
      date_to?: string;
      business_line?: string;
      station?: string;
      party_type?: string;
      party_id?: number;
      source_type?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<FinanceReportingAccountLedgerRead> => {
    const res = await apiClient.get<ApiResponse<FinanceReportingAccountLedgerRead>>(
      `/finance/reporting-reports/account-ledger/${headId}`,
      { params }
    );
    return res.data.data;
  },

  getCustodyReconciliation: async (params?: {
    business_line?: string;
  }): Promise<FinanceCustodyReconciliationRead> => {
    const res = await apiClient.get<ApiResponse<FinanceCustodyReconciliationRead>>(
      "/finance/reporting-reports/custody-reconciliation",
      { params }
    );
    return res.data.data;
  },

  getBalanceSheet: async (params?: {
    as_of_date?: string;
    business_line?: string;
    station?: string;
  }): Promise<FinanceReportingBalanceSheetRead> => {
    const res = await apiClient.get<ApiResponse<FinanceReportingBalanceSheetRead>>(
      "/finance/reporting-reports/balance-sheet",
      { params }
    );
    return res.data.data;
  },

  getPartyBalances: async (params?: {
    as_of_date?: string;
    party_type?: string;
    business_line?: string;
  }): Promise<FinanceReportingPartyBalancesRead> => {
    const res = await apiClient.get<ApiResponse<FinanceReportingPartyBalancesRead>>(
      "/finance/reporting-reports/party-balances",
      { params }
    );
    return res.data.data;
  },

  getCashFlow: async (params?: {
    date_from?: string;
    date_to?: string;
    business_line?: string;
    station?: string;
  }): Promise<FinanceReportingCashFlowRead> => {
    const res = await apiClient.get<ApiResponse<FinanceReportingCashFlowRead>>(
      "/finance/reporting-reports/cash-flow",
      { params }
    );
    return res.data.data;
  },

  getHeadActivity: async (params?: {
    date_from?: string;
    date_to?: string;
    business_line?: string;
    station?: string;
    include_zero?: boolean;
  }): Promise<FinanceReportingHeadActivityRead> => {
    const res = await apiClient.get<ApiResponse<FinanceReportingHeadActivityRead>>(
      "/finance/reporting-reports/head-activity",
      { params }
    );
    return res.data.data;
  },
};
