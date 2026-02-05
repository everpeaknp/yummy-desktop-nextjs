export interface DashboardMeta {
  date: string;
  currency: string;
  outlet_name: string;
  last_updated: string;
  from_time: string;
  to_time: string;
}

export interface DashboardAlert {
  type: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  message: string;
}

export interface DashboardHealth {
  active_orders: number;
  kot_pending: number;
  kot_delayed: number;
  cancelled_today: number;
  refunded_today: number;
  alerts: DashboardAlert[];
}

export interface DashboardKPIs {
  gross_sales: number;
  net_sales: number;
  total_orders: number;
  average_order_value: number;
  total_discounts: number;
  total_tax_collected: number;
  cash_sales: number;
  non_cash_sales: number;
}

export interface TrendComparison {
  value: number;
  delta_percent: number;
  direction: 'UP' | 'DOWN' | 'SAME';
}

export interface DashboardTrends {
  sales_vs_yesterday: TrendComparison;
  orders_vs_yesterday: TrendComparison;
}

export interface PaymentMethodBreakdown {
  method: string;
  amount: number;
}

export interface OrderStatusBreakdown {
  status: string;
  count: number;
}

export interface TopItem {
  item_id: number;
  name: string;
  quantity: number;
  revenue: number;
}

export interface DashboardBreakdowns {
  payment_split: PaymentMethodBreakdown[];
  order_status: OrderStatusBreakdown[];
  top_items: TopItem[];
}

export interface QuickInsight {
  type: 'POSITIVE' | 'WARNING' | 'INFO';
  message: string;
}

export interface AdminDashboardV2Data {
  meta: DashboardMeta;
  health: DashboardHealth;
  kpis: DashboardKPIs;
  trends: DashboardTrends;
  breakdowns: DashboardBreakdowns;
  quick_insights: QuickInsight[];
}
