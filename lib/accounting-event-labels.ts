export type AccountingEventLabel = {
  label: string;
  meaning: string;
  defaultDebitHint: string;
  defaultCreditHint: string;
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
  },
  refund_processed: {
    label: "Refund paid",
    meaning: "Money returned to the customer against a previous successful payment.",
    defaultDebitHint: "Sales Returns",
    defaultCreditHint: "Cash or Payment Clearing",
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
  },
  manual_expense_paid: {
    label: "Operating expense paid",
    meaning: "Non-inventory operating cost paid by the restaurant.",
    defaultDebitHint: "Operating Expenses",
    defaultCreditHint: "Cash or Payment Clearing",
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
  },
  inventory_cogs_recognized: {
    label: "Inventory COGS recognized",
    meaning: "Inventory cost moved into expense when stock is consumed, wasted, or adjusted.",
    defaultDebitHint: "Cost of Goods Sold",
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
  return ACCOUNTING_EVENT_LABELS[eventType] || {
    label: eventType.replace(/_/g, " "),
    meaning: "No accountant-facing explanation has been configured for this finance event.",
    defaultDebitHint: "Select debit account",
    defaultCreditHint: "Select credit account",
  };
}

export const mappingPriorityHelp =
  "Mappings resolve by exact event + payment method + business line first, then event + payment method, then event default, then Suspense.";
