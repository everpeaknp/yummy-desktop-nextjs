export type FinanceReportParams = {
  restaurantId: number;
  dateFrom?: string;
  dateTo?: string;
  timezone?: string;
  businessLine?: string;
  station?: string;
  paymentMethod?: string;
  instrumentType?: string;
  instrumentName?: string;
  customerId?: number;
  billNumber?: string;
  limit?: number;
  offset?: number;
};

export type FinanceReportTotals = {
  subtotal: number;
  discount: number;
  taxable_sales: number;
  tax_amount: number;
  service_charge: number;
  grand_total: number;
  paid_amount: number;
  refund_amount: number;
  balance_due: number;
};

export type SalesBookRow = {
  order_id: number;
  invoice_number: string;
  completed_at: string;
  business_date: string;
  business_line: string;
  customer_id?: number | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  subtotal: number;
  discount: number;
  taxable_sales: number;
  tax_amount: number;
  service_charge: number;
  grand_total: number;
  paid_amount: number;
  refund_amount: number;
  balance_due: number;
  settlement_status: string;
};

export type InvoiceRow = SalesBookRow;

export type PaymentReportRow = {
  payment_id: number;
  order_id: number;
  invoice_number: string;
  paid_at: string;
  business_date: string;
  payment_method: string;
  amount: number;
  instrument_type?: string | null;
  instrument_name?: string | null;
  reference?: string | null;
  customer_id?: number | null;
  customer_name?: string | null;
};

export type RefundReportRow = {
  payment_id: number;
  order_id: number;
  invoice_number: string;
  refunded_at: string;
  business_date: string;
  payment_method: string;
  amount: number;
  instrument_type?: string | null;
  instrument_name?: string | null;
  reference?: string | null;
  customer_id?: number | null;
  customer_name?: string | null;
};

export type VatSalesRow = {
  order_id: number;
  invoice_number: string;
  completed_at: string;
  business_date: string;
  customer_id?: number | null;
  customer_name?: string | null;
  taxable_sales: number;
  tax_amount: number;
  grand_total: number;
};

export type SalesBookReportResponse = {
  rows: SalesBookRow[];
  total: number;
  limit: number;
  offset: number;
  totals: FinanceReportTotals;
};

export type InvoiceReportResponse = {
  rows: InvoiceRow[];
  total: number;
  limit: number;
  offset: number;
  totals: FinanceReportTotals;
};

export type PaymentReportResponse = {
  rows: PaymentReportRow[];
  total: number;
  limit: number;
  offset: number;
  totals: {
    paid_amount: number;
  };
};

export type RefundReportResponse = {
  rows: RefundReportRow[];
  total: number;
  limit: number;
  offset: number;
  totals: {
    refund_amount: number;
  };
};

export type VatSalesReportResponse = {
  rows: VatSalesRow[];
  total: number;
  limit: number;
  offset: number;
  totals: FinanceReportTotals;
};
