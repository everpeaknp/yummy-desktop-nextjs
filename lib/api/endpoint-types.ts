/** Shared query param types for `lib/api/endpoints.ts` helpers. */

export type BusinessLine = 'restaurant' | 'hotel';

export type IsoDateTime = Date | string;

export type DashboardV2QueryParams = {
  restaurantId: number;
  date?: string;
  startTime?: IsoDateTime;
  endTime?: IsoDateTime;
  timezone?: string;
  businessLine?: BusinessLine | string;
};

export type DashboardDeltaQueryParams = {
  restaurantId: number;
  since: IsoDateTime;
  date?: string;
  startTime?: IsoDateTime;
  endTime?: IsoDateTime;
  timezone?: string;
  businessLine?: BusinessLine | string;
};

export type DayCloseScopeQueryParams = {
  restaurantId: number;
  businessLine?: BusinessLine | string;
  /** Maps to `business_date` when the backend accepts an explicit close date. */
  businessDate?: string;
};

export type DayCloseSessionsQueryParams = {
  restaurantId: number;
  businessLine?: BusinessLine | string;
  skip?: number;
  limit?: number;
};

export type DayCloseListQueryParams = {
  restaurantId?: number;
  businessLine?: BusinessLine | string;
  status?: string;
  start?: string;
  end?: string;
  skip?: number;
  limit?: number;
};

export type TransactionsListQueryParams = {
  restaurantId: number;
  userId?: number;
  paymentUserId?: number;
  types?: string[];
  dateFrom?: string;
  dateTo?: string;
  skip?: number;
  limit?: number;
};

export type GeneralPurchaseListQueryParams = {
  restaurantId: number;
  businessLine?: BusinessLine | string;
  status?: string;
  skip?: number;
  limit?: number;
};
