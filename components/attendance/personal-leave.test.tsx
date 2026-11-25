import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { attendanceApi } from "@/lib/attendance/api";
import { PersonalLeave } from "./personal-leave";

vi.mock("@/lib/attendance/api", () => ({ attendanceApi: { leaveCategories: vi.fn(), myLeaveBalances: vi.fn(), requestMyLeave: vi.fn() } }));
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(attendanceApi.leaveCategories).mockResolvedValue([{ id: 1, name: "Annual", leave_type: "paid", annual_days: "12", effective_year: 2026, accrual_mode: "upfront", carry_forward_limit: "0", is_active: true }]);
  vi.mocked(attendanceApi.myLeaveBalances).mockResolvedValue([{ category_id: 1, category_name: "Annual", year: 2026, earned: "12", carry_forward: "0", adjustments: "0", approved_days: "2", reserved_days: "1", available: "9", adjustment_history: [] }]);
  vi.mocked(attendanceApi.requestMyLeave).mockResolvedValue({} as Awaited<ReturnType<typeof attendanceApi.requestMyLeave>>);
});

it("shows available and reserved days and submits self-only category leave", async () => {
  const onSaved = vi.fn(); render(<PersonalLeave onSaved={onSaved} />);
  expect(await screen.findByText("9 days available · 1 reserved")).toBeInTheDocument();
  fireEvent.click(screen.getByText("Request leave", { selector: "summary" }));
  fireEvent.change(screen.getByLabelText("Category"), { target: { value: "1" } });
  fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "Family appointment" } });
  fireEvent.click(screen.getByRole("button", { name: "Request leave" }));
  await waitFor(() => expect(attendanceApi.requestMyLeave).toHaveBeenCalledWith(expect.objectContaining({ category_id: 1, leave_type: "paid", reason: "Family appointment" })));
  expect(vi.mocked(attendanceApi.requestMyLeave).mock.calls[0][0]).not.toHaveProperty("staff_id");
  expect(onSaved).toHaveBeenCalledOnce();
});

it("does not invent a zero balance when the backend fails", async () => {
  vi.mocked(attendanceApi.myLeaveBalances).mockRejectedValue(new Error("Balance service offline"));
  render(<PersonalLeave onSaved={() => {}} />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Balance service offline");
  expect(screen.queryByText(/days available/)).not.toBeInTheDocument();
});
