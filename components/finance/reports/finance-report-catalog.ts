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
      { href: "/finance/reports/daybook", label: "Daybook", description: "Review the current open-period report and previously closed Daybooks." },
      { href: "/finance/reports/account-ledger", label: "Accounts", description: "Active accounts, balances, and their business activity." },
      { href: "/finance/reports/party-balances", label: "Party Balances", description: "Customer, supplier, and staff balances." },
      { href: "/finance/reports/custody-reconciliation", label: "Custody Reconciliation", description: "Compare ledger custody with cash and bank balances." },
    ],
  },
  {
    label: "Sales returns & tax",
    reports: [
      { href: "/finance/reports/refunds", label: "Refund Register", description: "Sales refunds and reversals." },
      { href: "/finance/reports/vat-sales", label: "VAT Sales", description: "Taxable sales and VAT amounts." },
    ],
  },
];
