export type AccountingEventLabel = {
  label: string;
  meaning: string;
  defaultDebitHint: string;
  defaultCreditHint: string;
  paymentMethodSensitive?: boolean;
};

export const ACCOUNTING_EVENT_LABELS: Record<string, AccountingEventLabel> = {
  sale_recognized: {
    label: "Sale recognized",
    meaning: "Food, beverage, room, or service revenue earned by a completed bill.",
    defaultDebitHint: "Customer Receivables",
    defaultCreditHint: "Sales Revenue",
  },
  collection_received: {
    label: "Payment collected",
    meaning: "Cash, card, QR, or digital payment received from a customer.",
    defaultDebitHint: "Cash or Payment Clearing",
    defaultCreditHint: "Customer Receivables",
    paymentMethodSensitive: true,
  },
  credit_sale_created: {
    label: "Credit sale created",
    meaning: "Customer receivable created because the bill was completed without immediate payment.",
    defaultDebitHint: "Customer Receivables",
    defaultCreditHint: "Sales Revenue",
  },
  refund_processed: {
    label: "Refund paid",
    meaning: "Money returned to the customer against a previous successful payment.",
    defaultDebitHint: "Sales Returns",
    defaultCreditHint: "Cash or Payment Clearing",
    paymentMethodSensitive: true,
  },
  refund_liability_created: {
    label: "Refund liability created",
    meaning: "Customer is owed money but cash has not been paid out yet.",
    defaultDebitHint: "Sales Returns",
    defaultCreditHint: "Refund Liabilities",
  },
  manual_income_received: {
    label: "Manual income received",
    meaning: "Non-order income entered manually.",
    defaultDebitHint: "Cash or Payment Clearing",
    defaultCreditHint: "Manual Income",
    paymentMethodSensitive: true,
  },
  manual_expense_paid: {
    label: "Operating expense paid",
    meaning: "Non-inventory operating cost paid by the restaurant.",
    defaultDebitHint: "Operating Expenses",
    defaultCreditHint: "Cash or Payment Clearing",
    paymentMethodSensitive: true,
  },
  inventory_asset_acquired: {
    label: "Inventory asset acquired",
    meaning: "Inventory value added to stock before it becomes COGS.",
    defaultDebitHint: "Inventory Asset",
    defaultCreditHint: "Supplier Payables",
  },
  inventory_cash_outflow: {
    label: "Inventory purchase paid",
    meaning: "Cash, card, QR, or digital payment made to a supplier for inventory.",
    defaultDebitHint: "Supplier Payables",
    defaultCreditHint: "Cash or Payment Clearing",
    paymentMethodSensitive: true,
  },
  inventory_cogs_recognized: {
    label: "Inventory COGS recognized",
    meaning: "Inventory cost moved into expense when stock is consumed, wasted, or adjusted.",
    defaultDebitHint: "Cost of Goods Sold",
    defaultCreditHint: "Inventory Asset",
  },
  inventory_return_processed: {
    label: "Inventory return processed",
    meaning: "Inventory value or supplier balance reduced because stock was returned.",
    defaultDebitHint: "Supplier Payables",
    defaultCreditHint: "Inventory Asset",
  },
  supplier_payable_created: {
    label: "Supplier payable created",
    meaning: "Unpaid supplier bill for inventory or purchase received.",
    defaultDebitHint: "Inventory Asset or Expense",
    defaultCreditHint: "Supplier Payables",
  },
  supplier_payment_made: {
    label: "Supplier payment made",
    meaning: "Payment made against an existing supplier payable.",
    defaultDebitHint: "Supplier Payables",
    defaultCreditHint: "Cash or Payment Clearing",
    paymentMethodSensitive: true,
  },
  discount_applied: {
    label: "Discount applied",
    meaning: "Discount reducing sales revenue.",
    defaultDebitHint: "Discount Contra Revenue",
    defaultCreditHint: "Customer Receivables",
  },
  cash_variance_recorded: {
    label: "Cash variance recorded",
    meaning: "Cash drawer overage or shortage from day close.",
    defaultDebitHint: "Cash Over/Short",
    defaultCreditHint: "Cash",
  },
};

export function accountingEventLabel(eventType: string): AccountingEventLabel {
  const normalized = eventType.trim().toLowerCase();
  if (!normalized) {
    return {
      label: "Select finance event",
      meaning: "Choose the finance event this mapping should post before selecting debit and credit accounts.",
      defaultDebitHint: "Choose an event first",
      defaultCreditHint: "Choose an event first",
    };
  }

  return ACCOUNTING_EVENT_LABELS[normalized] || {
    label: normalized.replace(/_/g, " "),
    meaning: "No accountant-facing explanation has been configured for this finance event.",
    defaultDebitHint: "Select debit account",
    defaultCreditHint: "Select credit account",
  };
}

export const ACCOUNTING_EVENT_OPTIONS = Object.entries(ACCOUNTING_EVENT_LABELS).map(([value, help]) => ({
  value,
  label: help.label,
  meaning: help.meaning,
}));

export const mappingPriorityHelp =
  "Mappings resolve by exact event + payment method + business line first, then event + payment method, then event default, then Suspense.";
