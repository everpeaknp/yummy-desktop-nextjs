import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("@/components/dashboard/dashboard-promo-carousel", () => ({ DashboardPromoCarousel: () => null }));
import { FigmaExecutiveDashboard } from "./figma-executive-dashboard";

const props = {
  userName: "Casey", outletName: "Test", currency: "NPR", dateControl: null, statusControl: null,
  chartRange: "hourly" as const, periodLabel: "Today", onChartRangeChange: vi.fn(),
  canShowHourly: false, canShowWeekly: false,
  metrics: { activeOrders: 0, kotPending: 0, delayedKots: 0, refunds: 0, netSales: 0, totalOrders: 0 },
  financialSummary: { netSales: 0 }, trends: [], attention: [], quickActions: [],
  orderStatuses: [], activeOrders: [], topItems: [], paymentMix: [], sourceMix: [], staff: [], occupancy: [],
  canViewAnalytics: false, canManageMenuItems: false, canViewStaff: false,
  canViewDayClose: false, canExport: false, onExport: vi.fn(),
};
afterEach(cleanup);

describe("dashboard protected controls", () => {
  it("hides staff, shift log links, and export for a limited dashboard viewer", () => {
    render(<FigmaExecutiveDashboard {...props} />);
    expect(screen.queryByText("Floor staff on duty")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "View Shift Logs" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Export summary" })).not.toBeInTheDocument();
  });

  it("shows the controls when their individual grants allow them", () => {
    render(<FigmaExecutiveDashboard {...props} canViewAnalytics canViewStaff canViewDayClose canExport />);
    expect(screen.getByText("Floor staff on duty")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View Shift Logs" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export summary" })).toBeInTheDocument();
  });
});

it("does not reveal financial panels with dashboard access alone", () => {
 render(<FigmaExecutiveDashboard {...props} />);
 for (const label of ["Financial Summary", "Sales by hour", "Revenue by Source", "Top performing items", "Sales", "Refunds"]) {
   expect(screen.queryByText(label)).not.toBeInTheDocument();
 }
});

it("export permission does not reveal a financial export without analytics access", () => {
 render(<FigmaExecutiveDashboard {...props} canExport />);
 expect(screen.queryByRole("button", {name: "Export summary"})).not.toBeInTheDocument();
});

it("gives operational panels the full dashboard width when analytics are unavailable", () => {
 render(<FigmaExecutiveDashboard {...props} quickActions={[{ key: "create_order", title: "New order", subtitle: "Start an order" }]} />);

 const overview = screen.getByRole("region", { name: "Dashboard operations" });
 const shortcuts = screen.getByRole("region", { name: "Dashboard shortcuts" });
 const shiftSummary = screen.getByRole("region", { name: "Dashboard shift summary" });
 expect(overview).toHaveClass("grid-cols-1");
 expect(shortcuts).toHaveClass("grid-cols-1");
 expect(shiftSummary).toHaveClass("grid-cols-1");
 expect(within(overview).getByText("Needs attention")).toBeInTheDocument();
 expect(within(shortcuts).getByText("New order")).toBeInTheDocument();
});
