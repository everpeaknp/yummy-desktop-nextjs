import { describe, expect, it } from "vitest";
import { retiredAccountingDestination } from "./retired-accounting-routes";
import { reportGroups } from "@/components/finance/reports/finance-report-catalog";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

describe("retired accounting screens", () => {
  it("forwards old bookmarks to current Finance reports without reusing old journal IDs", () => {
    expect(retiredAccountingDestination()).toBe("/finance/reports");
    expect(retiredAccountingDestination(["vat-summary"])).toBe("/finance/reports/vat-summary");
    expect(retiredAccountingDestination(["vat-export"])).toBe("/finance/reports/vat-summary");
    expect(retiredAccountingDestination(["vouchers", "18"])).toBe("/finance/journals");
    expect(retiredAccountingDestination(["day-closes"], { day_close_id: "27" })).toBe("/day-close?detail=27");
    expect(retiredAccountingDestination(["day-closes"], { day_close_id: "javascript:bad" })).toBe("/day-close");
  });
  it("publishes VAT Summary in the current report catalog", () => {
    expect(reportGroups.flatMap((group) => group.reports)).toEqual(expect.arrayContaining([expect.objectContaining({ href: "/finance/reports/vat-summary", label: "VAT Summary" })]));
    expect(reportGroups.flatMap((group) => group.reports).some((report) => report.href.includes("/accounting"))).toBe(false);
  });
  it("keeps only a redirect entry under the retired route tree", () => {
    const root = join(process.cwd(), "app/(dashboard)/finance/accounting");
    const files = readdirSync(root, { recursive: true }).map(String).filter((name) => name.endsWith(".tsx"));
    expect(files).toEqual([join("[[...legacy]]", "page.tsx")]);
    expect(readFileSync(join(root, files[0]), "utf8")).toContain("redirect(retiredAccountingDestination");
  });
});
