export type BaseResponse<T> = {
  status?: string;
  message?: string;
  data?: T;
};

export type AttendanceSource = "qr_mobile" | "biometric_device" | "manual_adjustment";
export type AttendanceStatus = "open" | "complete" | "missing_checkout" | "adjusted" | "void";
export type AttendanceApprovalStatus =
  | "draft"
  | "pending"
  | "approved"
  | "rejected"
  | "needs_correction"
  | "payroll_exported";
export type AttendanceDeviceType = "zkteco_lan" | "zkteco_cloud" | "generic_import";
export type AttendanceMobileDeviceStatus = "pending" | "approved" | "rejected" | "revoked";

export type AttendanceSettings = {
  id: number;
  restaurant_id: number;
  timezone: string;
  latitude: number | null;
  longitude: number | null;
  geofence_radius_meters: number;
  required_location_accuracy_meters: number;
  early_clock_in_tolerance_minutes: number;
  late_clock_out_tolerance_minutes: number;
  rapid_repeat_window_seconds: number;
  automatic_break_after_minutes: number;
  automatic_break_duration_minutes: number;
  missing_checkout_review_after_minutes: number;
  overtime_rate_multiplier: number;
  mobile_clocking_enabled: boolean;
  device_clocking_enabled: boolean;
  policy_version: number;
  created_at: string;
  updated_at: string;
};

export type AttendanceEntry = {
  id: number;
  restaurant_id: number;
  staff_id: number;
  clock_in_at: string;
  clock_out_at: string | null;
  source: AttendanceSource;
  status: AttendanceStatus;
  device_id: number | null;
  qr_session_id: number | null;
  scheduled_start_at: string | null;
  scheduled_end_at: string | null;
  regular_minutes: number;
  break_minutes: number;
  overtime_minutes: number;
  rejected_excess_minutes: number;
  late_arrival_minutes: number;
  early_departure_minutes: number;
  exception_code: string | null;
  calculation_status: string;
  approval_status: AttendanceApprovalStatus;
  approval_version: number;
  policy_version: number;
  last_calculated_at: string | null;
  notes: string | null;
  created_by: number | null;
  updated_by: number | null;
  created_at: string;
  updated_at: string;
};

export type AttendanceOverview = {
  date_from: string;
  date_to: string;
  total_entries: number;
  pending_entries: number;
  approved_entries: number;
  regular_minutes: number;
  overtime_minutes: number;
  break_minutes: number;
};

export type AttendanceAudit = {
  id: number;
  attendance_entry_id: number;
  restaurant_id: number;
  event: string;
  actor_id: number | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  reason: string | null;
  created_at: string;
};

export type AttendanceQrSession = {
  id: number;
  restaurant_id: number;
  token: string;
  station_label: string | null;
  expires_at: string;
  is_active: boolean;
  created_by: number | null;
  created_at: string;
};

export type AttendanceDevice = {
  id: number;
  restaurant_id: number;
  name: string;
  device_type: AttendanceDeviceType;
  serial_number: string;
  ip_address: string | null;
  port: number | null;
  timezone: string;
  is_active: boolean;
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
};

export type StaffDeviceMapping = {
  id: number;
  restaurant_id: number;
  device_id: number;
  staff_id: number;
  device_user_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type AttendanceMobileDevice = {
  id: number;
  restaurant_id: number;
  staff_id: number;
  user_id: number;
  key_algorithm: string;
  device_label: string | null;
  platform: string | null;
  status: AttendanceMobileDeviceStatus;
  requested_at: string;
  approved_at: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  revoked_at: string | null;
  revocation_reason: string | null;
  last_seen_at: string | null;
};

export type AttendanceConnectorPairingCode = {
  code: string;
  restaurant_id: number;
  device_id: number | null;
  expires_at: string;
};

export type AttendanceConnectorPair = {
  credential_id: string;
  secret: string;
  restaurant_id: number;
  device_id: number | null;
  expires_at: string | null;
};

export type AttendanceShiftTemplate = {
  id: number;
  restaurant_id: number;
  name: string;
  start_local_time: string;
  end_local_time: string;
  crosses_midnight: boolean;
  unpaid_break_minutes: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type AttendanceSchedule = {
  id: number;
  restaurant_id: number;
  staff_id: number | null;
  shift_template_id: number | null;
  weekday: number;
  effective_from: string;
  effective_to: string | null;
  is_day_off: boolean;
  created_at: string;
  updated_at: string;
};

