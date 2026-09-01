export type FinanceReportDefinition = {
  href: string;
  label: string;
  description: string;
};

export type FinanceReportGroup = {
  label: string;
  reports: FinanceReportDefinition[];
};

export const reportGroups: FinanceReportGroup[] = [
  {
    label: "Business performance",
    reports: [
      { href: "/finance/reports/profit-and-loss", label: "Profit & Loss", description: "Income, costs, and operating result." },
      { href: "/finance/reports/department-breakdown", label: "Performance by Department", description: "Revenue, cost, and margin per station (Kitchen, Bar, Cafe, etc.)." },
      { href: "/finance/reports/cash-flow", label: "Cash Flow", description: "Where cash came from and where it went." },
    ],
  },
  {
    label: "Financial position",
    reports: [
      { href: "/finance/reports/balance-sheet", label: "Balance Sheet", description: "Assets, liabilities, and equity at a date." },
      { href: "/finance/reports/trial-balance", label: "Trial Balance", description: "Debit and credit balances by account." },
    ],
  },
  {
    label: "Ledgers & reconciliation",
    reports: [
      { href: "/finance/reports/account-ledger", label: "Account Ledger", description: "Every posting for one account head." },
      { href: "/finance/reports/party-balances", label: "Party Balances", description: "Customer, supplier, and staff balances." },
      { href: "/finance/reports/head-activity", label: "Head Activity", description: "Movement summarized by account head." },
      { href: "/finance/reports/custody-reconciliation", label: "Custody Reconciliation", description: "Compare ledger custody with cash and bank balances." },
    ],
  },
  {
    label: "Sales & tax registers",
    reports: [
      { href: "/finance/reports/sales-book", label: "Sales Book", description: "Completed bills with tax and settlement." },
      { href: "/finance/reports/invoices", label: "Invoice Register", description: "Invoice-level sales and balances." },
      { href: "/finance/reports/payments", label: "Payment Register", description: "Customer collections and payment instruments." },
      { href: "/finance/reports/refunds", label: "Refund Register", description: "Sales refunds and reversals." },
      { href: "/finance/reports/vat-sales", label: "VAT Sales", description: "Taxable sales and VAT amounts." },
    ],
  },
];
