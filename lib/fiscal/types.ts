export const FISCAL_REGISTRATION_TYPES = [
  "unverified",
  "pan_only",
  "vat",
] as const;

export type FiscalRegistrationType =
  (typeof FISCAL_REGISTRATION_TYPES)[number];

export const FISCAL_BILLING_MODES = [
  "legacy_flexible",
  "pan_invoice",
  "vat_external",
  "vat_ebilling",
] as const;

export type FiscalBillingMode = (typeof FISCAL_BILLING_MODES)[number];

export const FISCAL_COMPLIANCE_STATUSES = [
  "unverified",
  "setup_required",
  "pending_ird",
  "ready_for_activation",
  "active",
  "suspended",
] as const;

export type FiscalComplianceStatus =
  (typeof FISCAL_COMPLIANCE_STATUSES)[number];

export type CbmsEnvironment = "test" | "production";

export const FISCAL_TAX_CATEGORIES = ["vat_13", "exempt"] as const;

export type FiscalTaxCategory = (typeof FISCAL_TAX_CATEGORIES)[number];

export type FiscalDocumentType =
  | "pan_invoice"
  | "tax_invoice"
  | "provisional_bill"
  | "credit_note"
  | "debit_note";

export type FiscalDocumentStatus =
  | "draft"
  | "issued"
  | "voided"
  | "credited";

export type CbmsSyncStatus =
  | "not_required"
  | "pending"
  | "processing"
  | "retry_scheduled"
  | "syncing"
  | "synced"
  | "succeeded"
  | "failed"
  | "dead_letter";

export interface BaseResponse<T> {
  status: string;
  message?: string | null;
  data: T;
}

export interface FiscalReadiness {
  is_ready: boolean;
  blockers: string[];
}

export interface FiscalProfile {
  id: number;
  restaurant_id: number;
  registration_type: FiscalRegistrationType;
  fiscal_billing_mode: FiscalBillingMode;
  compliance_status: FiscalComplianceStatus;
  legal_name: string | null;
  registered_address: string | null;
  seller_pan: string | null;
  ird_software_listing_number: string | null;
  ird_permission_number: string | null;
  ird_permission_date: string | null;
  approved_software_name: string | null;
  approved_software_version: string | null;
  abbreviated_invoice_approved: boolean;
  cloud_agreement_reference: string | null;
  next_invoice_seed: number;
  activation_effective_at: string | null;
  activated_at: string | null;
  suspended_at: string | null;
  configuration_version: number;
  readiness: FiscalReadiness;
}

export interface FiscalProfileDraft {
  registration_type: FiscalRegistrationType;
  fiscal_billing_mode: FiscalBillingMode;
  legal_name?: string | null;
  registered_address?: string | null;
  seller_pan?: string | null;
  ird_software_listing_number?: string | null;
  ird_permission_number?: string | null;
  ird_permission_date?: string | null;
  approved_software_name?: string | null;
  approved_software_version?: string | null;
  abbreviated_invoice_approved?: boolean;
  cloud_agreement_reference?: string | null;
  next_invoice_seed?: number;
  activation_effective_at?: string | null;
}

export interface FiscalValidationResult extends FiscalReadiness {
  warnings?: string[];
  profile?: FiscalProfile;
}

export interface CbmsConfig {
  username: string | null;
  environment: CbmsEnvironment;
  realtime_required: boolean;
  has_password: boolean;
  last_tested_at: string | null;
  last_test_result: string | null;
}

export interface CbmsConfigInput {
  username: string;
  password?: string;
  environment: CbmsEnvironment;
  realtime_required: boolean;
}

export interface CbmsStatus {
  configured?: boolean;
  environment?: CbmsEnvironment;
  realtime_required?: boolean;
  has_password?: boolean;
  username?: string | null;
  last_tested_at?: string | null;
  last_test_result?: string | null;
  last_success_at?: string | null;
  last_failure_at?: string | null;
  last_failure_message?: string | null;
  pending_count?: number;
  failed_count?: number;
  synced_count?: number;
  config?: CbmsConfig | null;
}

export interface FiscalDocumentLine {
  id?: number;
  document_id?: number;
  item_code?: string | null;
  fiscal_code?: string | null;
  description: string;
  unit: string;
  quantity: string | number;
  unit_price: string | number;
  gross_amount?: string | number;
  discount_amount?: string | number;
  line_total: string | number;
  tax_category?: FiscalTaxCategory;
  tax_rate?: string | number;
  taxable_amount?: string | number;
  exempt_amount?: string | number;
  tax_exempt_amount?: string | number;
  vat_amount?: string | number;
}

export interface FiscalDocument {
  id: number;
  restaurant_id: number;
  order_id?: number | null;
  document_type?: FiscalDocumentType;
  document_kind?: FiscalDocumentType;
  status: FiscalDocumentStatus;
  fiscal_year: string;
  sequence_number?: number;
  document_number: string;
  external_invoice_number?: string | null;
  transaction_id?: string | null;
  transaction_date?: string;
  business_date?: string;
  issued_at?: string | null;
  seller_name: string;
  seller_address: string;
  seller_pan: string;
  buyer_name?: string | null;
  buyer_address?: string | null;
  buyer_pan?: string | null;
  payment_method?: string;
  currency?: string;
  subtotal?: string | number;
  discount_amount?: string | number;
  taxable_amount?: string | number;
  tax_exempt_amount?: string | number;
  vat_amount?: string | number;
  vat_refund_amount?: string | number;
  total_amount: string | number;
  amount_in_words?: string | null;
  cbms_required?: boolean;
  is_realtime?: boolean;
  cbms_synced_at?: string | null;
  cbms_reference?: string | null;
  cbms_last_response_code?: string | null;
  cbms_sync_status?: CbmsSyncStatus;
  print_count?: number;
  original_document_id?: number | null;
  lines?: FiscalDocumentLine[];
}

export interface FiscalDocumentList {
  items: FiscalDocument[];
  total?: number;
  page?: number;
  page_size?: number;
}

export interface FiscalDocumentListParams {
  status?: FiscalDocumentStatus;
  document_type?: FiscalDocumentType;
  date_from?: string;
  date_to?: string;
  page?: number;
  page_size?: number;
}

export interface IssueFiscalDocumentInput {
  buyer_name?: string | null;
  buyer_address?: string | null;
  buyer_pan?: string | null;
}

export interface PrintAuthorizationInput {
  device_identifier?: string | null;
  printer_name?: string | null;
  client_job_id?: string | null;
}

export interface PrintAuthorization {
  authorization_id: number;
  authorization_token: string;
  expires_at: string;
  copy_number: number;
  designation: string;
  document: FiscalDocument;
}

export interface PrintCompletionInput {
  authorization_token: string;
  succeeded: boolean;
  failure_reason?: string | null;
}

export interface PrintCompletionResult {
  authorization_id: number;
  status: "succeeded" | "failed";
  printed_at?: string | null;
}

export interface CreditNoteInput {
  reason: string;
  amount?: string | number | null;
}

export function isActiveVatProfile(
  profile: FiscalProfile | null | undefined,
): boolean {
  return (
    profile?.registration_type === "vat" &&
    profile.compliance_status === "active"
  );
}

export function isActiveVatEbillingProfile(
  profile: FiscalProfile | null | undefined,
): boolean {
  return (
    isActiveVatProfile(profile) &&
    profile?.fiscal_billing_mode === "vat_ebilling"
  );
}

export const FISCAL_REGISTRATION_LABELS: Record<
  FiscalRegistrationType,
  string
> = {
  unverified: "Unverified",
  pan_only: "PAN only",
  vat: "VAT registered",
};

export const FISCAL_BILLING_MODE_LABELS: Record<FiscalBillingMode, string> = {
  legacy_flexible: "Legacy flexible receipt",
  pan_invoice: "PAN invoice",
  vat_external: "VAT with external invoicing",
  vat_ebilling: "Yummy VAT e-billing",
};

export const FISCAL_COMPLIANCE_STATUS_LABELS: Record<
  FiscalComplianceStatus,
  string
> = {
  unverified: "Unverified",
  setup_required: "Setup required",
  pending_ird: "Pending IRD",
  ready_for_activation: "Ready for activation",
  active: "Active",
  suspended: "Suspended",
};
