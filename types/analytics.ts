/** Backend analytics dashboard contract (`GET /analytics/dashboard`). */

export interface AnalyticsSectionAvailability {
  available?: boolean;
  reason?: string | null;
}

export interface AnalyticsLabelAmountItem {
  label?: string;
  amount?: number;
  channel?: string;
  category?: string;
  method?: string;
  supplier?: string;
}

export interface AnalyticsKpiMetric {
  key?: string;
  label?: string;
  value?: number;
  unit?: string;
  delta?: {
    vs_previous_period_pct?: number;
    vs_same_weekday_pct?: number;
  };
}

export interface AnalyticsMetricsSection extends AnalyticsSectionAvailability {
  metrics?: AnalyticsKpiMetric[];
}

export interface AnalyticsChartSeriesSection extends AnalyticsSectionAvailability {
  labels?: string[];
  revenue?: number[];
  orders?: number[];
  expense?: number[];
  profit?: number[];
}

export interface AnalyticsItemsSection<T = AnalyticsLabelAmountItem>
  extends AnalyticsSectionAvailability {
  items?: T[];
}

export interface AnalyticsPaymentMixSection extends AnalyticsSectionAvailability {
  items?: AnalyticsLabelAmountItem[];
  income_by_payment_instrument?: AnalyticsLabelAmountItem[];
  by_payment_instrument?: AnalyticsLabelAmountItem[];
}

export interface AnalyticsTodaySnapshot extends AnalyticsSectionAvailability {
  income?: number;
  expense?: number;
}

export interface AnalyticsTableUtilizationSection extends AnalyticsSectionAvailability {
  total_tables?: number;
  tables_used?: number;
  table_orders?: number;
  utilization_pct?: number;
  avg_orders_per_used_table?: number;
  peak_hour?: string | null;
  peak_hour_orders?: number;
  items?: unknown[];
  tables?: unknown[];
}

export interface AnalyticsReceivablesSection extends AnalyticsSectionAvailability {
  credit_sales?: number;
  total_outstanding?: number;
  credit_orders_count?: number;
}

export interface AnalyticsLivePipelineSection extends AnalyticsSectionAvailability {
  completed?: number;
  pending?: number;
  delayed?: number;
  canceled?: number;
}

export interface AnalyticsTopPerformerSection extends AnalyticsSectionAvailability {
  id?: number | null;
  name?: string | null;
  revenue?: number;
  orders_count?: number;
}

export interface AnalyticsMenuItemRow {
  id?: number;
  name?: string;
  revenue?: number;
  quantity_sold?: number;
  quantity?: number;
  avg_price?: number;
  avg_sale_price?: number;
  margin_pct?: number;
}

export interface AnalyticsInsightItem {
  title?: string;
  message?: string;
  severity?: string;
  kind?: string;
}

export interface AnalyticsOverviewTab {
  today_snapshot?: AnalyticsTodaySnapshot;
  executive_summary?: AnalyticsMetricsSection;
  health_trends?: AnalyticsChartSeriesSection;
  revenue_trends?: AnalyticsChartSeriesSection;
  payment_mix?: AnalyticsPaymentMixSection;
  table_utilization?: AnalyticsTableUtilizationSection;
  alert_insights?: AnalyticsItemsSection<AnalyticsInsightItem>;
}

export interface AnalyticsFinanceTab {
  pnl_summary?: AnalyticsMetricsSection;
  income_vs_expense?: AnalyticsChartSeriesSection;
  cashflow_timeline?: AnalyticsChartSeriesSection;
  receivables?: AnalyticsReceivablesSection;
  expense_by_category?: AnalyticsItemsSection;
  expense_by_vendor?: AnalyticsItemsSection;
  payment_settlement_mix?: AnalyticsPaymentMixSection;
}

export interface AnalyticsOrdersTab {
  live_pipeline?: AnalyticsLivePipelineSection;
  outcome_summary?: AnalyticsMetricsSection;
  source_mix?: AnalyticsItemsSection & {
    total_orders?: number;
    total_amount?: number;
  };
  top_selling_items?: AnalyticsItemsSection<AnalyticsMenuItemRow>;
  top_selling_tables?: AnalyticsItemsSection;
  top_customers?: AnalyticsItemsSection;
  service_time_distribution?: AnalyticsItemsSection;
}

export interface AnalyticsMenuTab {
  performance_summary?: AnalyticsMetricsSection;
  top_items?: AnalyticsItemsSection<AnalyticsMenuItemRow>;
  low_items?: AnalyticsItemsSection<AnalyticsMenuItemRow>;
  category_performance?: AnalyticsItemsSection;
  all_items?: AnalyticsItemsSection<AnalyticsMenuItemRow>;
  stock_status?: AnalyticsSectionAvailability;
}

export interface AnalyticsStaffTab {
  productivity_summary?: AnalyticsMetricsSection;
  top_performer?: AnalyticsTopPerformerSection;
  leaderboard?: AnalyticsItemsSection;
  contribution?: AnalyticsItemsSection;
}

export interface AnalyticsMeta {
  restaurant_id?: number;
  timezone?: string;
  date_range?: { from?: string; to?: string };
  generated_at?: string;
  currency?: string;
  outlet_name?: string;
}

export interface AnalyticsDashboardTabs {
  overview?: AnalyticsOverviewTab;
  finance?: AnalyticsFinanceTab;
  orders?: AnalyticsOrdersTab;
  menu?: AnalyticsMenuTab;
  staff?: AnalyticsStaffTab;
}

/** Raw API payload shape (`data` from `GET /analytics/dashboard`). */
export interface AnalyticsDashboardResponse {
  meta?: AnalyticsMeta;
  tabs?: AnalyticsDashboardTabs;
}

/** Derived frontend view model for dashboard/analytics pages. */
export interface PeriodSnapshotView {
  income: number;
  expense: number;
  profit: number;
}

export interface PeriodComparisonView {
  current: PeriodSnapshotView;
  deltas: {
    incomePct: number;
    expensePct: number;
    profitPct: number;
    salesPct: number;
    ordersPct: number;
  };
}

export interface PeriodSnapshotMetrics {
  totalIncome: number;
  totalExpense: number;
  netProfit: number;
  grossSales: number;
  profitMargin: number;
  totalOrders: number;
  avgOrderValue: number;
}

export interface ReceivablesView {
  creditSales: number;
  totalOutstanding: number;
  creditOrdersCount: number;
}

export interface OperationsView {
  peakHour: string | null;
  avgServiceTimeMin: number;
  orderCancellationPct: number;
}

export interface PaymentInstrumentRow {
  method: string;
  instrument: string;
  amount: number;
}

export interface PaymentMethodGroup {
  method: string;
  amount: number;
  instruments: Array<{ name: string; amount: number }>;
}

export interface PaymentMixView {
  available: boolean;
  methods: PaymentMethodGroup[];
  /** Flat rows for pie charts (`Card • Nabil`, etc.). */
  expandedPieSlices: Array<{ name: string; value: number }>;
}

export interface HourlyChartData {
  labels: string[];
  revenue: number[];
  orders: number[];
}

export interface AnalyticsDashboardViewModel {
  meta: AnalyticsMeta;
  tabs: {
    overview: AnalyticsOverviewTab;
    finance: AnalyticsFinanceTab;
    orders: AnalyticsOrdersTab;
    menu: AnalyticsMenuTab;
    staff: AnalyticsStaffTab;
  };
  todaySnapshot: { income: number; expense: number };
  periodSnapshot: PeriodSnapshotMetrics;
  comparison: PeriodComparisonView;
  receivables: ReceivablesView;
  operations: OperationsView;
  insights: AnalyticsInsightItem[];
  paymentMix: PaymentMixView;
  paymentSettlementMix: PaymentMixView;
  revenueTrendPoints: Array<{ date: string; value: number }>;
  hourlyChart: HourlyChartData | null;
  breakdown: {
    source: Array<{ name: string; value: number }>;
    payment: Array<{ name: string; value: number }>;
    category: Array<{ name: string; value: number }>;
    expenseCategory: Array<{ name: string; value: number }>;
    expenseVendor: Array<{ name: string; value: number }>;
  };
  topMenuItems: AnalyticsMenuItemRow[];
  performanceTrends: AnalyticsChartSeriesSection;
  revenueTrends: AnalyticsChartSeriesSection;
}
