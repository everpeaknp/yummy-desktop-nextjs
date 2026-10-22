import {cleanup, render, screen} from "@testing-library/react";
import {afterEach, expect, it, vi} from "vitest";
vi.mock("next/navigation", () => ({usePathname: () => "/finance/payments"}));
vi.mock("@/hooks/use-auth", () => ({useAuth: (select:any) => select({user:{role:"custom", permissions:["finance.reports.payments.view"]}})}));
import {FinanceWorkspaceNav} from "./finance-workspace-nav";
afterEach(cleanup);
it("does not expose inaccessible finance tabs or actions", () => {
 render(<FinanceWorkspaceNav links={[{label:"Payments",href:"/finance/payments"},{label:"Invoices",href:"/finance/sales"}]} action={{label:"New sale",href:"/orders/new"}} />);
 expect(screen.getAllByRole("link").map(link => link.getAttribute("href"))).toEqual(["/finance/payments"]);
});
