export type StaffPerformanceBreakdown = {
  attendance?: number | null;
  order_ownership?: number | null;
  order_completion?: number | null;
  order_progression?: number | null;
};

/**
 * An explainable view of activity attributed to one staff member. Revenue is
 * retained as operational context, never used as the ranking score.
 */
export type StaffPerformanceRow = {
  id: number;
  name: string;
  email: string;
  revenue: number;
  orders_count: number;
  avg_order_value: number;
  orders_completed: number;
  revenue_as_completer: number;
  items_added: number;
  role: string;
  performance_score: number;
  performance_rank?: number | null;
  eligible_for_ranking: boolean;
  eligibility_reason?: string | null;
  approved_attendance_minutes: number;
  scheduled_attendance_minutes: number;
  late_arrival_minutes: number;
  early_departure_minutes: number;
  performance_breakdown: StaffPerformanceBreakdown;
};

export type StaffPerformanceResponse = {
  staff: StaffPerformanceRow[];
  total_staff: number;
  page: number;
  page_size: number;
  total_pages: number;
  score_version?: string;
  ranking_scope?: "within_role" | string;
  quality_signal_available?: boolean;
};
