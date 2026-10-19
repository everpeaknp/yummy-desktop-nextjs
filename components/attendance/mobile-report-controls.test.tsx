import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MobileReportControls } from "./mobile-report-controls";

describe("mobile report period", () => {
  it("keeps draft dates local until Apply dates is selected", () => {
    const change = vi.fn();
    render(<MobileReportControls from="2026-10-01" to="2026-10-20" loading={false} onChange={change} onRefresh={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Oct|oct/i }));
    fireEvent.change(screen.getByLabelText("Report start date"), { target: { value: "2026-09-22" } });
    expect(change).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Apply dates" }));
    expect(change).toHaveBeenCalledWith("2026-09-22", "2026-10-20");
  });
  it("prevents invalid ranges from being applied", () => {
    render(<MobileReportControls from="2026-10-01" to="2026-10-20" loading={false} onChange={vi.fn()} onRefresh={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Oct|oct/i }));
    fireEvent.change(screen.getByLabelText("Report end date"), { target: { value: "2026-09-01" } });
    expect(screen.getByRole("button", { name: "Apply dates" })).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("End date");
  });
});
