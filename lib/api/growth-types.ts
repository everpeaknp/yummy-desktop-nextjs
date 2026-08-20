export type GrowthReadinessStatus = "ready" | "partial" | "unavailable";
export type GrowthDataStatus = "confirmed" | "estimated" | "signal" | "unavailable";
export type GrowthSegmentCode = "new" | "regular" | "lapsed";
export type GrowthPlaybookCode = "second_visit" | "win_back" | "slow_day";
export type GrowthLanguage = "en" | "ne" | "ne_romanized";
export type GrowthChannelCode = "whatsapp" | "email";
export type GrowthCampaignStatus =
  | "draft"
  | "review"
  | "approved"
  | "scheduled"
  | "sending"
  | "completed"
  | "paused"
  | "canceled"
  | "failed";

export interface GrowthApiEnvelope<T> {
  status?: string;
  message?: string;
  data: T;
}

export interface GrowthReportingWindow {
  date_from?: string | null;
  date_to?: string | null;
  days?: number | null;
  timezone?: string | null;
}

export interface GrowthCoverageMetric {
  key: string;
  label: string;
  value: number | string | null;
  total?: number | null;
  unit?: "count" | "percent" | "days" | "currency" | string;
}

export interface GrowthReadinessDomain {
  key?: string;
  code?: string;
  domain?: string;
  label?: string;
  status: GrowthReadinessStatus;
  coverage_percent?: number | null;
  metrics?: GrowthCoverageMetric[];
  reporting_window?: GrowthReportingWindow | null;
  missing_requirements?: string[];
  available_insights?: string[];
  next_action?: string | null;
  action_label?: string | null;
  action_route?: string | null;
  limitation?: string | null;
}

export interface GrowthReadiness {
  domains: GrowthReadinessDomain[];
  generated_at?: string | null;
  reporting_window?: GrowthReportingWindow | null;
}

export type GrowthOpportunityStatus = "open" | "dismissed" | "converted" | "expired";

export interface GrowthOpportunitySummary {
  id: number | string;
  playbook_code: GrowthPlaybookCode;
  title: string;
  explanation?: string | null;
  suggested_action?: string | null;
  eligible_customer_count: number;
  readiness_status: GrowthReadinessStatus;
  data_status?: GrowthDataStatus;
  confidence?: "high" | "medium" | "low" | null;
  limitations?: string[];
  status?: GrowthOpportunityStatus;
  generated_at?: string | null;
  expires_at?: string | null;
  action_label?: string | null;
  action_route?: string | null;
}

export interface GrowthCampaignSummary {
  id: number | string;
  name: string;
  playbook_code: GrowthPlaybookCode;
  segment_code: GrowthSegmentCode;
  channel: GrowthChannelCode;
  status: GrowthCampaignStatus;
  audience_count: number;
  scheduled_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  sent_count?: number;
  delivered_count?: number;
  redeemed_count?: number;
}

export interface GrowthCampaignResultSummary {
  campaign_id: number | string;
  campaign_name: string;
  audience_count: number;
  queued_count?: number;
  sending_count?: number;
  sent_count: number;
  delivered_count: number;
  read_count?: number;
  failed_count: number;
  unknown_count?: number;
  suppressed_count?: number;
  redeemed_count: number;
  reversed_count?: number;
  attributed_order_count?: number;
  attributed_revenue?: number | null;
  discount_cost?: number | null;
  opt_out_count: number;
  profitability_status?: "verified" | "unverified" | "not_applicable";
  limitations?: string[];
  date_from?: string | null;
  date_to?: string | null;
}

export interface GrowthOverviewSummary {
  identified_customer_count?: number;
  consented_customer_count?: number;
  open_opportunity_count?: number;
  active_campaign_count?: number;
  messages_used_this_month?: number;
  messages_allocated_this_month?: number;
  messages_monthly_limit?: number | null;
  messages_limit_unlimited?: boolean;
}

/**
 * The overview contract remains additive while the backend is built. The UI
 * normalizer accepts either a readiness object or a direct domain list so an
 * unavailable domain never prevents the rest of Grow from rendering.
 */
export interface GrowthOverview {
  readiness?: GrowthReadiness | GrowthReadinessDomain[];
  readiness_domains?: GrowthReadinessDomain[];
  opportunities?: GrowthOpportunitySummary[];
  active_campaigns?: GrowthCampaignSummary[];
  recent_results?: GrowthCampaignResultSummary[];
  summary?: GrowthOverviewSummary;
  generated_at?: string | null;
}

export interface NormalizedGrowthOverview {
  readiness: GrowthReadiness;
  opportunities: GrowthOpportunitySummary[];
  active_campaigns: GrowthCampaignSummary[];
  recent_results: GrowthCampaignResultSummary[];
  summary: GrowthOverviewSummary;
  generated_at?: string | null;
}

export interface GrowthSegmentPreview {
  segment_code: GrowthSegmentCode;
  included_count: number;
  excluded_count: number;
  exclusions: Record<string, number>;
  customers?: Array<{
    id: number | string;
    display_name?: string | null;
    destination_masked?: string | null;
    last_completed_order_at?: string | null;
  }>;
  customer_details_visible: boolean;
  is_frozen: boolean;
}

export interface GrowthOfferInput {
  type: "fixed" | "percentage";
  value: number;
  minimum_order_value?: number | null;
  percentage_cap?: number | null;
  valid_from: string;
  valid_until: string;
  redemption_limit?: number | null;
  item_ids?: number[];
  category_ids?: number[];
}

export interface GrowthOffer extends GrowthOfferInput {
  id: number | string;
  profitability_status: "verified" | "unverified" | "not_applicable";
  maximum_exposure?: number | null;
  limitations?: string[];
}

export interface GrowthCampaignCreateInput {
  name: string;
  playbook_code: GrowthPlaybookCode;
  segment_code: GrowthSegmentCode;
  channel: GrowthChannelCode;
  opportunity_id?: number | string | null;
  offer: GrowthOfferInput;
  language: GrowthLanguage;
  message_body?: string | null;
  email_subject?: string | null;
  email_body_html?: string | null;
  email_template?: string | null;
  creative_asset_id?: number | string | null;
  message_template_id?: number | string | null;
}

export interface GrowthCampaignUpdateInput {
  name?: string;
  offer?: GrowthOfferInput;
  language?: GrowthLanguage;
  message_body?: string;
  email_subject?: string | null;
  email_body_html?: string | null;
  email_template?: string | null;
  creative_asset_id?: number | string | null;
  message_template_id?: number | string | null;
}

export interface GrowthCampaign extends GrowthCampaignSummary {
  offer?: GrowthOffer | null;
  approved_message_snapshot?: string | null;
  email_subject?: string | null;
  email_template?: string | null;
  creative_asset_id?: number | string | null;
  message_template_id?: number | string | null;
  language?: GrowthLanguage | null;
  audience_frozen_at?: string | null;
  reviewed_at?: string | null;
  approved_at?: string | null;
  failure_reason?: string | null;
  pause_reason?: string | null;
}

export interface GrowthScheduleInput {
  scheduled_at: string;
  timezone: string;
}

export interface GrowthCreativeAsset {
  id: number | string;
  campaign_id: number | string;
  template_key: string;
  template_version: number;
  asset_format: "png" | "jpeg" | "webp";
  width_px: number;
  height_px: number;
  checksum_sha256: string;
  cloudinary_public_id: string;
  secure_url: string;
  status: "draft" | "approved";
  approved_at?: string | null;
  created_at: string;
}

export interface GrowthCampaignPosterUploadInput {
  file: Blob;
  filename?: string;
  template_key: "fresh" | "warm" | "minimal" | "ticket";
  template_version: number;
}

export interface GrowthSettings {
  id?: number | null;
  restaurant_id: number;
  new_customer_lookback_days: number;
  regular_min_completed_orders: number;
  lapsed_after_days: number;
  promotion_frequency_cap_days: number;
  quiet_hours_start: string;
  quiet_hours_end: string;
  sender_display_name?: string | null;
  approved_languages: GrowthLanguage[];
  whatsapp_enabled: boolean;
  email_enabled: boolean;
  ai_copy_enabled: boolean;
  public_enrollment_enabled: boolean;
  public_enrollment_slug?: string | null;
  consent_policy_version?: string | null;
  consent_text?: string | null;
  consent_text_hash?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export type GrowthSettingsUpdate = Partial<
  Pick<
    GrowthSettings,
    | "new_customer_lookback_days"
    | "regular_min_completed_orders"
    | "lapsed_after_days"
    | "promotion_frequency_cap_days"
    | "quiet_hours_start"
    | "quiet_hours_end"
    | "sender_display_name"
    | "approved_languages"
    | "whatsapp_enabled"
    | "email_enabled"
    | "ai_copy_enabled"
    | "public_enrollment_enabled"
    | "consent_policy_version"
    | "consent_text"
  >
>;

export interface GrowthBrandProfile {
  logo_url?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
  approved_font_family?: string | null;
  tone_presets?: string[];
  approved_footer_text?: string | null;
  approved_contact_text?: string | null;
  default_terms_text?: string | null;
}

export type GrowthBrandUpdate = Partial<GrowthBrandProfile>;

export interface GrowthMessageTemplate {
  id: number | string;
  key: string;
  channel: GrowthChannelCode;
  whatsapp_template_name: string;
  provider_template_name: string;
  language: GrowthLanguage;
  category: string;
  provider_status: string;
  variable_names: string[];
  media_type?: string | null;
}

export interface GrowthCopySuggestionInput {
  playbook_code: GrowthPlaybookCode;
  language: GrowthLanguage;
  offer: GrowthOfferInput;
  audience_summary: string;
  tone?: string | null;
}

export interface GrowthCopySuggestion {
  headline: string;
  message_body: string;
  deterministic_fallback_used: boolean;
  warnings: string[];
}

export interface GrowthOfferValidationInput {
  offer_code: string;
  order_id: number;
  customer_id?: number | null;
}

export interface GrowthOfferValidationResult {
  valid: boolean;
  reason?: string | null;
  message: string;
  order_id: number;
  customer_id?: number | null;
  campaign_id?: number | null;
  offer_id?: number | null;
  offer_name?: string | null;
  discount_type?: "fixed" | "percentage" | string | null;
  discount_amount: number;
  order_subtotal: number;
  projected_grand_total: number;
  minimum_order_value?: number | null;
  valid_until?: string | null;
  profitability_status?: "verified" | "unverified" | "not_applicable" | null;
}

export interface PublicGrowthRestaurant {
  restaurant_name: string;
  logo_url?: string | null;
  approved_languages: GrowthLanguage[];
  consent_policy_version: string;
  consent_text: string;
  consent_text_hash: string;
}

export interface PublicGrowthJoinInput {
  name: string;
  phone: string;
  email?: string | null;
  preferred_language: GrowthLanguage;
  whatsapp_marketing_opt_in: boolean;
  email_marketing_opt_in?: boolean | null;
  policy_version: string;
  consent_text_hash: string;
}

export interface PublicGrowthJoinResult {
  accepted: boolean;
  preference_token: string;
  email_preference_token?: string | null;
}

export interface PublicGrowthPreferenceItem {
  destination_masked: string;
  channel: GrowthChannelCode;
  purpose: "marketing";
  status: "opted_in" | "opted_out";
  preferred_language: GrowthLanguage;
  captured_at?: string | null;
  revoked_at?: string | null;
  preference_token?: string | null;
}

export interface PublicGrowthPreferences {
  restaurant_name: string;
  logo_url?: string | null;
  consent_policy_version?: string | null;
  consent_text?: string | null;
  preferences: PublicGrowthPreferenceItem[];
}

export interface PublicGrowthUnsubscribeResult {
  unsubscribed: boolean;
  status: "opted_out";
  revoked_at?: string | null;
}

export interface GrowthTestEmailInput {
  template: string;
  recipient_email: string;
  restaurant_name?: string;
  headline?: string;
  description?: string;
  discount_type?: "percentage" | "flat_amount";
  value?: number;
  percentage_cap?: number | null;
  minimum_order_value?: number | null;
  valid_until?: string | null;
  coupon_code?: string;
  terms?: string;
  logo_url?: string;
  primary_color?: string;
}

export interface GrowthTestEmailResult {
  success: boolean;
  message: string;
  recipient: string;
}
