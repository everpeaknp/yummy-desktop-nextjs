export type FinanceSalesDocumentKind = "invoice" | "credit_note";
export type FinanceSalesReturnSource = "finance_invoice" | "external";

export interface FinanceSalesSettlementInput {
  account_type: "drawer" | "bank";
  account_id: number;
  reference?: string | null;
  instrument_type?: string | null;
  instrument_name?: string | null;
}

export interface FinanceSalesInvoiceLineInput {
  item_name: string;
  quantity: number;
  unit_price: number;
  discount_amount?: number;
  tax_amount?: number;
  reporting_head_id?: number | null;
  menu_item_id?: number | null;
  description?: string | null;
}

export interface FinanceSalesInvoiceInput {
  restaurant_id: number;
  business_line: "restaurant" | "hotel";
  business_date: string;
  customer_id?: number | null;
  external_reference?: string | null;
  notes?: string | null;
  idempotency_key: string;
  lines: FinanceSalesInvoiceLineInput[];
  settlement?: FinanceSalesSettlementInput | null;
}

export interface FinanceSalesReturnLineInput {
  source_line_id?: number | null;
  order_item_id?: number | null;
  item_name?: string | null;
  quantity: number;
  unit_price?: number | null;
  tax_amount?: number | null;
  reporting_head_id?: number | null;
  description?: string | null;
}

export interface FinanceSalesReturnInput {
  restaurant_id: number;
  business_line: "restaurant" | "hotel";
  business_date: string;
  source_type: FinanceSalesReturnSource;
  source_id?: number | null;
  customer_id?: number | null;
  external_reference?: string | null;
  reason: string;
  idempotency_key: string;
  lines: FinanceSalesReturnLineInput[];
  outcome: "refund_now" | "customer_credit";
  settlement?: FinanceSalesSettlementInput | null;
  original_payment_id?: number | null;
}

export interface FinanceSalesDocumentLine {
  id: number;
  original_line_id: number | null;
  order_item_id: number | null;
  menu_item_id: number | null;
  item_name: string;
  quantity: number | string;
  unit_price: number | string;
  discount_amount: number | string;
  tax_amount: number | string;
  line_total: number | string;
  reporting_head_id: number | null;
  description: string | null;
}

export interface FinanceSalesDocument {
  id: number;
  restaurant_id: number;
  document_number: string;
  document_kind: FinanceSalesDocumentKind;
  status: string;
  business_line: string;
  business_date: string;
  customer_id: number | null;
  customer_name?: string | null;
  source_type: string;
  source_id: number | null;
  daily_order_number: number | null;
  fiscal_document_number: string | null;
  original_document_id: number | null;
  external_reference: string | null;
  subtotal: number | string;
  discount_total: number | string;
  tax_total: number | string;
  grand_total: number | string;
  settlement_status: string;
  notes: string | null;
  reason: string | null;
  created_by_id: number | null;
  created_by_name?: string | null;
  created_at: string;
  lines: FinanceSalesDocumentLine[];
}

export interface FinanceSalesDocumentList {
  documents: FinanceSalesDocument[];
  total: number;
}

export interface OrderSettlementReplacementInput {
  reason: string;
  idempotency_key: string;
  payments: Array<{
    method: "cash" | "card" | "digital" | "fonepay" | "bank_transfer";
    amount: number;
    account_type: "drawer" | "bank";
    account_id: number;
    reference?: string | null;
    instrument?: { type: string; name: string } | null;
  }>;
}
