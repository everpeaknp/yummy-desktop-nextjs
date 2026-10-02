import apiClient from "@/lib/api-client";
import { StaffProfileApis } from "@/lib/api/endpoints";

export type StaffProfile = {
  id: number;
  user_id: number;
  account_number: string;
  phone?: string | null;
  address?: string | null;
  age?: number | null;
  salary_type: "monthly" | "weekly" | "daily" | "hourly" | string;
  salary_amount: number;
  weekly_hours?: number | null;
  daily_hours?: number | null;
  discount_limit_amount?: number | null;
  attendance_based_salary?: boolean;
  self_discount_percent?: number | null;
  created_at?: string;
  updated_at?: string;
};

export type SalaryHistoryRecord = {
  id: number;
  staff_id: number;
  effective_from: string;
  effective_to?: string | null;
  salary_type: string;
  salary_amount: number;
  weekly_hours?: number | null;
  daily_hours?: number | null;
  reason?: string | null;
  created_at?: string;
};

function unwrap<T>(response: { data: { data?: T } | T }): T {
  const body = response.data as { data?: T };
  return body && typeof body === "object" && "data" in body
    ? (body.data as T)
    : (response.data as T);
}

export const staffWorkforceApi = {
  async profileByUserId(userId: number) {
    const profiles = unwrap<StaffProfile[]>(
      await apiClient.get(StaffProfileApis.list({ limit: 500 })),
    );
    return profiles.find((profile) => Number(profile.user_id) === Number(userId)) ?? null;
  },

  async salaryHistory(staffId: number) {
    return unwrap<SalaryHistoryRecord[]>(
      await apiClient.get(StaffProfileApis.salaryHistory(staffId)),
    );
  },
};
