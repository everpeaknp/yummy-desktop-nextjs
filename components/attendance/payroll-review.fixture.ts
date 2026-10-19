import type { AttendancePayrollPreview } from "@/lib/attendance/types";

export const payrollReviewFixture: AttendancePayrollPreview = {
  staff_id: 3, user_id: 8, staff_name: "QA Hourly", salary_type: "hourly", salary_amount: 200,
  attendance_based_salary: true, estimated_payable: 3300, daily_rate: 0,
  date_from: "2026-10-01", date_to: "2026-10-20", effective_from: "2026-10-18", timezone: "Asia/Kathmandu", as_of: "2026-10-20T00:00:00Z",
  review_count: 1, warnings: ["current_agreement", "hourly_overtime_included"], breakdown: { worked_days: 1, overtime_hours: 1, overtime_pay: 300 },
  days: [
    { date: "2026-10-18", reason: "hourly_work", units: "7.5", rate: "200", multiplier: "1", overtime_amount: "300", amount: "1800", entry_ids: [11] },
    { date: "2026-10-19", reason: "paid_holiday", units: "7.5", rate: "200", multiplier: "1", overtime_amount: "0", amount: "1500", entry_ids: [] },
    { date: "2026-10-20", reason: "no_approved_time", units: "0", rate: "0", multiplier: "1", overtime_amount: "0", amount: "0", entry_ids: [] },
  ],
};
