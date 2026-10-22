import {cleanup, render, screen} from "@testing-library/react";
import {afterEach, expect, it, vi} from "vitest";
vi.mock("@/hooks/use-auth", () => ({useAuth: (select:any) => select({user:{role:"custom", permissions:["finance.reports.payments.view"]}})}));
import FinanceReportsPage from "./page";
afterEach(cleanup);
it("lists only allowed report destinations", () => {
 render(<FinanceReportsPage />);
 const hrefs = screen.getAllByRole("link").map(link => link.getAttribute("href"));
 expect(hrefs).toContain("/finance/reports/refunds");
 expect(hrefs).not.toContain("/finance/reports/sales-book");
 expect(hrefs).not.toContain("/finance/reports/balance-sheet");
 expect(hrefs).not.toContain("/finance/reports/invoices");
});
